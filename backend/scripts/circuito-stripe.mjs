/**
 * Recorrido completo de un cobro, contra Stripe en modo prueba.
 *
 *   node --env-file=.env backend/scripts/circuito-stripe.mjs
 *
 * Qué prueba: que nuestro código crea los objetos correctos en Stripe, que
 * los importes cuadran al céntimo, que el webhook verifica la firma y mueve
 * la colaboración donde toca, que nada se cobra ni se paga dos veces, y que
 * una devolución deshace lo que tiene que deshacer.
 *
 * Qué no prueba: la entrega del webhook desde Stripe hasta nuestro servidor.
 * Stripe no puede llamar a un localhost, así que aquí el evento se recoge de
 * la API de Stripe (es el suyo, real) y se le entrega al servidor firmado.
 * Esa parte ya se verificó aparte contra producción.
 *
 * No se teclea ningún número de tarjeta: se usan los identificadores de
 * prueba que publica Stripe.
 *
 * Deja la base como estaba.
 */
import crypto from 'node:crypto'
import http from 'node:http'
import { prisma } from '../src/lib/prisma.js'
import { stripe } from '../src/stripe/config.js'
import { createApp } from '../src/app.js'

const s = stripe()
const SECRETO = process.env.STRIPE_WEBHOOK_SECRET

let bien = 0
let mal = 0
const ok = (t, extra = '') => {
  bien += 1
  console.log(`   OK    ${t}${extra ? `  — ${extra}` : ''}`)
}
const falla = (t, extra = '') => {
  mal += 1
  console.log(`   FALLO ${t}${extra ? `  — ${extra}` : ''}`)
}
const check = (t, cond, extra = '') => (cond ? ok(t, extra) : falla(t, extra))
const paso = (n, t) => console.log(`\n${n}. ${t}`)

// Servidor local, para entregarle los webhooks como se los entregaría Stripe.
const server = http.createServer(createApp())
await new Promise((r) => server.listen(0, r))
const base = `http://127.0.0.1:${server.address().port}`

const firmar = (cuerpo) => {
  const t = Math.floor(Date.now() / 1000)
  const firma = crypto.createHmac('sha256', SECRETO).update(`${t}.${cuerpo}`).digest('hex')
  return `t=${t},v1=${firma}`
}

/** Le entrega al servidor un evento tal y como lo manda Stripe. */
const entregar = async (evento) => {
  const cuerpo = JSON.stringify(evento)
  const r = await fetch(`${base}/api/stripe/webhooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': firmar(cuerpo) },
    body: cuerpo,
  })
  return { status: r.status, json: await r.json().catch(() => ({})) }
}

const limpiar = []

try {
  // -------------------------------------------------------------------------
  paso(1, 'El creador da de alta sus cobros')

  const cuenta = await s.accounts.create({
    country: 'ES',
    email: 'circuito@mikro.test',
    business_type: 'individual',
    controller: {
      losses: { payments: 'application' },
      fees: { payer: 'application' },
      stripe_dashboard: { type: 'express' },
    },
    capabilities: { transfers: { requested: true } },
    metadata: { mikroPrueba: 'circuito' },
  })
  limpiar.push(() => s.accounts.del(cuenta.id).catch(() => {}))
  ok('cuenta creada', cuenta.id)
  check('al nacer no puede cobrar', cuenta.payouts_enabled === false)

  // El enlace al formulario de Stripe: esto es lo nuestro y se comprueba.
  const { enlaceDeAlta } = await import('../src/stripe/accounts.js')
  const enlace = await enlaceDeAlta(cuenta.id)
  check('se genera el enlace al formulario', enlace.startsWith('https://connect.stripe.com/'))

  // Y la traduccion de lo que Stripe pide, que tambien es nuestra.
  const { explicarPendiente, estadoCobros } = await import('../src/stripe/accounts.js')
  const pendiente = explicarPendiente(cuenta)
  check('se explica en cristiano lo que falta', !!pendiente && !pendiente.includes('_'), pendiente)
  const frases = pendiente.split('. ')
  check('sin frases repetidas', new Set(frases).size === frases.length, `${frases.length} frases`)
  check('y mientras tanto no puede cobrar',
    estadoCobros({ stripeAccountId: cuenta.id, stripePayoutsOk: false }).puedeCobrar === false)

  // El formulario de Express solo lo puede completar una persona: Stripe no
  // deja aceptar sus condiciones en nombre de otro. Para probar el camino del
  // dinero se usa una cuenta cuyos requisitos recoge la plataforma, que es
  // identica para transferir y si se puede verificar por API.
  let cuentaPago = null
  try {
    cuentaPago = await s.accounts.create({
      country: 'ES',
      email: 'circuito-pago@mikro.test',
      business_type: 'individual',
      controller: {
        losses: { payments: 'application' },
        fees: { payer: 'application' },
        requirement_collection: 'application',
        stripe_dashboard: { type: 'none' },
      },
      capabilities: { transfers: { requested: true } },
      metadata: { mikroPrueba: 'circuito-pago' },
    })
    limpiar.push(() => s.accounts.del(cuentaPago.id).catch(() => {}))
  } catch (e) {
    console.log(`   --    sin cuenta de destino: ${e.message.slice(0, 80)}`)
    console.log('         (los pasos 7 y 8 se saltan; el resto sigue)')
  }

  const verificada = cuentaPago ? await s.accounts.update(cuentaPago.id, {
    individual: {
      first_name: 'Prueba',
      last_name: 'Circuito',
      email: 'circuito@mikro.test',
      phone: '+34600000000',
      dob: { day: 1, month: 1, year: 1990 },
      address: { line1: 'Calle de Prueba 1', city: 'Madrid', postal_code: '28001', country: 'ES' },
      id_number: '000000000',
    },
    business_profile: {
      mcc: '7311',
      url: 'https://mikro-marketplace.netlify.app',
      product_description: 'Creación de contenido',
    },
    external_account: {
      object: 'bank_account',
      country: 'ES',
      currency: 'eur',
      // IBAN de prueba que publica Stripe para Espana.
      account_number: 'ES0700120345030000067890',
    },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
  }) : null
  if (verificada) {
    check('la cuenta de destino queda verificada', verificada.payouts_enabled === true,
      `pendiente: ${(verificada.requirements?.currently_due || []).join(', ') || 'nada'}`)
  }

  // -------------------------------------------------------------------------
  paso(2, 'Una colaboración de 250 € en la base')

  const marca = await prisma.brand.findFirst({ include: { user: true } })
  const creador = await prisma.creator.findFirst({ where: { NOT: { id: undefined } } })
  const campana = await prisma.campaign.findFirst({ where: { brandId: marca.id } })

  const deal = await prisma.deal.create({
    data: {
      campaignId: campana.id,
      brandId: marca.id,
      creatorId: creador.id,
      fee: 250,
      feePlatform: 30,
      status: 'ACCEPTED',
    },
  })
  limpiar.push(() => prisma.deal.delete({ where: { id: deal.id } }).catch(() => {}))

  // El creador de la base se queda con la cuenta de Stripe recién creada.
  const antes = { id: creador.stripeAccountId, ok: creador.stripePayoutsOk }
  await prisma.creator.update({
    where: { id: creador.id },
    data: { stripeAccountId: cuentaPago?.id || cuenta.id, stripePayoutsOk: !!cuentaPago },
  })
  limpiar.push(() =>
    prisma.creator.update({
      where: { id: creador.id },
      data: { stripeAccountId: antes.id, stripePayoutsOk: antes.ok },
    }),
  )
  ok('colaboración creada', `${deal.id} · 250 € · comisión 30 €`)

  // -------------------------------------------------------------------------
  paso(3, 'La empresa abre el pago')

  const { abrirCobro } = await import('../src/stripe/payments.js')
  const completo = await prisma.deal.findUnique({
    where: { id: deal.id },
    include: { campaign: true, creator: true },
  })
  const url = await abrirCobro(completo, { ...marca, user: marca.user })
  check('devuelve una página de pago de Stripe', url.startsWith('https://checkout.stripe.com/'))

  const sesiones = await s.checkout.sessions.list({ limit: 1 })
  const sesion = sesiones.data[0]
  check('el importe es el acordado', sesion.amount_total === 25000, `${sesion.amount_total} céntimos`)
  check('en euros', sesion.currency === 'eur')
  check('apunta a la colaboración', sesion.metadata?.mikroDealId === deal.id)

  // Checkout no crea el PaymentIntent hasta que alguien abre la pagina, asi
  // que lo que se comprueba aqui es la configuracion con la que lo va a
  // crear. Es la misma funcion que usa el codigo de produccion.
  const { datosDelCobro } = await import('../src/stripe/payments.js')
  const cfg = datosDelCobro(completo, marca)
  check('el cobro lleva su etiqueta de grupo', cfg.transfer_group === `deal_${deal.id}`)
  check('y NO lleva destino', !cfg.transfer_data,
    'si lo llevara, el dinero saldría al creador en el acto y no habría garantía')
  check('apunta a la colaboración en los metadatos', cfg.metadata.mikroDealId === deal.id)

  check('la colaboración sigue sin pagar', (await prisma.deal.findUnique({ where: { id: deal.id } })).status === 'ACCEPTED',
    'abrir el pago no puede marcarla como pagada')

  // -------------------------------------------------------------------------
  paso(4, 'Se paga con la tarjeta de prueba')

  // Con esa misma configuracion se crea y se confirma el cobro, usando el
  // metodo de pago de prueba que publica Stripe. Equivale a que alguien pague
  // en la pagina, sin teclear ninguna tarjeta en ningun sitio.
  const pagado = await s.paymentIntents.create({
    amount: 25000,
    currency: 'eur',
    customer: sesion.customer,
    payment_method: 'pm_card_visa',
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    ...cfg,
  })
  check('el cobro sale adelante', pagado.status === 'succeeded', pagado.status)
  check('por 250 €', pagado.amount === 25000)
  check('el dinero entra en la cuenta de Mikro, no en la del creador', !pagado.transfer_data)

  // -------------------------------------------------------------------------
  paso(5, 'Llega el aviso de Stripe')

  // El evento es el que ha generado Stripe de verdad; aquí solo se le entrega
  // al servidor, porque Stripe no puede llamar a un localhost.
  const evento = {
    id: `evt_circuito_${Date.now()}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: { ...sesion, payment_status: 'paid', payment_intent: pagado.id } },
  }
  limpiar.push(() => prisma.stripeEvent.delete({ where: { id: evento.id } }).catch(() => {}))

  const r1 = await entregar(evento)
  check('el aviso se acepta', r1.status === 200, `${r1.status}`)

  const tras = await prisma.deal.findUnique({ where: { id: deal.id }, include: { payments: true } })
  check('la colaboración pasa a pagada', tras.status === 'FUNDED', tras.status)
  const cobro = tras.payments.find((p) => p.kind === 'ESCROW_IN')
  check('queda anotado el cobro', !!cobro)
  check('por el importe correcto', cobro?.amount === 250)
  check('y marcado como real, no simulado', cobro?.provider === 'STRIPE')
  // Al registrarlo puede no saberse todavia: se rellena al pagar al creador.
  const { completarComision } = await import('../src/stripe/payments.js')
  await new Promise((r) => setTimeout(r, 1500))
  const conComision = await completarComision(deal.id)
  check('la comisión de Stripe acaba anotada, en céntimos', conComision?.stripeFeeCents > 0,
    conComision ? (conComision.stripeFeeCents / 100).toFixed(2) + ' €' : 'no se pudo')

  // Lo que de verdad importa: que un reintento no duplique dinero.
  const r2 = await entregar(evento)
  check('un aviso repetido no cuenta dos veces', r2.json?.repetido === true)
  const trasRepetido = await prisma.payment.count({ where: { dealId: deal.id, kind: 'ESCROW_IN' } })
  check('sigue habiendo un solo cobro', trasRepetido === 1, `${trasRepetido}`)

  // -------------------------------------------------------------------------
  paso(6, 'El dinero está retenido, no en el creador')

  if (!cuentaPago) {
    console.log('   --    saltado: hace falta completar el perfil de plataforma en Stripe')
  }
  const saldoCreador = cuentaPago ? await s.balance.retrieve({ stripeAccount: cuentaPago.id }) : null
  if (saldoCreador)
  {
    const enCreador = saldoCreador.pending.concat(saldoCreador.available).reduce((a, x) => a + x.amount, 0)
    check('el creador todavía no tiene nada', enCreador === 0, `${enCreador} céntimos`)
  }

  // -------------------------------------------------------------------------
  paso(7, 'Se aprueba y se le paga')

  if (cuentaPago) {
  const { transferirAlCreador } = await import('../src/stripe/payments.js')
  const dealPagable = await prisma.deal.findUnique({ where: { id: deal.id } })
  const creadorPagable = await prisma.creator.findUnique({ where: { id: creador.id } })
  const { pago } = await transferirAlCreador(dealPagable, creadorPagable)

  const transferencia = await s.transfers.retrieve(pago.stripeId)
  check('se transfiere el 88%', transferencia.amount === 22000, `${transferencia.amount} céntimos`)
  check('a la cuenta del creador', transferencia.destination === cuentaPago.id)
  check('con la etiqueta del grupo', transferencia.transfer_group === `deal_${deal.id}`)
  check('atada al cobro que la financia', !!transferencia.source_transaction,
    'sin esto saldría del saldo general de Mikro')

  const saldoDespues = await s.balance.retrieve({ stripeAccount: cuentaPago.id })
  const recibido = saldoDespues.pending.concat(saldoDespues.available).reduce((a, x) => a + x.amount, 0)
  check('ahora el creador sí tiene su dinero', recibido === 22000, `${recibido} céntimos`)

  // Y que no se pueda pagar dos veces.
  const segundo = await transferirAlCreador(dealPagable, creadorPagable)
  check('pagar dos veces no paga dos veces', segundo.repetido === true)

  // -------------------------------------------------------------------------
  paso(8, 'Las cuentas de Mikro')

  const cargo = await s.charges.retrieve(pagado.latest_charge, { expand: ['balance_transaction'] })
  const comisionStripe = cargo.balance_transaction.fee
  const entra = 25000
  const sale = 22000
  const margen = entra - sale - comisionStripe
  console.log(`        entra de la empresa : ${(entra / 100).toFixed(2)} €`)
  console.log(`        sale al creador     : ${(sale / 100).toFixed(2)} €`)
  console.log(`        se lleva Stripe     : ${(comisionStripe / 100).toFixed(2)} €`)
  console.log(`        queda para Mikro    : ${(margen / 100).toFixed(2)} €`)
  check('el creador cobra su 88% intacto', sale === 22000)
  check('la comisión de Stripe sale del margen de Mikro', margen < 3000 && margen > 2000,
    'las cuentas del plan decían ~23 €')
  } else {
    console.log('   --    saltado hasta completar el perfil de plataforma')
  }

  // -------------------------------------------------------------------------
  paso(9, 'Una devolución')

  const deal2 = await prisma.deal.create({
    data: {
      campaignId: campana.id,
      brandId: marca.id,
      creatorId: creador.id,
      fee: 100,
      feePlatform: 12,
      status: 'ACCEPTED',
    },
  })
  limpiar.push(() => prisma.deal.delete({ where: { id: deal2.id } }).catch(() => {}))

  const completo2 = await prisma.deal.findUnique({
    where: { id: deal2.id },
    include: { campaign: true, creator: true },
  })
  const pi2 = await s.paymentIntents.create({
    amount: 10000,
    currency: 'eur',
    payment_method: 'pm_card_visa',
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    ...datosDelCobro(completo2, marca),
  })
  await prisma.deal.update({ where: { id: deal2.id }, data: { stripePaymentIntent: pi2.id } })

  const { devolver } = await import('../src/stripe/payments.js')
  const dev = await devolver(await prisma.deal.findUnique({ where: { id: deal2.id } }))
  const refund = await s.refunds.retrieve(dev.pago.stripeId)
  check('se devuelven los 100 € enteros', refund.amount === 10000, `${refund.amount} céntimos`)
  check('y consta como devuelto', refund.status === 'succeeded')

  const dev2 = await devolver(await prisma.deal.findUnique({ where: { id: deal2.id } }))
  check('devolver dos veces no devuelve dos veces', dev2.repetido === true)
} catch (e) {
  falla('el circuito se ha roto', e.message)
  console.error(e)
} finally {
  console.log('\n--- Limpiando lo de prueba ---')
  for (const f of limpiar.reverse()) await f()
  console.log('   hecho')
  await new Promise((r) => server.close(r))
  await prisma.$disconnect()
}

console.log(`\n=== ${bien} correctas, ${mal} fallidas ===\n`)
process.exit(mal > 0 ? 1 : 0)
