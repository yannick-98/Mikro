/**
 * API de la app de Shopify incrustada.
 *
 * Todo lo de aqui habla con el admin de Shopify, no con la web de Mikro: la
 * sesion la abre el token que da App Bridge, no el inicio de sesion normal.
 */
import { Router } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { asyncHandler, badRequest, conflict, forbidden, notFound, parseBody, unauthorized } from '../lib/http.js'
import { verifyPassword } from '../lib/auth.js'
import { shopifyConfigured, toShopDomain } from '../shopify/config.js'
import { verifySessionToken } from '../shopify/verify.js'
import { exchangeSessionToken } from '../shopify/tokens.js'
import { adminGraphql, SHOP_QUERY } from '../shopify/admin.js'
import { ensureWebhooks } from '../shopify/webhooks.js'
import { buildCode, createDiscount, deactivateDiscount, normalizeCode } from '../shopify/discounts.js'

const router = Router()

const SECRET = () => process.env.JWT_SECRET || 'mikro-dev-secret'
const SESSION_HOURS = 12

/**
 * Sesion propia de la tienda.
 *
 * No se reutiliza el token de usuario de Mikro: quien entra aqui es una
 * tienda, no una persona con cuenta, y mezclar las dos cosas acabaria dando
 * permisos de empresa a quien solo ha instalado una app.
 */
const signShopToken = (shopDomain) =>
  jwt.sign({ shop: shopDomain, kind: 'shopify' }, SECRET(), { expiresIn: `${SESSION_HOURS}h` })

const requireShop = asyncHandler(async (req, _res, next) => {
  const header = req.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) throw unauthorized('Falta la sesion de la tienda')

  let payload
  try {
    payload = jwt.verify(token, SECRET())
  } catch {
    throw unauthorized('La sesion de la tienda ha caducado')
  }
  if (payload.kind !== 'shopify' || !toShopDomain(payload.shop)) throw unauthorized('Sesion no valida')

  const shop = await prisma.shopifyShop.findUnique({
    where: { domain: payload.shop },
    include: { brand: true },
  })
  if (!shop || shop.uninstalledAt) throw unauthorized('La tienda ya no tiene la app instalada')

  req.shop = shop
  next()
})

/** La tienda tiene que haberse vinculado a una cuenta de empresa. */
const requireLinked = (req, _res, next) => {
  if (!req.shop?.brandId) throw forbidden('Vincula la tienda con tu cuenta de Mikro primero')
  next()
}

const publicShop = (shop) => ({
  domain: shop.domain,
  name: shop.name,
  currency: shop.currency,
  linked: !!shop.brandId,
  brand: shop.brand ? { id: shop.brand.id, companyName: shop.brand.companyName } : null,
})

// ---------------------------------------------------------------------------
// Apertura de la app
// ---------------------------------------------------------------------------

/**
 * Abre la sesion desde el token de App Bridge.
 *
 * El token de sesion solo dice quien pregunta; para hablar con la Admin API
 * hay que canjearlo. Eso se hace aqui, una vez, y se guarda el resultado.
 */
router.post(
  '/session',
  asyncHandler(async (req, res) => {
    if (!shopifyConfigured()) throw badRequest('La app de Shopify no esta configurada en este entorno')

    const { sessionToken } = parseBody(z.object({ sessionToken: z.string().min(20) }), req.body)

    let datos
    try {
      datos = verifySessionToken(sessionToken)
    } catch (e) {
      throw unauthorized(e.message)
    }

    const credenciales = await exchangeSessionToken(datos.shop, sessionToken)

    const shop = await prisma.shopifyShop.upsert({
      where: { domain: datos.shop },
      create: { domain: datos.shop, ...credenciales },
      update: { ...credenciales, uninstalledAt: null },
      include: { brand: true },
    })

    // Los datos de la tienda y las suscripciones son utiles pero no criticos:
    // si Shopify falla aqui, la app tiene que abrirse igual.
    try {
      const info = await adminGraphql(datos.shop, SHOP_QUERY)
      if (info?.shop) {
        await prisma.shopifyShop.update({
          where: { id: shop.id },
          data: {
            name: info.shop.name,
            email: info.shop.email,
            currency: info.shop.currencyCode || 'EUR',
            countryCode: info.shop.shopAddress?.countryCodeV2 || null,
            planName: info.shop.plan?.publicDisplayName || null,
          },
        })
        shop.name = info.shop.name
        shop.currency = info.shop.currencyCode || shop.currency
      }
      await ensureWebhooks(datos.shop)
    } catch (e) {
      console.warn('[shopify] apertura parcial:', e?.message)
    }

    res.json({ token: signShopToken(datos.shop), shop: publicShop(shop) })
  }),
)

/**
 * Vincula la tienda con una cuenta de empresa de Mikro.
 *
 * Se pide la contrasena de la cuenta porque enlazar una tienda a una empresa
 * es dar acceso a sus campanas: que alguien tenga el admin de la tienda no
 * demuestra que sea el dueno de la cuenta de Mikro.
 */
router.post(
  '/link',
  requireShop,
  asyncHandler(async (req, res) => {
    const { email, password } = parseBody(
      z.object({ email: z.string().email(), password: z.string().min(1) }),
      req.body,
    )

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { brand: true },
    })
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthorized('Email o contrasena incorrectos')
    }
    if (user.role !== 'BRAND' || !user.brand) throw forbidden('Esa cuenta no es de empresa')

    const ocupada = await prisma.shopifyShop.findFirst({
      where: { brandId: user.brand.id, NOT: { id: req.shop.id } },
    })
    if (ocupada) throw badRequest(`Esa cuenta ya esta vinculada a ${ocupada.domain}`)

    const shop = await prisma.shopifyShop.update({
      where: { id: req.shop.id },
      data: { brandId: user.brand.id },
      include: { brand: true },
    })
    res.json({ shop: publicShop(shop) })
  }),
)

router.post(
  '/unlink',
  requireShop,
  asyncHandler(async (req, res) => {
    const shop = await prisma.shopifyShop.update({
      where: { id: req.shop.id },
      data: { brandId: null },
      include: { brand: true },
    })
    res.json({ shop: publicShop(shop) })
  }),
)

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

/**
 * Creadores de una campana.
 *
 * Primero quienes ya colaboran, despues quienes se han postulado. Dar a elegir
 * entre los 75 creadores del catalogo no ayudaria: el codigo es para quien va
 * a publicar algo.
 */
router.get(
  '/campaigns/:id/creators',
  requireShop,
  requireLinked,
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } })
    if (!campaign || campaign.brandId !== req.shop.brandId) throw notFound('Esa campana no es de esta tienda')

    const seleccion = { id: true, handle: true, displayName: true, avatarUrl: true, category: true }
    const [deals, applications] = await Promise.all([
      prisma.deal.findMany({ where: { campaignId: campaign.id }, include: { creator: { select: seleccion } } }),
      prisma.application.findMany({
        where: { campaignId: campaign.id, status: { in: ['PENDING', 'ACCEPTED'] } },
        include: { creator: { select: seleccion } },
      }),
    ])

    const vistos = new Set()
    const items = []
    for (const d of deals) {
      if (d.creator && !vistos.has(d.creator.id)) {
        vistos.add(d.creator.id)
        items.push({ ...d.creator, relacion: 'colabora' })
      }
    }
    for (const a of applications) {
      if (a.creator && !vistos.has(a.creator.id)) {
        vistos.add(a.creator.id)
        items.push({ ...a.creator, relacion: 'candidatura' })
      }
    }
    res.json({ items })
  }),
)

/** Lo que ve la tienda al abrir la app: campanas, codigos y ventas. */
router.get(
  '/overview',
  requireShop,
  asyncHandler(async (req, res) => {
    const shop = req.shop
    if (!shop.brandId) return res.json({ shop: publicShop(shop), campaigns: [], totals: null })

    const [campaigns, attributions] = await Promise.all([
      prisma.campaign.findMany({
        where: { brandId: shop.brandId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { _count: { select: { applications: true, deals: true } } },
      }),
      prisma.shopifyAttribution.findMany({
        where: { shopId: shop.id },
        orderBy: { createdAt: 'desc' },
        include: { creator: { select: { handle: true, displayName: true, avatarUrl: true } } },
      }),
    ])

    const porCampana = new Map()
    for (const a of attributions) {
      const lista = porCampana.get(a.campaignId) || []
      lista.push({
        id: a.id,
        code: a.code,
        percentage: a.percentage,
        status: a.status,
        ordersCount: a.ordersCount,
        salesTotal: a.salesTotal,
        refundedTotal: a.refundedTotal,
        netTotal: a.salesTotal - a.refundedTotal,
        creator: a.creator,
      })
      porCampana.set(a.campaignId, lista)
    }

    res.json({
      shop: publicShop(shop),
      campaigns: campaigns.map((c) => {
        const codigos = porCampana.get(c.id) || []
        return {
          id: c.id,
          title: c.title,
          status: c.status,
          budgetMin: c.budgetMin,
          budgetMax: c.budgetMax,
          applications: c._count.applications,
          deals: c._count.deals,
          attributions: codigos,
          ordersCount: codigos.reduce((s, a) => s + a.ordersCount, 0),
          salesTotal: codigos.reduce((s, a) => s + a.salesTotal, 0),
          refundedTotal: codigos.reduce((s, a) => s + a.refundedTotal, 0),
          netTotal: codigos.reduce((s, a) => s + a.netTotal, 0),
        }
      }),
      totals: {
        currency: shop.currency,
        ordersCount: attributions.reduce((s, a) => s + a.ordersCount, 0),
        salesTotal: attributions.reduce((s, a) => s + a.salesTotal, 0),
        refundedTotal: attributions.reduce((s, a) => s + a.refundedTotal, 0),
        netTotal: attributions.reduce((s, a) => s + a.salesTotal - a.refundedTotal, 0),
        activeCodes: attributions.filter((a) => a.status === 'ACTIVE').length,
      },
    })
  }),
)

/**
 * Crea el codigo de una colaboracion.
 *
 * El codigo se guarda solo si Shopify lo ha creado de verdad: al reves
 * tendriamos codigos en el panel que no funcionan en la tienda.
 */
router.post(
  '/attributions',
  requireShop,
  requireLinked,
  asyncHandler(async (req, res) => {
    const data = parseBody(
      z.object({
        campaignId: z.string().min(1),
        creatorId: z.string().min(1).optional(),
        percentage: z.number().int().min(1).max(60).default(10),
        code: z.string().trim().max(40).optional(),
        endsAt: z.string().datetime().optional(),
        oncePerCustomer: z.boolean().default(false),
      }),
      req.body,
    )

    const campaign = await prisma.campaign.findUnique({ where: { id: data.campaignId } })
    if (!campaign || campaign.brandId !== req.shop.brandId) throw notFound('Esa campana no es de esta tienda')

    const creator = data.creatorId
      ? await prisma.creator.findUnique({ where: { id: data.creatorId } })
      : null
    if (data.creatorId && !creator) throw notFound('Ese creador no existe')

    // Si la tienda escribe su propio codigo, manda el suyo; si no, se genera.
    const code = data.code ? normalizeCode(data.code) : buildCode(creator?.handle || campaign.title)
    if (data.code && code.length < 3) throw badRequest('El codigo necesita al menos 3 letras o numeros')

    // Dos codigos iguales en la misma tienda romperian la atribucion: el
    // webhook no sabria a cual de las dos colaboraciones apuntar la venta.
    const repetido = await prisma.shopifyAttribution.findFirst({
      where: { shopId: req.shop.id, code },
    })
    if (repetido) throw conflict(`El codigo ${code} ya esta en uso en esta tienda`)

    const discountGid = await createDiscount(req.shop.domain, {
      code,
      title: `Mikro · ${campaign.title}${creator ? ` · ${creator.displayName}` : ''}`,
      percentage: data.percentage,
      endsAt: data.endsAt,
      oncePerCustomer: data.oncePerCustomer,
    })

    const attribution = await prisma.shopifyAttribution.create({
      data: {
        shopId: req.shop.id,
        campaignId: campaign.id,
        creatorId: creator?.id || null,
        code,
        discountGid,
        percentage: data.percentage,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    })

    res.status(201).json({ attribution })
  }),
)

/** Retira un codigo sin borrar el historico de ventas. */
router.post(
  '/attributions/:id/end',
  requireShop,
  requireLinked,
  asyncHandler(async (req, res) => {
    const attribution = await prisma.shopifyAttribution.findUnique({ where: { id: req.params.id } })
    if (!attribution || attribution.shopId !== req.shop.id) throw notFound('Ese codigo no existe')

    if (attribution.discountGid) {
      try {
        await deactivateDiscount(req.shop.domain, attribution.discountGid)
      } catch (e) {
        console.warn('[shopify] no se pudo desactivar en Shopify:', e?.message)
      }
    }

    const actualizada = await prisma.shopifyAttribution.update({
      where: { id: attribution.id },
      data: { status: 'ENDED' },
    })
    res.json({ attribution: actualizada })
  }),
)

export default router
