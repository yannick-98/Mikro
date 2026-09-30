import { prisma } from '../lib/prisma.js'
import { computeScore } from './scoring.js'

/**
 * Recalcula las metricas derivadas de un creador (seguidores totales,
 * engagement medio ponderado, valoracion, score) y las persiste.
 */
export async function recomputeCreator(creatorId) {
  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: { socialAccounts: true, portfolio: true },
  })
  if (!creator) return null

  const accounts = creator.socialAccounts
  const totalFollowers = accounts.reduce((sum, a) => sum + a.followers, 0)
  const engagementRate =
    totalFollowers > 0
      ? accounts.reduce((sum, a) => sum + a.engagement * a.followers, 0) / totalFollowers
      : 0

  const ratings = await prisma.review.aggregate({
    where: { creatorId },
    _avg: { rating: true },
    _count: { rating: true },
  })

  const completedDeals = await prisma.deal.count({
    where: { creatorId, status: { in: ['APPROVED', 'PAID'] } },
  })

  const next = {
    totalFollowers,
    engagementRate: Math.round(engagementRate * 100) / 100,
    ratingAvg: Math.round((ratings._avg.rating || 0) * 10) / 10,
    ratingCount: ratings._count.rating || 0,
    completedDeals,
  }
  next.score = computeScore({ ...creator, ...next })

  return prisma.creator.update({
    where: { id: creatorId },
    data: next,
    include: { socialAccounts: true, portfolio: { orderBy: { position: 'asc' } } },
  })
}

/**
 * Reordena el ranking global y guarda el movimiento respecto a la posicion
 * anterior. Es lo que alimenta "Movimientos de hoy" en la portada.
 */
export async function recomputeRanking() {
  const creators = await prisma.creator.findMany({
    orderBy: [{ score: 'desc' }, { totalFollowers: 'desc' }],
    select: { id: true, rankPosition: true, score: true },
  })

  const updates = creators.map((c, idx) => {
    const position = idx + 1
    const previous = c.rankPosition || position
    return prisma.creator.update({
      where: { id: c.id },
      data: { rankPosition: position, rankDelta: previous - position },
    })
  })

  await prisma.$transaction(updates)
  return creators.length
}

export default { recomputeCreator, recomputeRanking }
