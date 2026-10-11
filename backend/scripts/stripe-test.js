/**
 * Pruebas de la integracion de cobros.
 *
 *   node backend/scripts/stripe-test.js
 *
 * Sin red y sin base de datos. Lo que se comprueba aqui es lo que, si falla,
 * no da ningun error visible: un webhook que acepta firmas invalidas deja
 * que cualquiera marque colaboraciones como pagadas sin pagar nada.
 */
import crypto from 'node:crypto'
import http from 'node:http'

const SECRETO = 'whsec_pruebadeprueba1234567890'
process.env.STRIPE_SECRET_KEY = 'sk_test_clavedeprueba'
process.env.STRIPE_WEBHOOK_SECRET = SECRETO
process.env.JWT_SECRET = 'secreto-jwt-de-prueba'
process.env.NODE_ENV = 'test'

const { aCentimos, aEuros, stripeConfigured, resetStripe } = await import('../src/stripe/config.js')
const { grupoDe } = await import('../src/stripe/payments.js')
const { estadoCobros, explicarPendiente } = await import('../src/stripe/accounts.js')

let passed = 0
let failed = 0
const check = (name, cond, extra = '') => {
  if (cond) {
    passed += 1
    console.log(`  OK   ${name}`)
  } else {
    failed += 1
    console.log(`  FALLO ${name} ${extra}`)
  }
}

// ---------------------------------------------------------------------------
console.log('\n--- Importes ---')

// Stripe trabaja en centimos y Mikro en euros. Equivocarse aqui multiplica
// o divide por cien lo que cobra alguien.
check('250 euros son 25000 centimos', aCentimos(250) === 25000)
check('ida y vuelta', aEuros(aCentimos(250)) === 250)
check('los decimales no se pierden', aCentimos(52.5) === 5250)
check('y redondea al centimo, no al euro', aCentimos(10.006) === 1001, `${aCentimos(10.006)}`)
check('cero es cero', aCentimos(0) === 0)

// El reparto de una colaboracion de 250 con comision del 12%.
const fee = 250
const comision = Math.round((fee * 12) / 100)
check('la comision de Mikro son 30 euros', comision === 30)
check('al creador le llegan 220', aCentimos(fee - comision) === 22000)

console.log('\n--- Agrupacion ---')
check('el grupo lleva el id de la colaboracion', grupoDe('abc123') === 'deal_abc123')

// ---------------------------------------------------------------------------
console.log('\n--- Estado de la cuenta del creador ---')

check('sin cuenta no puede cobrar', estadoCobros({}).puedeCobrar === false)
check('sin cuenta, estado SIN_EMPEZAR', estadoCobros({}).estado === 'SIN_EMPEZAR')
check(
  'con cuenta pero sin verificar no puede cobrar',
  estadoCobros({ stripeAccountId: 'acct_1', stripePayoutsOk: false }).puedeCobrar === false,
)
check(
  'y se ensena que le falta',
  estadoCobros({ stripeAccountId: 'acct_1', stripePayoutsOk: false, stripePendiente: 'Falta el NIF' })
    .pendiente === 'Falta el NIF',
)
check(
  'verificada si puede cobrar',
  estadoCobros({ stripeAccountId: 'acct_1', stripePayoutsOk: true }).puedeCobrar === true,
)

// Los codigos de Stripe no se le ensenan a nadie en crudo.
check(
  'un requisito conocido se traduce',
  explicarPendiente({ requirements: { currently_due: ['individual.id_number'] } }) === 'Falta tu NIF',
)
check(
  'uno desconocido no se ensena en crudo',
  !explicarPendiente({ requirements: { currently_due: ['algo.raro.nuevo'] } }).includes('algo.raro'),
)
check('sin requisitos, nada pendiente', explicarPendiente({ requirements: {} }) === null)

// ---------------------------------------------------------------------------
console.log('\n--- Webhook: la firma ---')

const { createApp } = await import('../src/app.js')
const server = http.createServer(createApp())
await new Promise((r) => server.listen(0, r))
const base = `http://127.0.0.1:${server.address().port}`

/** Firma como lo hace Stripe: t=timestamp, v1=HMAC de "timestamp.cuerpo". */
function firmar(cuerpo, secreto = SECRETO, momento = Math.floor(Date.now() / 1000)) {
  const firma = crypto.createHmac('sha256', secreto).update(`${momento}.${cuerpo}`).digest('hex')
  return `t=${momento},v1=${firma}`
}

const evento = JSON.stringify({
  id: `evt_${crypto.randomUUID()}`,
  type: 'checkout.session.completed',
  data: { object: { payment_status: 'unpaid', metadata: {} } },
})

const enviar = (cuerpo, firma) =>
  fetch(`${base}/api/stripe/webhooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(firma ? { 'stripe-signature': firma } : {}) },
    body: cuerpo,
  })

check('sin firma -> 400', (await enviar(evento)).status === 400)
check('con firma inventada -> 400', (await enviar(evento, 't=1,v1=noesunafirma')).status === 400)
check(
  'firmado con otro secreto -> 400',
  (await enviar(evento, firmar(evento, 'whsec_otrosecreto'))).status === 400,
)

// Esta es la que de verdad importa: un cuerpo cambiado despues de firmar.
// Si pasara, cualquiera podria inflar el importe de un cobro.
const manipulado = evento.replace('unpaid', 'paid')
check('cuerpo manipulado tras firmar -> 400', (await enviar(manipulado, firmar(evento))).status === 400)

// Stripe rechaza firmas viejas para que nadie reenvie un evento capturado.
const viejo = Math.floor(Date.now() / 1000) - 3600
check('firma caducada -> 400', (await enviar(evento, firmar(evento, SECRETO, viejo))).status === 400)

// Y sin configurar no se acepta nada: un endpoint que dice "ok" a cualquiera
// es una invitacion a inventarse cobros.
delete process.env.STRIPE_WEBHOOK_SECRET
resetStripe()
check('sin secreto configurado -> 503', (await enviar(evento, firmar(evento))).status === 503)
process.env.STRIPE_WEBHOOK_SECRET = SECRETO
resetStripe()

console.log('\n--- Configuracion ---')
check('con clave, configurado', stripeConfigured() === true)
delete process.env.STRIPE_SECRET_KEY
resetStripe()
check('sin clave, no configurado', stripeConfigured() === false)

await new Promise((r) => server.close(r))

console.log(`\n=== ${passed} correctas, ${failed} fallidas ===\n`)
process.exit(failed > 0 ? 1 : 0)
