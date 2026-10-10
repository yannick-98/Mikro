/**
 * Webhooks de Shopify.
 *
 * Este router se monta con el cuerpo en crudo y ANTES del express.json()
 * general: la firma se calcula sobre los bytes tal cual llegan, y en cuanto
 * un parser los interpreta y los vuelve a serializar deja de cuadrar.
 *
 * Reglas que impone Shopify y que aqui se cumplen al pie de la letra:
 *  - firma invalida -> 401, sin tocar nada;
 *  - todo lo demas -> 2xx, incluso si no sabemos que hacer con el mensaje,
 *    porque un 500 hace que Shopify reintente y acabe quitando la suscripcion;
 *  - responder rapido, y nunca hacer esperar al emisor por trabajo nuestro.
 */
import { Router } from 'express'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { webhookSignatureValid } from '../shopify/verify.js'
import { toShopDomain } from '../shopify/config.js'

const router = Router()

// El cuerpo llega como Buffer. type: '*/*' porque Shopify no siempre manda el
// Content-Type que uno espera y un webhook sin parsear es un webhook perdido.
router.use(express.raw({ type: '*/*', limit: '2mb' }))

/**
 * Puerta de entrada: firma, tienda y deduplicacion.
 *
 * Devuelve null cuando ya se ha respondido, para que el manejador se calle.
 */
async function entrada(req, res) {
  const firma = req.get('X-Shopify-Hmac-Sha256')
  if (!webhookSignatureValid(req.body, firma)) {
    res.status(401).json({ error: 'Firma no valida' })
    return null
  }

  const shopDomain = toShopDomain(req.get('X-Shopify-Shop-Domain'))
  if (!shopDomain) {
    res.status(200).json({ ok: true })
    return null
  }

  const webhookId = req.get('X-Shopify-Webhook-Id')
  const topic = req.get('X-Shopify-Topic') || 'desconocido'

  // Shopify entrega "al menos una vez": sin esta marca, un reintento sumaria
  // dos veces la misma venta. createMany con skipDuplicates resuelve la carrera
  // entre dos entregas simultaneas sin transaccion.
  if (webhookId) {
    const { count } = await prisma.shopifyWebhookEvent.createMany({
      data: [{ id: webhookId, topic, shopDomain }],
      skipDuplicates: true,
    })
    if (count === 0) {
      res.status(200).json({ ok: true, repetido: true })
      return null
    }
  }

  let payload = {}
  try {
    payload = JSON.parse(req.body.toString('utf8') || '{}')
  } catch {
    // Un cuerpo ilegible firmado por Shopify no es algo que vaya a mejorar
    // reintentando: se acepta y se descarta.
    res.status(200).json({ ok: true })
    return null
  }

  return { shopDomain, topic, payload }
}

/** Envuelve un manejador para que ningun fallo nuestro provoque reintentos. */
const webhook = (handler) => async (req, res) => {
  try {
    const ctx = await entrada(req, res)
    if (!ctx) return
    await handler(ctx, req, res)
    if (!res.headersSent) res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[shopify] fallo procesando el webhook:', e?.message)
    // 200 a conciencia: el mensaje ya esta marcado como recibido y volver a
    // pedirlo no arreglaria un error nuestro.
    if (!res.headersSent) res.status(200).json({ ok: true })
  }
}

/**
 * Pedido nuevo o pagado: aqui es donde se mide la venta.
 *
 * Se mira el codigo de descuento del pedido y se busca a quien pertenece. Un
 * pedido sin codigo conocido se ignora: no toda venta de la tienda viene de
 * una campana, y apuntarsela a alguien seria mentir en el panel.
 */
const onOrder = webhook(async ({ shopDomain, payload }) => {
  const shop = await prisma.shopifyShop.findUnique({ where: { domain: shopDomain } })
  if (!shop) return

  const codigos = (payload.discount_codes || [])
    .map((d) => (d?.code || '').toUpperCase())
    .filter(Boolean)
  if (!codigos.length) return

  const atribucion = await prisma.shopifyAttribution.findFirst({
    where: { shopId: shop.id, code: { in: codigos } },
  })
  if (!atribucion) return

  const orderGid = payload.admin_graphql_api_id || `gid://shopify/Order/${payload.id}`
  const total = Number(payload.total_price ?? payload.current_total_price ?? 0) || 0

  // Un pedido ya guardado no vuelve a sumar: el webhook de creado y el de
  // pagado hablan del mismo pedido, y los dos llegan.
  const existente = await prisma.shopifyOrder.findUnique({
    where: { shopId_orderGid: { shopId: shop.id, orderGid } },
  })
  if (existente) return

  await prisma.$transaction([
    prisma.shopifyOrder.create({
      data: {
        shopId: shop.id,
        attributionId: atribucion.id,
        orderGid,
        orderNumber: payload.name || String(payload.order_number || ''),
        totalPrice: total,
        currency: payload.currency || shop.currency,
        discountCode: codigos[0],
        processedAt: payload.processed_at ? new Date(payload.processed_at) : new Date(),
      },
    }),
    prisma.shopifyAttribution.update({
      where: { id: atribucion.id },
      data: { ordersCount: { increment: 1 }, salesTotal: { increment: total } },
    }),
  ])
})

router.post('/orders-create', onOrder)
router.post('/orders-paid', onOrder)

/** La tienda ha desinstalado: el token deja de valer, hay que soltarlo. */
router.post(
  '/app-uninstalled',
  webhook(async ({ shopDomain }) => {
    await prisma.shopifyShop.updateMany({
      where: { domain: shopDomain },
      data: { uninstalledAt: new Date(), accessToken: null, refreshToken: null, tokenExpires: null },
    })
  }),
)

// ---------------------------------------------------------------------------
// Webhooks de cumplimiento. Obligatorios para estar en la App Store.
// ---------------------------------------------------------------------------

/**
 * Peticion de datos de un cliente.
 *
 * Mikro no guarda datos de clientes de la tienda: la app no pide
 * read_customers y de los pedidos solo se queda el importe y el codigo. Se
 * responde 200 porque no hay nada que entregar, y eso es exactamente lo que
 * hay que contestar.
 */
router.post(
  '/customers-data-request',
  webhook(async ({ shopDomain }) => {
    console.log(`[shopify] peticion de datos de cliente de ${shopDomain}: no guardamos ninguno`)
  }),
)

/** Borrado de un cliente: igual que arriba, no hay nada suyo que borrar. */
router.post(
  '/customers-redact',
  webhook(async ({ shopDomain }) => {
    console.log(`[shopify] borrado de cliente de ${shopDomain}: no guardamos ninguno`)
  }),
)

/**
 * Borrado de la tienda, 48 h despues de desinstalar.
 *
 * Esto si borra: pedidos, atribuciones y la propia instalacion. Las campanas
 * y colaboraciones de Mikro no se tocan, que son de la empresa y no de la
 * tienda; solo se corta el vinculo.
 */
router.post(
  '/shop-redact',
  webhook(async ({ shopDomain }) => {
    const shop = await prisma.shopifyShop.findUnique({ where: { domain: shopDomain } })
    if (!shop) return
    await prisma.shopifyShop.delete({ where: { id: shop.id } })
    console.log(`[shopify] datos de ${shopDomain} eliminados`)
  }),
)

export default router
