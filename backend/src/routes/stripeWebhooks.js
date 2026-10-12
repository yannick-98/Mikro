/**
 * Avisos de Stripe.
 *
 * Igual que con Shopify, este router va con el cuerpo en crudo y ANTES del
 * express.json() general: la firma se calcula sobre los bytes tal cual
 * llegan, y cualquier parser que los interprete y los vuelva a serializar la
 * invalida.
 *
 * **Esto es la fuente de verdad del dinero, no la vuelta del navegador.** Un
 * cobro se da por bueno aqui y en ningun otro sitio. Si nos fiaramos de que
 * la empresa aterrice en la pagina de exito, bastaria con escribir esa URL a
 * mano para marcar una colaboracion como pagada sin pagar nada.
 */
import { Router } from 'express'
import express from 'express'
import { prisma } from '../lib/prisma.js'
import { stripe, stripeConfigured, webhookSecrets } from '../stripe/config.js'
import { registrarCobro } from '../stripe/payments.js'
import { refrescarCuenta } from '../stripe/accounts.js'
import { notify } from '../services/notify.js'

const router = Router()

router.use(express.raw({ type: '*/*', limit: '1mb' }))

/**
 * Comprueba la firma y descarta repetidos.
 * Devuelve null cuando ya se ha respondido.
 */
async function entrada(req, res) {
  const secretos = webhookSecrets()
  if (!stripeConfigured() || !secretos.length) {
    // Sin configurar no se acepta nada: un endpoint que dice "ok" a
    // cualquiera es una invitacion a inventarse cobros.
    res.status(503).json({ error: 'Stripe no esta configurado' })
    return null
  }

  // Se prueba cada secreto porque hay dos endpoints: el de nuestra cuenta y
  // el de las cuentas conectadas. Basta con que uno valide; si ninguno lo
  // hace, la firma no es buena y se rechaza igual que antes.
  let evento = null
  let ultimoError = null
  for (const secreto of secretos) {
    try {
      evento = stripe().webhooks.constructEvent(req.body, req.get('stripe-signature'), secreto)
      break
    } catch (e) {
      ultimoError = e
    }
  }
  if (!evento) {
    res.status(400).json({ error: `Firma no valida: ${ultimoError?.message}` })
    return null
  }

  // Stripe entrega al menos una vez. Sin esto, un reintento del aviso de
  // cobro registraria dos veces el mismo dinero.
  const { count } = await prisma.stripeEvent.createMany({
    data: [{ id: evento.id, type: evento.type }],
    skipDuplicates: true,
  })
  if (count === 0) {
    res.status(200).json({ recibido: true, repetido: true })
    return null
  }

  return evento
}

router.post('/', async (req, res) => {
  const evento = await entrada(req, res)
  if (!evento) return

  try {
    switch (evento.type) {
      // El cobro ha salido bien. Es el unico sitio donde una colaboracion
      // pasa a estar pagada.
      case 'checkout.session.completed': {
        const sesion = evento.data.object
        if (sesion.payment_status !== 'paid') break
        const dealId = sesion.metadata?.mikroDealId || sesion.client_reference_id
        if (!dealId) break

        const { repetido } = await registrarCobro(dealId, sesion.payment_intent)
        if (repetido) break

        const deal = await prisma.deal.findUnique({
          where: { id: dealId },
          include: { creator: { select: { userId: true } }, campaign: { select: { title: true } } },
        })
        if (deal?.creator?.userId) {
          await notify(deal.creator.userId, {
            kind: 'DEAL',
            title: 'El importe ya está cobrado',
            body: `La empresa ha pagado "${deal.campaign?.title}". Ya puedes ponerte: cobrarás al aprobar el contenido.`,
            link: '/creador/colaboraciones',
          })
        }
        break
      }

      // El cobro ha fallado. Se anota para que la empresa vea por que en
      // lugar de encontrarse un boton que no hace nada.
      case 'payment_intent.payment_failed': {
        const pi = evento.data.object
        const dealId = pi.metadata?.mikroDealId
        if (!dealId) break
        await prisma.payment.create({
          data: {
            dealId,
            amount: 0,
            fee: 0,
            kind: 'ESCROW_IN',
            status: 'FAILED',
            provider: 'STRIPE',
            stripeId: pi.id,
            error: pi.last_payment_error?.message?.slice(0, 300) || 'El pago no se completó',
          },
        })
        break
      }

      // Stripe ha cambiado el estado de la cuenta de un creador: ya puede
      // cobrar, o le falta algo nuevo.
      case 'account.updated': {
        const cuenta = evento.data.object
        const antes = await prisma.creator.findFirst({
          where: { stripeAccountId: cuenta.id },
          select: { id: true, userId: true, stripePayoutsOk: true },
        })
        await refrescarCuenta(cuenta.id, cuenta)
        if (antes && !antes.stripePayoutsOk && cuenta.payouts_enabled) {
          await notify(antes.userId, {
            kind: 'DEAL',
            title: 'Ya puedes cobrar',
            body: 'Tu cuenta de cobros está verificada. El dinero de tus colaboraciones te llegará al banco.',
            link: '/creador/perfil',
          })
        }
        break
      }

      // Una transferencia al creador que se da la vuelta: casi siempre
      // porque su banco la rechaza. Hay que enterarse, no dejarlo pasar.
      case 'transfer.reversed': {
        const tr = evento.data.object
        const dealId = tr.metadata?.mikroDealId
        if (!dealId) break
        await prisma.payment.updateMany({
          where: { dealId, stripeId: tr.id },
          data: { status: 'FAILED', error: 'La transferencia fue revertida' },
        })
        const deal = await prisma.deal.findUnique({
          where: { id: dealId },
          include: { creator: { select: { userId: true } } },
        })
        if (deal?.creator?.userId) {
          await notify(deal.creator.userId, {
            kind: 'DEAL',
            title: 'Tu pago no ha llegado',
            body: 'La transferencia se ha devuelto. Revisa tu cuenta bancaria en Stripe y nos ponemos con ello.',
            link: '/creador/perfil',
          })
        }
        break
      }

      default:
        break
    }

    res.status(200).json({ recibido: true })
  } catch (e) {
    console.error(`[stripe] fallo procesando ${evento.type}:`, e?.message)
    // 500 a conciencia, al reves que en Shopify: aqui hay dinero, y prefiero
    // que Stripe reintente a dar por bueno un cobro que no se registro. El
    // evento se borra para que el reintento no lo vea como repetido.
    await prisma.stripeEvent.delete({ where: { id: evento.id } }).catch(() => {})
    res.status(500).json({ error: 'No se pudo procesar' })
  }
})

export default router
