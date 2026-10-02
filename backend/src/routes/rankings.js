import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { asyncHandler } from '../lib/http.js'
import { publicCache, remember } from '../lib/cache.js'
import { publicCreator } from '../services/serialize.js'
import { CATEGORIES, CITIES } from '../services/taxonomy.js'

const router = Router()

const INCLUDE = { socialAccounts: true, portfolio: { orderBy: { position: 'asc' }, take: 4 } }

// Sin sesion el ranking es un escaparate: los diez primeros del global y nada
// mas. Los cortes por categoria, ciudad o plataforma son la herramienta de
// trabajo, y esa vive dentro de la aplicacion.
const PUBLIC_LIMIT = 10

/**
 * Ranking. scope: global | category | city | platform
 * El periodo afecta al movimiento mostrado, no al orden (el score es acumulado).
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const anonymous = !req.user
    const scope = anonymous ? 'global' : req.query.scope || 'global'
    const value = anonymous ? undefined : req.query.value
    const take = anonymous
      ? PUBLIC_LIMIT
      : Math.min(100, Number(req.query.limit) || 20)

    const query = async () => {
      const where = { available: true }
      if (scope === 'category' && value) where.category = value
      if (scope === 'city' && value) where.city = value

      let creators = await prisma.creator.findMany({
        where,
        include: INCLUDE,
        orderBy: [{ score: 'desc' }, { totalFollowers: 'desc' }],
        take: scope === 'platform' ? 300 : take,
      })

      if (scope === 'platform' && value) {
        creators = creators
          .filter((c) => c.socialAccounts.some((a) => a.platform === value))
          .slice(0, take)
      }

      return creators.map((c, i) => publicCreator(c, { listPosition: i + 1 }))
    }

    // El ranking publico es el mismo para todo el mundo y cambia una vez al
    // dia: no tiene sentido ir a la base en cada visita a la portada.
    const items = anonymous ? await remember('rankings:public', 120, query) : await query()
    if (anonymous) publicCache(res, { maxAge: 120, swr: 600 })

    res.json({ scope, value: value || null, limited: anonymous, items })
  }),
)

/** Creadores que mas han subido o bajado: alimenta "Movimientos de hoy". */
router.get(
  '/movers',
  asyncHandler(async (req, res) => {
    const take = Math.min(20, Number(req.query.limit) || 6)
    const creators = await prisma.creator.findMany({
      where: { available: true, NOT: { rankDelta: 0 } },
      include: { socialAccounts: true },
      take: 200,
    })
    // Se mezclan subidas y bajadas: un widget con solo subidas no informa.
    const ups = creators.filter((c) => c.rankDelta > 0).sort((a, b) => b.rankDelta - a.rankDelta)
    const downs = creators.filter((c) => c.rankDelta < 0).sort((a, b) => a.rankDelta - b.rankDelta)
    const sorted = []
    for (let i = 0; sorted.length < take && (i < ups.length || i < downs.length); i += 1) {
      if (ups[i]) sorted.push(ups[i])
      if (sorted.length < take && downs[i]) sorted.push(downs[i])
    }
    res.json({
      items: sorted.map((c) => ({
        id: c.id,
        handle: c.handle,
        displayName: c.displayName,
        avatarUrl: c.avatarUrl,
        category: c.category,
        rankPosition: c.rankPosition,
        rankDelta: c.rankDelta,
      })),
    })
  }),
)

/** Listas destacadas de la home de rankings. */
router.get(
  '/collections',
  asyncHandler(async (_req, res) => {
    const byCategory = await Promise.all(
      CATEGORIES.slice(0, 8).map(async (category) => {
        const items = await prisma.creator.findMany({
          where: { category, available: true },
          include: INCLUDE,
          orderBy: { score: 'desc' },
          take: 3,
        })
        return { category, items: items.map((c, i) => publicCreator(c, { listPosition: i + 1 })) }
      }),
    )

    const byCity = await Promise.all(
      CITIES.slice(0, 6).map(async (city) => {
        const count = await prisma.creator.count({ where: { city, available: true } })
        return { city, count }
      }),
    )

    res.json({ byCategory, byCity })
  }),
)

export default router
