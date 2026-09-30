import { Router } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma.js'
import { asyncHandler, forbidden, notFound, parseBody } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { publicCreator } from '../services/serialize.js'
import { matchScore, computeScore } from '../services/scoring.js'
import { normalize } from '../services/taxonomy.js'
import { recomputeCreator } from '../services/creatorStats.js'

const router = Router()

const CREATOR_INCLUDE = {
  socialAccounts: true,
  portfolio: { orderBy: { position: 'asc' } },
}

function csv(value) {
  if (!value) return []
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function num(value) {
  if (value === undefined || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** Construye los criterios de busqueda a partir de la query string. */
export function criteriaFromQuery(q) {
  return {
    categories: csv(q.categories || q.category),
    cities: csv(q.cities || q.city),
    platforms: csv(q.platforms || q.platform),
    minFollowers: num(q.minFollowers),
    maxFollowers: num(q.maxFollowers),
    minEngagement: num(q.minEngagement),
    maxBudget: num(q.maxBudget),
    audienceGender: q.audienceGender || undefined,
    language: q.language || undefined,
    keywords: q.q ? normalize(q.q).split(/\s+/).filter((w) => w.length > 2) : [],
  }
}

/** Indica si la busqueda lleva algun criterio del usuario. */
function hasCriteria(c = {}) {
  return Boolean(
    c.categories?.length ||
      c.cities?.length ||
      c.platforms?.length ||
      c.keywords?.length ||
      c.minFollowers != null ||
      c.maxFollowers != null ||
      c.minEngagement != null ||
      c.maxBudget != null ||
      c.audienceGender ||
      c.language,
  )
}

/**
 * Aplica filtros duros (los que excluyen) y devuelve la lista con afinidad.
 * El dataset del MVP es pequeno, asi que el calculo en memoria es suficiente y
 * mantiene una sola implementacion del algoritmo de match.
 */
export async function searchCreators(criteria, options = {}) {
  const { sort = 'relevance', page = 1, pageSize = 12, tab = 'top', strict = true } = options

  const where = { available: true }
  if (strict && criteria.categories?.length) where.category = { in: criteria.categories }
  if (strict && criteria.cities?.length) where.city = { in: criteria.cities }
  if (criteria.verified) where.verified = true

  let creators = await prisma.creator.findMany({ where, include: CREATOR_INCLUDE })

  // Filtros de rango: se aplican como descarte suave salvo los explicitos.
  if (criteria.minFollowers != null) {
    creators = creators.filter((c) => c.totalFollowers >= criteria.minFollowers * 0.5)
  }
  if (criteria.maxFollowers != null) {
    creators = creators.filter((c) => c.totalFollowers <= criteria.maxFollowers * 2)
  }
  if (criteria.minEngagement != null) {
    creators = creators.filter((c) => c.engagementRate >= criteria.minEngagement * 0.7)
  }
  if (criteria.platforms?.length) {
    creators = creators.filter((c) =>
      criteria.platforms.some((p) => c.socialAccounts.some((a) => a.platform === p)),
    )
  }
  if (criteria.language) {
    creators = creators.filter((c) => normalize(c.languages).includes(normalize(criteria.language)))
  }
  if (criteria.audienceCountry) {
    creators = creators.filter((c) => normalize(c.audienceCountry) === normalize(criteria.audienceCountry))
  }
  if (criteria.keywords?.length) {
    creators = creators.filter((c) => {
      const hay = normalize([c.displayName, c.handle, c.headline, c.bio, c.category, c.subcategories, c.city].join(' '))
      return criteria.keywords.some((k) => hay.includes(k))
    })
  }

  const withMatch = creators.map((c) => ({ creator: c, match: matchScore(c, criteria) }))

  if (tab === 'rising') withMatch.sort((a, b) => b.creator.rankDelta - a.creator.rankDelta || b.match - a.match)
  else if (tab === 'new')
    withMatch.sort((a, b) => new Date(b.creator.createdAt) - new Date(a.creator.createdAt))
  else {
    switch (sort) {
      case 'followers':
        withMatch.sort((a, b) => b.creator.totalFollowers - a.creator.totalFollowers)
        break
      case 'engagement':
        withMatch.sort((a, b) => b.creator.engagementRate - a.creator.engagementRate)
        break
      case 'price':
        withMatch.sort((a, b) => (a.creator.ratePost || 99999) - (b.creator.ratePost || 99999))
        break
      case 'rating':
        withMatch.sort((a, b) => b.creator.ratingAvg - a.creator.ratingAvg)
        break
      case 'score':
        withMatch.sort((a, b) => b.creator.score - a.creator.score)
        break
      default:
        // Sin criterios activos la portada muestra el ranking oficial; con
        // criterios manda la afinidad y los destacados solo desempatan.
        if (hasCriteria(criteria)) {
          withMatch.sort(
            (a, b) =>
              b.match - a.match ||
              Number(b.creator.featured) - Number(a.creator.featured) ||
              b.creator.score - a.creator.score,
          )
        } else {
          // rankPosition 0 significa "aun sin ranking": va al final, no al principio.
          const pos = (c) => c.rankPosition || Number.MAX_SAFE_INTEGER
          withMatch.sort((a, b) => pos(a.creator) - pos(b.creator) || b.creator.score - a.creator.score)
        }
    }
  }

  const total = withMatch.length
  const start = (page - 1) * pageSize
  const items = withMatch
    .slice(start, start + pageSize)
    .map(({ creator, match }, idx) => publicCreator(creator, { match, listPosition: start + idx + 1 }))

  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const criteria = criteriaFromQuery(req.query)
    const result = await searchCreators(criteria, {
      sort: req.query.sort || 'relevance',
      tab: req.query.tab || 'top',
      page: Math.max(1, Number(req.query.page) || 1),
      pageSize: Math.min(48, Number(req.query.pageSize) || 12),
    })

    // Marca los guardados si quien consulta es una empresa.
    if (req.user?.brand) {
      const saved = await prisma.savedCreator.findMany({
        where: { brandId: req.user.brand.id },
        select: { creatorId: true },
      })
      const ids = new Set(saved.map((s) => s.creatorId))
      result.items = result.items.map((c) => ({ ...c, saved: ids.has(c.id) }))
    }

    res.json(result)
  }),
)

router.get(
  '/me',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const creator = await prisma.creator.findUnique({
      where: { userId: req.user.id },
      include: CREATOR_INCLUDE,
    })
    res.json({ creator: publicCreator(creator) })
  }),
)

const updateCreatorSchema = z.object({
  displayName: z.string().min(2).optional(),
  headline: z.string().max(140).optional(),
  bio: z.string().max(800).optional(),
  category: z.string().optional(),
  subcategories: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  languages: z.string().optional(),
  available: z.boolean().optional(),
  avatarUrl: z.string().optional(),
  coverUrl: z.string().optional(),
  audienceCountry: z.string().optional(),
  audienceFemalePct: z.number().min(0).max(100).optional(),
  audienceAgeRange: z.string().optional(),
  ratePost: z.number().min(0).optional(),
  rateReel: z.number().min(0).optional(),
  rateStory: z.number().min(0).optional(),
  rateUgc: z.number().min(0).optional(),
  responseHours: z.number().min(1).max(168).optional(),
})

router.patch(
  '/me',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const data = parseBody(updateCreatorSchema, req.body)
    await prisma.creator.update({ where: { userId: req.user.id }, data })
    const creator = await recomputeCreator(req.user.creator.id)
    res.json({ creator: publicCreator(creator) })
  }),
)

const socialSchema = z.object({
  platform: z.enum(['instagram', 'tiktok', 'youtube']),
  handle: z.string().min(1),
  url: z.string().optional(),
  followers: z.number().min(0),
  engagement: z.number().min(0).max(100),
  avgViews: z.number().min(0).optional(),
})

router.put(
  '/me/social',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const data = parseBody(socialSchema, req.body)
    const creatorId = req.user.creator.id
    await prisma.socialAccount.upsert({
      where: { creatorId_platform: { creatorId, platform: data.platform } },
      update: data,
      create: { ...data, creatorId },
    })
    const creator = await recomputeCreator(creatorId)
    res.json({ creator: publicCreator(creator) })
  }),
)

router.delete(
  '/me/social/:platform',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const creatorId = req.user.creator.id
    await prisma.socialAccount.deleteMany({ where: { creatorId, platform: req.params.platform } })
    const creator = await recomputeCreator(creatorId)
    res.json({ creator: publicCreator(creator) })
  }),
)

const portfolioSchema = z.object({
  imageUrl: z.string().min(4),
  caption: z.string().optional(),
  platform: z.string().optional(),
  likes: z.number().min(0).optional(),
})

router.post(
  '/me/portfolio',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const data = parseBody(portfolioSchema, req.body)
    const creatorId = req.user.creator.id
    const count = await prisma.portfolioItem.count({ where: { creatorId } })
    const item = await prisma.portfolioItem.create({ data: { ...data, creatorId, position: count } })
    res.status(201).json({ item })
  }),
)

router.delete(
  '/me/portfolio/:id',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const item = await prisma.portfolioItem.findUnique({ where: { id: req.params.id } })
    if (!item) throw notFound('Pieza no encontrada')
    if (item.creatorId !== req.user.creator.id) throw forbidden()
    await prisma.portfolioItem.delete({ where: { id: item.id } })
    res.json({ ok: true })
  }),
)

router.get(
  '/:handle',
  asyncHandler(async (req, res) => {
    const creator = await prisma.creator.findFirst({
      where: { OR: [{ handle: req.params.handle }, { id: req.params.handle }] },
      include: {
        ...CREATOR_INCLUDE,
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { author: { select: { name: true, avatarUrl: true } } },
        },
      },
    })
    if (!creator) throw notFound('Creador no encontrado')

    const similar = await prisma.creator.findMany({
      where: { category: creator.category, id: { not: creator.id }, available: true },
      include: CREATOR_INCLUDE,
      orderBy: { score: 'desc' },
      take: 4,
    })

    let saved = false
    if (req.user?.brand) {
      saved = !!(await prisma.savedCreator.findUnique({
        where: { brandId_creatorId: { brandId: req.user.brand.id, creatorId: creator.id } },
      }))
    }

    res.json({
      creator: publicCreator(creator, {
        saved,
        scoreBreakdown: computeScore(creator),
        reviews: creator.reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          author: r.author,
        })),
      }),
      similar: similar.map((c) => publicCreator(c)),
    })
  }),
)

export default router
