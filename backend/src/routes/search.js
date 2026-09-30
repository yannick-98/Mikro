import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { asyncHandler } from '../lib/http.js'
import { parseQuery } from '../services/nlq.js'
import { searchCreators } from './creators.js'
import { CATEGORIES, CITIES, FOLLOWER_TIERS, PLATFORMS } from '../services/taxonomy.js'

const router = Router()

/**
 * Busqueda en lenguaje natural.
 * Devuelve los filtros deducidos para que la interfaz los muestre como chips
 * editables: el usuario ve por que se le ensena cada resultado.
 */
router.post(
  '/ai',
  asyncHandler(async (req, res) => {
    const { query = '', page = 1, pageSize = 12 } = req.body || {}
    const { filters, interpretation } = parseQuery(query)

    // La busqueda libre no debe devolver cero resultados por un filtro duro:
    // se usa modo no estricto y la afinidad se encarga de ordenar.
    const result = await searchCreators(
      { ...filters, keywords: [] },
      { sort: 'relevance', page: Number(page) || 1, pageSize: Number(pageSize) || 12, strict: false },
    )

    res.json({ query, filters, interpretation, ...result })
  }),
)

router.get(
  '/facets',
  asyncHandler(async (_req, res) => {
    // Cada categoria lleva la foto de su creador mejor posicionado: da vida a
    // los filtros y evita depender de un banco de imagenes.
    const faces = await prisma.creator.findMany({
      where: { available: true },
      orderBy: { score: 'desc' },
      select: { category: true, avatarUrl: true, displayName: true },
    })
    const categoryCards = CATEGORIES.map((name) => {
      const face = faces.find((f) => f.category === name)
      return { name, imageUrl: face?.avatarUrl || null, topCreator: face?.displayName || null }
    })

    res.json({
      categories: CATEGORIES,
      categoryCards,
      cities: CITIES,
      platforms: PLATFORMS,
      followerTiers: FOLLOWER_TIERS,
      languages: ['Espanol', 'Ingles', 'Catalan', 'Euskera', 'Gallego', 'Frances', 'Portugues'],
      audienceCountries: ['Espana', 'Latinoamerica', 'Europa', 'Global'],
    })
  }),
)

const EXAMPLES = [
  'creadores de gastronomia en Valencia con 20k-100k seguidores',
  'micro influencers de fitness en Madrid con engagement alto',
  'perfiles de moda en Barcelona para tiktok, presupuesto 300 euros',
  'creadores de tecnologia con mas de 50k seguidores en youtube',
  'cuentas de mascotas en Sevilla con audiencia femenina',
]

router.get('/examples', (_req, res) => res.json({ examples: EXAMPLES }))

export default router
