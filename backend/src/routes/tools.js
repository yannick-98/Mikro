/**
 * Las herramientas que quitan los bloqueos del dia a dia.
 *
 *  - precio de referencia: lo que se paga de verdad, para los dos lados;
 *  - informe de campana: que paso con el dinero;
 *  - asistente de brief: la pagina en blanco;
 *  - media kit: la carta de presentacion del creador.
 *
 * Van juntas porque comparten una idea: todas convierten datos que Mikro ya
 * tiene en una respuesta que hoy el usuario no sabe buscar.
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { asyncHandler, badRequest, notFound, parseBody } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { explicar, precioDeReferencia } from '../services/pricing.js'
import { informeDeCampana } from '../services/report.js'
import { PREGUNTAS, redactarBrief } from '../services/brief.js'
import { publicCreator } from '../services/serialize.js'

const router = Router()

// ---------------------------------------------------------------------------
// Precio de referencia
// ---------------------------------------------------------------------------

/**
 * Cuanto se paga por algo asi.
 *
 * Publico a proposito: es la cifra que hace que alguien se registre. Un
 * creador que descubre que su tramo cobra el doble de lo que el pedia se queda
 * en Mikro por eso solo.
 */
router.get(
  '/pricing',
  asyncHandler(async (req, res) => {
    const ref = await precioDeReferencia({
      sector: req.query.sector || undefined,
      city: req.query.city || undefined,
      followers: req.query.followers ? Number(req.query.followers) : undefined,
      engagement: req.query.engagement ? Number(req.query.engagement) : undefined,
    })
    res.json({ ...ref, texto: explicar(ref) })
  }),
)

/** El mismo calculo, pero para mi: coge mis datos y no hace falta pedirlos. */
router.get(
  '/pricing/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user.role === 'CREATOR') {
      const c = req.user.creator
      const ref = await precioDeReferencia({
        city: c.city,
        followers: c.totalFollowers,
        engagement: c.engagementRate,
      })
      return res.json({ ...ref, texto: explicar(ref), para: 'creador' })
    }
    const b = req.user.brand
    const ref = await precioDeReferencia({ sector: b?.sector, city: b?.city })
    res.json({ ...ref, texto: explicar(ref), para: 'empresa' })
  }),
)

// ---------------------------------------------------------------------------
// Informe de campana
// ---------------------------------------------------------------------------

router.get(
  '/campaigns/:id/report',
  requireAuth,
  asyncHandler(async (req, res) => {
    const informe = await informeDeCampana(req.params.id, {
      // Un administrador puede ver cualquiera; una empresa, solo las suyas.
      brandId: req.user.role === 'ADMIN' ? undefined : req.user.brand?.id,
    })
    if (!informe) throw notFound('Esa campaña no existe o no es tuya')
    res.json(informe)
  }),
)

// ---------------------------------------------------------------------------
// Asistente de brief
// ---------------------------------------------------------------------------

/** Las preguntas, para que la interfaz no las tenga duplicadas. */
router.get(
  '/brief/questions',
  asyncHandler(async (_req, res) => res.json({ preguntas: PREGUNTAS })),
)

router.post(
  '/brief',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const datos = parseBody(
      z.object({
        respuestas: z.object({
          producto: z.string().trim().max(400).optional(),
          objetivo: z.enum(['ventas', 'notoriedad', 'lanzamiento', 'contenido']).optional(),
          publico: z.string().trim().max(400).optional(),
          imprescindible: z.string().trim().max(600).optional(),
        }),
        campaign: z
          .object({
            targetCity: z.string().trim().max(80).optional(),
            budgetMin: z.number().int().optional(),
            budgetMax: z.number().int().optional(),
          })
          .optional(),
      }),
      req.body,
    )

    if (!datos.respuestas.producto) throw badRequest('Dinos al menos qué quieres que se enseñe')

    res.json(
      redactarBrief({
        respuestas: datos.respuestas,
        brand: req.user.brand || {},
        campaign: datos.campaign || {},
      }),
    )
  }),
)

// ---------------------------------------------------------------------------
// Media kit
// ---------------------------------------------------------------------------

/**
 * La carta de presentacion publica de un creador.
 *
 * Sin sesion: su gracia es que se pueda pegar en una bio y que la abra
 * cualquiera. Lo que ensena es lo que el creador ya tiene publicado en Mikro,
 * mas sus resultados reales; no hay nada aqui que no estuviera ya en su ficha.
 *
 * Las tarifas se incluyen porque el motivo de existir de esta pagina es que
 * una marca pueda decidir sin escribir un DM a ciegas, que es exactamente el
 * problema que Mikro resuelve.
 */
router.get(
  '/mediakit/:handle',
  asyncHandler(async (req, res) => {
    const creator = await prisma.creator.findUnique({
      where: { handle: req.params.handle },
      include: {
        socialAccounts: true,
        portfolio: { orderBy: { position: 'asc' } },
        reviews: {
          take: 3,
          orderBy: { createdAt: 'desc' },
          where: { comment: { not: null } },
          select: { rating: true, comment: true, createdAt: true },
        },
      },
    })
    if (!creator) throw notFound('No encontramos ese perfil')

    // Las mejores publicaciones recientes de sus cuentas conectadas: es la
    // prueba de lo que hace, y vale mas que cualquier descripcion.
    const cuentas = creator.socialAccounts.filter((a) => a.source === 'CONNECTED').map((a) => a.id)
    const mejores = cuentas.length
      ? await prisma.socialPost.findMany({
          where: { accountId: { in: cuentas } },
          orderBy: [{ likes: 'desc' }],
          take: 6,
          select: {
            permalink: true,
            thumbnailUrl: true,
            caption: true,
            likes: true,
            comments: true,
            views: true,
            mediaType: true,
            publishedAt: true,
          },
        })
      : []

    // Lo que han vendido sus codigos. Para un micro-influencer esto no es una
    // metrica mas: es el unico argumento que convierte "tengo 20.000
    // seguidores" en "traigo clientes".
    const ventas = await prisma.shopifyAttribution.aggregate({
      where: { creatorId: creator.id },
      _sum: { ordersCount: true, salesTotal: true, refundedTotal: true },
    })
    const neto = (ventas._sum.salesTotal || 0) - (ventas._sum.refundedTotal || 0)

    res.json({
      creator: publicCreator(creator),
      publicaciones: mejores,
      resultados: {
        colaboraciones: creator.completedDeals,
        valoracion: creator.ratingCount ? creator.ratingAvg : null,
        valoraciones: creator.ratingCount,
        // Solo si hay algo que ensenar: un cero aqui parece un suspenso cuando
        // en realidad significa que todavia no ha habido ninguna campana con
        // tienda conectada.
        pedidos: ventas._sum.ordersCount || null,
        ventas: neto > 0 ? Math.round(neto) : null,
      },
      opiniones: creator.reviews,
    })
  }),
)

export default router
