import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { asyncHandler, badRequest, forbidden, notFound, parseBody } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { publicCampaign, publicCreator, publicBrand } from '../services/serialize.js'
import { recomputeCreator } from '../services/creatorStats.js'
import { notify } from '../services/notify.js'
import { emitirFacturas, publicInvoice } from '../services/invoice.js'
import { repartoDeal } from '../services/pay.js'
import { desgloseDe } from '../billing/planes.js'
import { stripeConfigured } from '../stripe/config.js'
import { abrirCobro, devolver, transferirAlCreador } from '../stripe/payments.js'
import { paypalConfigured } from '../paypal/config.js'
import { encolarPago } from '../paypal/payouts.js'

const router = Router()

const DEAL_INCLUDE = {
  campaign: { include: { brand: true } },
  brand: { include: { user: true } },
  creator: { include: { user: true, socialAccounts: true } },
  payments: true,
  reviews: true,
  submissions: { orderBy: { version: 'desc' } },
  invoices: true,
  // Las ventas atribuidas a esta colaboracion: de ahi sale el variable.
  shopifyLinks: true,
  _count: { select: { messages: true } },
}

function serializeDeal(deal, viewerRole) {
  return {
    id: deal.id,
    status: deal.status,
    fee: deal.fee,
    feePlatform: deal.feePlatform,
    netToCreator: desgloseDe(deal).creatorNet,
    // Lo que paga la empresa, que con plan es menos que el cache.
    brandPays: Math.round(desgloseDe(deal).brandCents) / 100,
    // El reparto separa lo seguro de lo que depende de las ventas. Nunca se
    // devuelve solo el total: juntarlos haria pasar una expectativa por un
    // sueldo.
    reparto: repartoDeal(deal, deal.shopifyLinks || []),
    contentUrl: deal.contentUrl,
    notes: deal.notes,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    campaign: publicCampaign(deal.campaign),
    brand: publicBrand(deal.brand),
    creator: publicCreator(deal.creator),
    // Los importes salen de los centimos cuando los hay: desde que hay
    // planes, lo que paga una empresa puede llevar medio euro.
    payments: (deal.payments || []).map((p) => ({
      ...p,
      amount: p.amountCents != null ? p.amountCents / 100 : p.amount,
    })),
    submissions: (deal.submissions || []).map((x) => ({
      id: x.id,
      version: x.version,
      url: x.url,
      note: x.note,
      status: x.status,
      feedback: x.feedback,
      createdAt: x.createdAt,
      reviewedAt: x.reviewedAt,
    })),
    invoices: (deal.invoices || []).map(publicInvoice),
    envio: {
      estado: deal.shipmentStatus,
      // La direccion solo la ve quien la necesita: el propio creador y la
      // empresa que tiene que mandar el paquete. Nadie mas pasa por aqui,
      // pero conviene que el serializador no la reparta por costumbre.
      nombre: deal.shippingName,
      direccion: deal.shippingAddress,
      telefono: deal.shippingPhone,
      transportista: deal.carrier,
      seguimiento: deal.trackingCode,
      nota: deal.shipmentNote,
      enviadoEl: deal.shippedAt,
      recibidoEl: deal.receivedAt,
    },
    messagesCount: deal._count?.messages ?? 0,
    reviewed: (deal.reviews || []).some((r) => r.authorId === deal.viewerId),
    viewerRole,
  }
}

/** Comprueba que el usuario participa en la colaboracion. */
async function loadDealFor(user, id) {
  const deal = await prisma.deal.findUnique({ where: { id }, include: DEAL_INCLUDE })
  if (!deal) throw notFound('Colaboracion no encontrada')
  const isBrand = user.brand && deal.brandId === user.brand.id
  const isCreator = user.creator && deal.creatorId === user.creator.id
  if (!isBrand && !isCreator && user.role !== 'ADMIN') throw forbidden()
  return { deal, isBrand, isCreator }
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const where = {}
    if (req.user.role === 'BRAND') where.brandId = req.user.brand.id
    else if (req.user.role === 'CREATOR') where.creatorId = req.user.creator.id
    if (req.query.status) where.status = req.query.status

    const deals = await prisma.deal.findMany({
      where,
      include: DEAL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    })
    res.json({ items: deals.map((d) => serializeDeal({ ...d, viewerId: req.user.id }, req.user.role)) })
  }),
)

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { deal } = await loadDealFor(req.user, req.params.id)
    const messages = await prisma.message.findMany({
      where: { dealId: deal.id },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json({
      deal: serializeDeal({ ...deal, viewerId: req.user.id }, req.user.role),
      messages,
    })
  }),
)

const messageSchema = z.object({ body: z.string().min(1, 'Escribe un mensaje').max(2000) })

router.post(
  '/:id/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { deal, isBrand } = await loadDealFor(req.user, req.params.id)
    const { body } = parseBody(messageSchema, req.body)

    const message = await prisma.message.create({
      data: { dealId: deal.id, senderId: req.user.id, body },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
    })

    await notify(isBrand ? deal.creator.userId : deal.brand.userId, {
      kind: 'MESSAGE',
      title: `Nuevo mensaje de ${req.user.name}`,
      body: body.slice(0, 120),
      link: isBrand ? '/creador/colaboraciones' : '/empresa/colaboraciones',
    })

    res.status(201).json({ message })
  }),
)

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().max(600).optional(),
})

/** Solo la empresa valora al creador (reputacion publica del marketplace). */
router.post(
  '/:id/review',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { deal, isBrand } = await loadDealFor(req.user, req.params.id)
    if (!isBrand) throw forbidden('Solo la empresa puede valorar la colaboracion')
    if (!['APPROVED', 'PAID'].includes(deal.status)) {
      throw badRequest('Solo se puede valorar una colaboracion completada')
    }
    const data = parseBody(reviewSchema, req.body)

    const review = await prisma.review.upsert({
      where: { dealId_authorId: { dealId: deal.id, authorId: req.user.id } },
      update: data,
      create: { ...data, dealId: deal.id, authorId: req.user.id, creatorId: deal.creatorId },
    })
    await recomputeCreator(deal.creatorId)

    await notify(deal.creator.userId, {
      kind: 'REVIEW',
      title: 'Nueva valoracion',
      body: `${deal.brand.companyName} te ha puntuado con ${data.rating}/5`,
      link: '/creador/perfil',
    })

    res.status(201).json({ review })
  }),
)

/**
 * Transiciones del ciclo de vida. Se declara al final a proposito: al ser
 * una ruta comodin, capturaria /messages y /review si fuera antes.
 * ACCEPTED -> FUNDED -> IN_PROGRESS -> SUBMITTED -> APPROVED -> PAID
 */
const TRANSITIONS = {
  // fund solo avanza solo cuando no hay pasarela. Con Stripe, quien pasa la
  // colaboracion a FUNDED es el webhook del cobro, nunca esta llamada: fiarse
  // de la vuelta del navegador permitiria marcar como pagado sin pagar.
  fund: { from: ['ACCEPTED'], to: 'FUNDED', actor: 'BRAND' },
  start: { from: ['FUNDED'], to: 'IN_PROGRESS', actor: 'CREATOR' },
  submit: { from: ['FUNDED', 'IN_PROGRESS'], to: 'SUBMITTED', actor: 'CREATOR' },
  approve: { from: ['SUBMITTED'], to: 'APPROVED', actor: 'BRAND' },
  // Pedir cambios devuelve la colaboracion a en curso. Antes no existia: la
  // empresa solo podia aprobar o no hacer nada, y "no hacer nada" con el
  // dinero retenido es la peor forma posible de decir que algo no encaja.
  changes: { from: ['SUBMITTED'], to: 'IN_PROGRESS', actor: 'BRAND' },
  release: { from: ['APPROVED'], to: 'PAID', actor: 'BRAND' },
  cancel: { from: ['ACCEPTED', 'FUNDED', 'IN_PROGRESS'], to: 'CANCELLED', actor: 'ANY' },
}

/**
 * Emite (o reintenta) las facturas de la colaboracion.
 *
 * Existe porque el caso mas comun es que al aprobar faltara el NIF del
 * creador. Antes eso se quedaba asi para siempre; ahora se rellena el perfil y
 * se pulsa aqui.
 */
router.post(
  '/:id/invoices',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { deal } = await loadDealFor(req.user, req.params.id)
    if (!['APPROVED', 'PAID'].includes(deal.status)) {
      throw badRequest('Las facturas se emiten cuando la empresa ha aprobado el contenido')
    }

    await emitirFacturas(deal.id)
    const invoices = await prisma.invoice.findMany({ where: { dealId: deal.id } })
    res.json({ invoices: invoices.map(publicInvoice) })
  }),
)

/**
 * La direccion de envio la pone el creador.
 *
 * Vive en la colaboracion y no en su perfil a proposito: es su casa. Solo
 * tiene que verla la empresa con la que ya ha cerrado un trato que exige
 * mandarle algo, y solo mientras dure.
 */
router.put(
  '/:id/shipping',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { deal, isCreator } = await loadDealFor(req.user, req.params.id)
    if (!isCreator) throw forbidden('La direccion la pone el creador')

    const data = parseBody(
      z.object({
        shippingName: z.string().trim().min(2).max(120),
        shippingAddress: z.string().trim().min(10).max(300),
        shippingPhone: z.string().trim().max(30).optional(),
      }),
      req.body,
    )

    const updated = await prisma.deal.update({
      where: { id: deal.id },
      data: {
        ...data,
        // Dar la direccion es lo que pone el envio en marcha. Si ya iba mas
        // adelante (corregir una direccion despues de enviar), no se retrocede.
        shipmentStatus: deal.shipmentStatus === 'NONE' ? 'PENDING' : deal.shipmentStatus,
      },
      include: DEAL_INCLUDE,
    })

    await notify(deal.brand.userId, {
      kind: 'DEAL',
      title: 'Ya tienes la direccion de envio',
      body: `${deal.creator.displayName} ha indicado donde mandarle el producto.`,
      link: '/empresa/colaboraciones',
    })

    res.json({ deal: serializeDeal(updated, 'CREATOR') })
  }),
)

/**
 * Enviado y recibido, cada uno marcado por quien le toca.
 *
 * Las dos partes hacen falta porque la discusion clasica es "yo lo mande"
 * contra "no me ha llegado". Que cada lado marque la suya deja constancia de
 * quien dijo que y cuando, y evita que el creador aparezca como que no
 * entrega cuando lo que pasa es que no ha recibido nada.
 */
router.post(
  '/:id/shipment/:paso',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { paso } = req.params
    if (!['sent', 'received'].includes(paso)) throw notFound('Paso no soportado')

    const { deal, isBrand, isCreator } = await loadDealFor(req.user, req.params.id)

    if (paso === 'sent') {
      if (!isBrand) throw forbidden('Solo la empresa marca el envio')
      if (!deal.shippingAddress) {
        throw badRequest('El creador todavia no ha indicado su direccion')
      }
      const data = parseBody(
        z.object({
          carrier: z.string().trim().max(60).optional(),
          trackingCode: z.string().trim().max(80).optional(),
          shipmentNote: z.string().trim().max(300).optional(),
        }),
        req.body,
      )

      const updated = await prisma.deal.update({
        where: { id: deal.id },
        data: { ...data, shipmentStatus: 'SENT', shippedAt: new Date() },
        include: DEAL_INCLUDE,
      })
      await notify(deal.creator.userId, {
        kind: 'DEAL',
        title: 'Tu producto va en camino',
        body: data.trackingCode
          ? `${deal.brand.companyName} lo ha enviado. Seguimiento: ${data.trackingCode}`
          : `${deal.brand.companyName} ha enviado el producto.`,
        link: '/creador/colaboraciones',
      })
      return res.json({ deal: serializeDeal(updated, 'BRAND') })
    }

    if (!isCreator) throw forbidden('Solo el creador confirma que lo ha recibido')
    if (deal.shipmentStatus !== 'SENT') throw badRequest('Este envio todavia no consta como enviado')

    const updated = await prisma.deal.update({
      where: { id: deal.id },
      data: { shipmentStatus: 'RECEIVED', receivedAt: new Date() },
      include: DEAL_INCLUDE,
    })
    await notify(deal.brand.userId, {
      kind: 'DEAL',
      title: 'Producto recibido',
      body: `${deal.creator.displayName} confirma que le ha llegado. Ya puede ponerse.`,
      link: '/empresa/colaboraciones',
    })
    res.json({ deal: serializeDeal(updated, 'CREATOR') })
  }),
)

// ---------------------------------------------------------------------------
// El comodin va EL ULTIMO, siempre.
//
// '/:id/:action' casa con cualquier cosa, asi que cualquier ruta concreta
// registrada despues queda muerta: Express prueba en orden y esta responde
// antes. Paso con '/:id/invoices', que durante un rato contestaba "accion no
// soportada" sin que nadie lo notara, porque la pantalla recarga despues.
// Si anades una ruta nueva, va encima de esta linea.
// ---------------------------------------------------------------------------

router.post(
  '/:id/:action',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { action } = req.params
    const rule = TRANSITIONS[action]
    if (!rule) throw notFound('Accion no soportada')

    const { deal, isBrand, isCreator } = await loadDealFor(req.user, req.params.id)

    if (rule.actor === 'BRAND' && !isBrand) throw forbidden('Solo la empresa puede hacer esto')
    if (rule.actor === 'CREATOR' && !isCreator) throw forbidden('Solo el creador puede hacer esto')
    if (!rule.from.includes(deal.status)) {
      throw badRequest(`No se puede pasar de ${deal.status} a ${rule.to}`)
    }

    // Pagar no es una transicion de estado: es mandar a la empresa a pagar.
    //
    // Con Stripe, esta llamada devuelve la direccion de la pagina de pago y
    // no toca nada. La colaboracion pasa a FUNDED cuando Stripe confirma el
    // cobro por webhook, que es el unico sitio donde eso puede decidirse.
    if (action === 'fund' && stripeConfigured()) {
      const completo = await prisma.deal.findUnique({
        where: { id: deal.id },
        include: {
          campaign: { select: { title: true } },
          creator: {
            select: {
              id: true,
              displayName: true,
              stripePayoutsOk: true,
              payoutMethod: true,
              paypalEmail: true,
            },
          },
        },
      })

      // Avisar ahora y no al liberar el pago: enterarse de que el creador no
      // puede cobrar despues de haberle pagado a Mikro es la peor forma de
      // descubrirlo.
      //
      // Cada via tiene su requisito y no son el mismo: por el banco hace
      // falta el alta verificada de Stripe; por PayPal, basta con que nos
      // haya dicho su correo. Comprobar siempre lo de Stripe dejaria sin
      // cobrar a quien eligio la otra via y lo tiene todo en regla.
      const porPaypal = completo.creator?.payoutMethod === 'PAYPAL' && paypalConfigured()
      const listo = porPaypal ? !!completo.creator?.paypalEmail : completo.creator?.stripePayoutsOk
      if (!listo) {
        throw badRequest(
          'Este creador todavía no ha terminado su alta de cobros. Le hemos avisado; en cuanto la complete podrás pagar.',
        )
      }

      const brand = await prisma.brand.findUnique({
        where: { id: deal.brandId },
        include: { user: { select: { email: true } } },
      })

      const url = await abrirCobro(completo, brand)
      return res.json({ pago: { url }, deal: serializeDeal(deal, isBrand ? 'BRAND' : 'CREATOR') })
    }

    const data = { status: rule.to }
    if (action === 'submit') {
      if (!req.body?.contentUrl) throw badRequest('Indica el enlace al contenido publicado')
      data.contentUrl = req.body.contentUrl
      data.notes = req.body.notes || deal.notes
    }
    if (action === 'changes' && !String(req.body?.feedback || '').trim()) {
      throw badRequest('Di que hay que cambiar: devolver el trabajo sin explicar por que no ayuda a nadie')
    }

    const updated = await prisma.deal.update({ where: { id: deal.id }, data })

    // El historial de entregas. Cada envio es una version nueva, y la
    // respuesta de la empresa se queda escrita al lado de la version concreta
    // a la que se refiere: es la conversacion que decide si se suelta el
    // dinero, y tenerla por escrito evita la mitad de las disputas.
    if (action === 'submit') {
      const ultima = await prisma.contentSubmission.findFirst({
        where: { dealId: deal.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      await prisma.contentSubmission.create({
        data: {
          dealId: deal.id,
          version: (ultima?.version || 0) + 1,
          url: req.body.contentUrl,
          note: req.body.notes || null,
        },
      })
    }
    if (action === 'approve' || action === 'changes') {
      const pendiente = await prisma.contentSubmission.findFirst({
        where: { dealId: deal.id, status: 'PENDING' },
        orderBy: { version: 'desc' },
      })
      if (pendiente) {
        await prisma.contentSubmission.update({
          where: { id: pendiente.id },
          data: {
            status: action === 'approve' ? 'APPROVED' : 'CHANGES_REQUESTED',
            feedback: String(req.body?.feedback || '').trim() || null,
            reviewedAt: new Date(),
          },
        })
      }
    }

    // Las facturas se emiten al aprobar y no al pagar: el trabajo esta hecho y
    // aceptado, que es el hecho que las devenga. emitirFacturas no duplica si
    // ya existen.
    if (action === 'approve') {
      try {
        await emitirFacturas(deal.id)
      } catch (e) {
        // Una factura que no sale no puede bloquear la aprobacion de un
        // trabajo: se anota y se puede reintentar desde la propia pantalla.
        console.warn('[facturas] no se pudieron emitir:', e?.message)
      }
    }

    // ---------------------------------------------------------------------
    // El dinero.
    //
    // Con Stripe configurado se mueve de verdad. Sin el, se anotan los
    // mismos movimientos marcados como SIMULATED y la interfaz lo dice: una
    // garantia de pago que no existe es peor que no ofrecer ninguna.
    // ---------------------------------------------------------------------
    const conStripe = stripeConfigured()

    // Sin pasarela, el cobro se anota igualmente para que el libro de
    // movimientos quede completo: una colaboracion pagada tiene que tener su
    // entrada y su salida, aunque las dos sean simuladas. Si no, cuadrar las
    // cuentas despues es imposible.
    if (action === 'fund' && !conStripe) {
      await prisma.payment.create({
        data: {
          dealId: deal.id,
          amount: Math.round(desgloseDe(deal).brandCents / 100),
          amountCents: desgloseDe(deal).brandCents,
          fee: deal.feePlatform,
          kind: 'ESCROW_IN',
          provider: 'SIMULATED',
          reference: `ESC-${deal.id.slice(-6).toUpperCase()}`,
        },
      })
    }

    if (action === 'release') {
      const creator = await prisma.creator.findUnique({ where: { id: deal.creatorId } })

      // Por PayPal el pago se encola, no sale. El saldo de PayPal es otro
      // bolsillo distinto del de Stripe y lo llena una persona: ver
      // paypal/config.js. Lo que no cambia es que el dinero de la empresa ya
      // estaba cobrado y que a partir de aqui es del creador.
      if (creator?.payoutMethod === 'PAYPAL' && paypalConfigured()) {
        await encolarPago(deal, creator)
      } else if (conStripe) {
        // No se puede transferir a una cuenta que Stripe no ha verificado, y
        // decirlo asi es mas util que un error de la pasarela.
        await transferirAlCreador({ ...deal, status: rule.to }, creator)
      } else {
        await prisma.payment.create({
          data: {
            dealId: deal.id,
            amount: desgloseDe(deal).creatorNet,
            fee: deal.feePlatform,
            kind: 'PAYOUT',
            provider: 'SIMULATED',
            reference: `PAY-${deal.id.slice(-6).toUpperCase()}`,
          },
        })
      }
      await recomputeCreator(deal.creatorId)
    }

    if (action === 'cancel') {
      const cobrado = deal.payments.some((p) => p.kind === 'ESCROW_IN' && p.status === 'COMPLETED')
      if (cobrado) {
        if (conStripe && deal.stripePaymentIntent) {
          await devolver({ ...deal })
        } else {
          await prisma.payment.create({
            data: {
              dealId: deal.id,
              amount: Math.round(desgloseDe(deal).brandCents / 100),
              amountCents: desgloseDe(deal).brandCents,
              fee: 0,
              kind: 'REFUND',
              provider: 'SIMULATED',
              reference: `REF-${deal.id.slice(-6).toUpperCase()}`,
            },
          })
        }
      }
    }

    const NOTICES = {
      fund: ['Fondos depositados', 'La empresa ha depositado el importe en garantia. Ya puedes empezar.'],
      start: ['Colaboracion en marcha', 'El creador ha empezado a trabajar.'],
      submit: ['Contenido entregado', 'Revisa el contenido y aprueba la colaboracion.'],
      approve: ['Contenido aprobado', 'La empresa ha aprobado tu trabajo.'],
      changes: ['Te piden cambios', 'La empresa ha revisado el contenido y pide algun ajuste.'],
      release: ['Pago liberado', 'El importe se ha enviado al creador.'],
      cancel: ['Colaboracion cancelada', 'La colaboracion se ha cancelado.'],
    }
    const [title, body] = NOTICES[action]
    const targetUserId = isBrand ? deal.creator.userId : deal.brand.userId
    await notify(targetUserId, {
      kind: 'DEAL',
      title,
      body,
      link: isBrand ? '/creador/colaboraciones' : '/empresa/colaboraciones',
    })

    res.json({ deal: { ...updated } })
  }),
)


export default router
