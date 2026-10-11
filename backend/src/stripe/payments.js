/**
 * El dinero de una colaboracion.
 *
 * Tres momentos y tres llamadas:
 *
 *   1. **Cobrar.** La empresa paga en una pagina alojada por Stripe. El
 *      dinero entra en la cuenta de Mikro y se queda ahi.
 *   2. **Transferir.** Al aprobar el contenido, se le manda al creador su
 *      88%. Es una llamada aparte, dias despues: ese hueco entre las dos es
 *      exactamente la garantia que vende Mikro.
 *   3. **Devolver.** Si se cancela antes de aprobar, el cobro se devuelve
 *      entero a la empresa.
 *
 * Se usa una pagina alojada por Stripe y no un formulario nuestro porque asi
 * **ningun numero de tarjeta pasa por aqui**. No es pereza: es quitarnos de
 * encima el cumplimiento de PCI y la posibilidad de filtrar una tarjeta.
 */
import { prisma } from '../lib/prisma.js'
import { APP_URL, MONEDA, aCentimos, stripe } from './config.js'

/** Etiqueta que une en Stripe el cobro con su transferencia. */
export const grupoDe = (dealId) => `deal_${dealId}`

/**
 * Cliente de Stripe de la empresa, para no pedirle la tarjeta cada vez.
 */
async function asegurarCliente(brand) {
  if (brand.stripeCustomerId) return brand.stripeCustomerId

  const cliente = await stripe().customers.create({
    name: brand.companyName,
    email: brand.user?.email,
    metadata: { mikroBrandId: brand.id },
    ...(brand.vatNumber ? { tax_ids: undefined } : {}),
  })
  await prisma.brand.update({ where: { id: brand.id }, data: { stripeCustomerId: cliente.id } })
  return cliente.id
}

/**
 * Como se configura el cobro.
 *
 * Aparte de abrirCobro porque es lo unico que de verdad hay que mirar con
 * lupa: sin transfer_group no se puede reconciliar despues, y si aqui
 * apareciera un transfer_data el dinero saldria hacia el creador en el mismo
 * momento del cobro y no habria ninguna garantia que ofrecer. Separado, se
 * puede comprobar en una prueba sin montar medio Stripe.
 */
export function datosDelCobro(deal, brand) {
  return {
    transfer_group: grupoDe(deal.id),
    description: `Mikro · colaboración ${deal.id}`,
    metadata: { mikroDealId: deal.id, mikroBrandId: brand.id, mikroCreatorId: deal.creatorId },
  }
}

/**
 * Abre el pago de una colaboracion. Devuelve la URL a la que mandar a la
 * empresa.
 *
 * La colaboracion no pasa a FUNDED aqui: eso lo hace el webhook cuando
 * Stripe confirma el cobro. Fiarse de que el navegador vuelva a la pagina de
 * exito seria marcar como pagado algo que puede no haberse pagado.
 */
export async function abrirCobro(deal, brand) {
  const customer = await asegurarCliente(brand)
  const grupo = grupoDe(deal.id)

  const sesion = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer,
    locale: 'es',
    client_reference_id: deal.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: MONEDA,
          unit_amount: aCentimos(deal.fee),
          product_data: {
            name: `Colaboración · ${deal.campaign?.title || 'Mikro'}`,
            description: `${deal.creator?.displayName || 'Creador'} — el importe queda cobrado y no se le envía hasta que apruebes el contenido`,
          },
        },
      },
    ],
    payment_intent_data: datosDelCobro(deal, brand),
    metadata: { mikroDealId: deal.id },
    success_url: `${APP_URL()}/empresa/colaboraciones?pago=ok&deal=${deal.id}`,
    cancel_url: `${APP_URL()}/empresa/colaboraciones?pago=cancelado&deal=${deal.id}`,
    // Media hora de sobra para pagar; pasada, se abre otra.
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  })

  await prisma.deal.update({
    where: { id: deal.id },
    data: { stripeTransferGroup: grupo },
  })

  return sesion.url
}

/**
 * Lo que Stripe se ha llevado por un cobro, en centimos.
 *
 * Devuelve null cuando todavia no se sabe. Stripe tarda un instante en
 * calcular la comision, y devolver cero en ese hueco seria afirmar que el
 * cobro no costo nada.
 */
async function comisionDeStripe(paymentIntentId) {
  if (!paymentIntentId) return { feeCents: null, chargeId: null }
  try {
    const pi = await stripe().paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge.balance_transaction'],
    })
    const bt = pi.latest_charge?.balance_transaction
    return {
      feeCents: typeof bt?.fee === 'number' ? bt.fee : null,
      chargeId: pi.latest_charge?.id || null,
    }
  } catch {
    // Que no sepamos la comision no puede impedir registrar el cobro.
    return { feeCents: null, chargeId: null }
  }
}

/**
 * Registra el cobro ya confirmado por Stripe.
 *
 * Idempotente: si ya hay un ESCROW_IN para este cobro, no se duplica. Stripe
 * entrega los avisos al menos una vez y aqui hay dinero de por medio.
 */
export async function registrarCobro(dealId, paymentIntentId) {
  const existente = await prisma.payment.findFirst({
    where: { dealId, kind: 'ESCROW_IN', stripeId: paymentIntentId },
  })
  if (existente) return { pago: existente, repetido: true }

  const deal = await prisma.deal.findUnique({ where: { id: dealId } })
  if (!deal) throw new Error('Esa colaboración no existe')

  const { feeCents } = await comisionDeStripe(paymentIntentId)

  const pago = await prisma.payment.create({
    data: {
      dealId,
      amount: deal.fee,
      fee: deal.feePlatform,
      kind: 'ESCROW_IN',
      status: 'COMPLETED',
      provider: 'STRIPE',
      stripeId: paymentIntentId,
      stripeFeeCents: feeCents,
      reference: `ESC-${dealId.slice(-6).toUpperCase()}`,
    },
  })

  // El estado solo avanza si venia de ACCEPTED: un aviso repetido no puede
  // echar atras una colaboracion que ya iba por la mitad.
  if (deal.status === 'ACCEPTED') {
    await prisma.deal.update({
      where: { id: dealId },
      data: { status: 'FUNDED', stripePaymentIntent: paymentIntentId },
    })
  } else {
    await prisma.deal.update({ where: { id: dealId }, data: { stripePaymentIntent: paymentIntentId } })
  }

  return { pago, repetido: false }
}

/**
 * Rellena la comision de Stripe de un cobro cuando ya se sabe.
 *
 * Al registrar el cobro suele no estar: Stripe tarda un instante en calcular
 * la comision, y antes se guardaba un cero que parecia "no costo nada". Para
 * cuando se le paga al creador ya han pasado dias y la cifra existe seguro,
 * asi que ese es el momento de anotarla. Sin esto nunca sabriamos cual es
 * nuestro margen real.
 */
export async function completarComision(dealId) {
  const cobro = await prisma.payment.findFirst({
    where: { dealId, kind: 'ESCROW_IN', provider: 'STRIPE', stripeFeeCents: null },
  })
  if (!cobro?.stripeId) return null

  const { feeCents } = await comisionDeStripe(cobro.stripeId)
  if (feeCents == null) return null

  return prisma.payment.update({ where: { id: cobro.id }, data: { stripeFeeCents: feeCents } })
}

/**
 * Le manda al creador lo suyo.
 *
 * `source_transaction` ata la transferencia al cobro concreto que la
 * financia: asi Stripe no la ejecuta hasta que ese dinero esta disponible,
 * en vez de sacarlo del saldo general de Mikro y dejarlo en descubierto.
 */
export async function transferirAlCreador(deal, creator) {
  if (!creator.stripeAccountId || !creator.stripePayoutsOk) {
    throw new Error('El creador todavía no tiene su cuenta de cobros lista')
  }

  const yaPagado = await prisma.payment.findFirst({
    where: { dealId: deal.id, kind: 'PAYOUT', status: 'COMPLETED' },
  })
  if (yaPagado) return { pago: yaPagado, repetido: true }

  // Antes de pagar, se cierra la cuenta del cobro: ahora la comision de
  // Stripe ya existe aunque no existiera al registrarlo.
  await completarComision(deal.id)

  const neto = deal.fee - deal.feePlatform
  const { chargeId } = await comisionDeStripe(deal.stripePaymentIntent)

  const transferencia = await stripe().transfers.create(
    {
      amount: aCentimos(neto),
      currency: MONEDA,
      destination: creator.stripeAccountId,
      transfer_group: deal.stripeTransferGroup || grupoDe(deal.id),
      ...(chargeId ? { source_transaction: chargeId } : {}),
      description: `Mikro · colaboración ${deal.id}`,
      metadata: { mikroDealId: deal.id, mikroCreatorId: creator.id },
    },
    // Si la red falla y se reintenta, no se paga dos veces.
    { idempotencyKey: `payout_${deal.id}` },
  )

  const pago = await prisma.payment.create({
    data: {
      dealId: deal.id,
      amount: neto,
      fee: deal.feePlatform,
      kind: 'PAYOUT',
      status: 'COMPLETED',
      provider: 'STRIPE',
      stripeId: transferencia.id,
      reference: `PAY-${deal.id.slice(-6).toUpperCase()}`,
    },
  })

  return { pago, repetido: false }
}

/** Devuelve el cobro entero a la empresa. */
export async function devolver(deal, motivo = 'requested_by_customer') {
  if (!deal.stripePaymentIntent) return null

  const yaDevuelto = await prisma.payment.findFirst({
    where: { dealId: deal.id, kind: 'REFUND', status: 'COMPLETED' },
  })
  if (yaDevuelto) return { pago: yaDevuelto, repetido: true }

  const devolucion = await stripe().refunds.create(
    { payment_intent: deal.stripePaymentIntent, reason: motivo },
    { idempotencyKey: `refund_${deal.id}` },
  )

  const pago = await prisma.payment.create({
    data: {
      dealId: deal.id,
      amount: deal.fee,
      fee: 0,
      kind: 'REFUND',
      status: 'COMPLETED',
      provider: 'STRIPE',
      stripeId: devolucion.id,
      reference: `REF-${deal.id.slice(-6).toUpperCase()}`,
    },
  })

  return { pago, repetido: false }
}

export default {
  abrirCobro,
  registrarCobro,
  transferirAlCreador,
  devolver,
  grupoDe,
  datosDelCobro,
  completarComision,
}
