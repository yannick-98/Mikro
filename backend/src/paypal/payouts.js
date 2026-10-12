/**
 * Pagar a los creadores por PayPal.
 *
 * Tres pasos, y estan separados porque ocurren en momentos distintos:
 *
 *   1. **Encolar.** Al aprobar el contenido. Deja la fila del pago en
 *      PENDING. No se envia nada: el saldo de PayPal es otro bolsillo
 *      distinto del de Stripe y puede estar vacio (ver config.js).
 *   2. **Enviar el lote.** Cuando alguien lo lanza, con el saldo que haya.
 *      Todos los pendientes en una sola llamada: PayPal cobra por lote, no
 *      por pago.
 *   3. **Cerrar.** PayPal tarda en liquidar cada pago y puede devolver
 *      alguno. Hasta que no se consulta, un pago enviado no es un pago
 *      cobrado, y marcarlo como COMPLETED al enviarlo seria mentir en el
 *      sitio mas caro posible.
 *
 * Nada de esto toca a la empresa: su dinero se cobro al principio y la
 * garantia es la misma por las dos vias.
 */
import crypto from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { notify } from '../services/notify.js'
import { MONEDA, aCentimos, aImporte } from './config.js'
import { esRepetido, paypal } from './client.js'

/** Lo que PayPal llama a cada pago del lote, traducido. */
export const ESTADOS = {
  SUCCESS: 'COMPLETED',
  FAILED: 'FAILED',
  BLOCKED: 'FAILED',
  REFUNDED: 'FAILED',
  RETURNED: 'FAILED',
  REVERSED: 'FAILED',
  DENIED: 'FAILED',
  // UNCLAIMED es el caso bonito: el creador no tiene cuenta de PayPal con ese
  // correo. PayPal le avisa y le da treinta dias para abrirla; si no lo hace,
  // el dinero vuelve. No es un fallo todavia, asi que se queda pendiente.
  UNCLAIMED: 'PENDING',
  PENDING: 'PENDING',
  ONHOLD: 'PENDING',
  NEW: 'PENDING',
}

export const MOTIVOS = {
  UNCLAIMED:
    'El creador todavia no ha reclamado el pago: PayPal le avisa por correo y tiene 30 dias',
  RECEIVER_UNREGISTERED: 'Ese correo no tiene cuenta de PayPal',
  RECEIVER_ACCOUNT_LOCKED: 'La cuenta de PayPal del creador esta bloqueada',
  RECEIVER_UNCONFIRMED: 'La cuenta de PayPal del creador no esta confirmada',
  RECEIVER_COUNTRY_NOT_ALLOWED: 'PayPal no permite enviar dinero a ese pais',
  RECEIVER_YOUR_OWN_ACCOUNT: 'Ese correo es el de la propia cuenta que envia',
  CURRENCY_NOT_SUPPORTED_FOR_RECEIVER: 'La cuenta del creador no admite euros',
  AMOUNT_LIMIT_EXCEEDED: 'El importe supera el limite de PayPal para esa cuenta',
}

/**
 * Deja listo el pago de una colaboracion. No envia nada.
 *
 * Idempotente: si ya hay un PAYOUT de esta colaboracion, se devuelve ese. Un
 * doble clic en "aprobar" no puede pagar dos veces.
 */
export async function encolarPago(deal, creator) {
  if (!creator.paypalEmail) {
    throw new Error('El creador todavia no ha dicho a que cuenta de PayPal quiere cobrar')
  }

  const yaHay = await prisma.payment.findFirst({
    where: { dealId: deal.id, kind: 'PAYOUT', status: { in: ['PENDING', 'COMPLETED'] } },
  })
  if (yaHay) return { pago: yaHay, repetido: true }

  const pago = await prisma.payment.create({
    data: {
      dealId: deal.id,
      amount: deal.fee - deal.feePlatform,
      fee: deal.feePlatform,
      kind: 'PAYOUT',
      status: 'PENDING',
      provider: 'PAYPAL',
      paypalEmail: creator.paypalEmail,
      reference: `PAY-${deal.id.slice(-6).toUpperCase()}`,
    },
  })

  return { pago, repetido: false }
}

/** Los pagos que esperan a salir. */
export const pendientesDeEnviar = () =>
  prisma.payment.findMany({
    where: { kind: 'PAYOUT', provider: 'PAYPAL', status: 'PENDING', paypalBatchId: null },
    orderBy: { createdAt: 'asc' },
    include: { deal: { include: { creator: { select: { id: true, userId: true } } } } },
  })

/**
 * El identificador del lote, calculado de lo que lleva dentro.
 *
 * PayPal usa sender_batch_id como clave de idempotencia. Que salga de los
 * pagos y no de la hora significa que reintentar un envio que se corto a
 * medias manda el mismo lote, y PayPal lo reconoce en vez de pagarlo otra
 * vez. Con una marca de tiempo, ese mismo reintento seria un lote nuevo y
 * todo el mundo cobraria dos veces.
 */
export function idDeLote(pagos) {
  const ids = pagos
    .map((p) => p.id)
    .sort()
    .join(',')
  return `mikro-${crypto.createHash('sha256').update(ids).digest('hex').slice(0, 24)}`
}

/**
 * Envia de una vez todo lo que esta pendiente.
 *
 * Devuelve lo que ha pasado sin lanzar, porque esto lo llama una tarea: que
 * un lote falle tiene que quedar escrito y visible, no tumbar el proceso.
 */
export async function enviarLote({ limite = 200 } = {}) {
  const pagos = (await pendientesDeEnviar()).slice(0, limite)
  if (!pagos.length) return { enviados: 0, lote: null, pagos: [] }

  const loteId = idDeLote(pagos)
  const cuerpo = {
    sender_batch_header: {
      sender_batch_id: loteId,
      email_subject: 'Ya tienes tu pago de Mikro',
      email_message: 'El importe de tu colaboracion. Gracias por el trabajo.',
    },
    items: pagos.map((p) => ({
      recipient_type: 'EMAIL',
      receiver: p.paypalEmail,
      amount: { value: aImporte(p.amount), currency: MONEDA },
      note: `Mikro · colaboracion ${p.dealId}`,
      sender_item_id: p.id,
    })),
  }

  let respuesta
  try {
    respuesta = await paypal('POST', '/v1/payments/payouts', cuerpo, loteId)
  } catch (e) {
    if (!esRepetido(e)) {
      // El fallo se guarda en cada pago, no en un registro que nadie mira.
      await prisma.payment.updateMany({
        where: { id: { in: pagos.map((p) => p.id) } },
        data: { error: String(e.message).slice(0, 300) },
      })
      return { enviados: 0, lote: null, error: e.message, pagos: [] }
    }
    // Ya se habia mandado: se sigue adelante para cerrar lo que quedo a
    // medias en vez de dejarlo colgado para siempre.
    respuesta = { batch_header: { payout_batch_id: null } }
  }

  const batchId = respuesta?.batch_header?.payout_batch_id || null
  if (batchId) {
    await prisma.payment.updateMany({
      where: { id: { in: pagos.map((p) => p.id) } },
      data: { paypalBatchId: batchId, error: null },
    })
  }

  return { enviados: pagos.length, lote: batchId, loteId, pagos }
}

/**
 * Pregunta a PayPal como ha ido cada pago de un lote y lo deja cerrado.
 *
 * Aqui es donde un pago pasa a COMPLETED, y no al enviarlo: entre las dos
 * cosas PayPal puede rechazarlo, devolverlo, o dejarlo sin reclamar.
 */
export async function cerrarLote(batchId) {
  const datos = await paypal('GET', `/v1/payments/payouts/${batchId}`)
  const items = datos?.items || []
  const resultado = { completados: 0, fallidos: 0, pendientes: 0 }

  for (const item of items) {
    const pagoId = item.payout_item?.sender_item_id
    if (!pagoId) continue

    const estado = ESTADOS[item.transaction_status] || 'PENDING'
    const motivo = MOTIVOS[item.errors?.name] || MOTIVOS[item.transaction_status] || null

    const pago = await prisma.payment.findUnique({
      where: { id: pagoId },
      include: { deal: { include: { creator: { select: { userId: true } } } } },
    })
    if (!pago || pago.status === estado) {
      resultado[estado === 'COMPLETED' ? 'completados' : estado === 'FAILED' ? 'fallidos' : 'pendientes'] += 1
      continue
    }

    await prisma.payment.update({
      where: { id: pagoId },
      data: {
        status: estado,
        paypalItemId: item.payout_item_id || null,
        paypalFeeCents: item.payout_item_fee?.value ? aCentimos(item.payout_item_fee.value) : null,
        error: estado === 'FAILED' ? motivo || 'PayPal no pudo entregar el pago' : motivo,
      },
    })

    const userId = pago.deal?.creator?.userId
    if (userId && estado === 'COMPLETED') {
      resultado.completados += 1
      await notify(userId, {
        kind: 'DEAL',
        title: 'Ya tienes tu dinero',
        body: `Te hemos enviado ${pago.amount} € a tu PayPal.`,
        link: '/creador/colaboraciones',
      })
    } else if (userId && estado === 'FAILED') {
      resultado.fallidos += 1
      await notify(userId, {
        kind: 'DEAL',
        title: 'Tu pago no ha llegado',
        body: `${motivo || 'PayPal no pudo entregar el pago'}. Revisa tu correo de PayPal en el perfil y nos ponemos con ello.`,
        link: '/creador/perfil',
      })
    } else {
      resultado.pendientes += 1
    }
  }

  return resultado
}

/** Cierra todos los lotes que siguen abiertos. */
export async function cerrarPendientes() {
  const abiertos = await prisma.payment.findMany({
    where: { provider: 'PAYPAL', kind: 'PAYOUT', status: 'PENDING', paypalBatchId: { not: null } },
    distinct: ['paypalBatchId'],
    select: { paypalBatchId: true },
  })

  const total = { completados: 0, fallidos: 0, pendientes: 0, lotes: abiertos.length }
  for (const { paypalBatchId } of abiertos) {
    try {
      const r = await cerrarLote(paypalBatchId)
      total.completados += r.completados
      total.fallidos += r.fallidos
      total.pendientes += r.pendientes
    } catch (e) {
      total.error = e.message
    }
  }
  return total
}

export default { encolarPago, enviarLote, cerrarLote, cerrarPendientes, pendientesDeEnviar, idDeLote }
