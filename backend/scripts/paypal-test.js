/**
 * Pruebas de los pagos por PayPal.
 *
 *   node backend/scripts/paypal-test.js
 *
 * Sin red y sin base de datos: el fetch se sustituye por uno de mentira. Lo
 * que se comprueba aqui es lo que, si falla, no da ninguna senal y cuesta
 * dinero: un lote que se manda dos veces paga dos veces, y un pago marcado
 * como cobrado cuando PayPal lo ha devuelto deja a un creador sin cobrar y a
 * nosotros pensando que ya esta.
 */
process.env.PAYPAL_CLIENT_ID = 'id-de-prueba'
process.env.PAYPAL_CLIENT_SECRET = 'secreto-de-prueba'
process.env.PAYPAL_MODE = 'sandbox'

const { aImporte, aCentimos, API, paypalConfigured, modoReal } = await import(
  '../src/paypal/config.js'
)
const { paypal, resetPaypal, esRepetido } = await import('../src/paypal/client.js')
const { idDeLote, ESTADOS, MOTIVOS } = await import('../src/paypal/payouts.js')

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

// PayPal quiere texto con dos decimales. Un numero en coma flotante aqui es
// como se pierden centimos.
check('220 euros se escriben como texto', aImporte(220) === '220.00', aImporte(220))
check('con decimales se respetan', aImporte(52.5) === '52.50')
check('y se redondea al centimo', aImporte(10.006) === '10.01', aImporte(10.006))
check('ida y vuelta', aCentimos(aImporte(220)) === 22000)
check('tambien con decimales', aCentimos(aImporte(52.5)) === 5250)

console.log('\n--- Entorno ---')

check('por defecto, sandbox', API().includes('sandbox'))
check('y no es modo real', modoReal() === false)
process.env.PAYPAL_MODE = 'live'
check('en live se habla con la API de verdad', API() === 'https://api-m.paypal.com')
process.env.PAYPAL_MODE = 'sandbox'
check('con credenciales, configurado', paypalConfigured() === true)

// ---------------------------------------------------------------------------
console.log('\n--- El identificador del lote ---')

// Es la clave de idempotencia de PayPal. Si cambiara entre un intento y su
// reintento, el reintento seria un lote nuevo y todo el mundo cobraria dos
// veces.
const pagos = [{ id: 'pay_c' }, { id: 'pay_a' }, { id: 'pay_b' }]
const l1 = idDeLote(pagos)
check('tiene la forma esperada', /^mikro-[0-9a-f]{24}$/.test(l1), l1)
check('el mismo lote da el mismo id', idDeLote([...pagos]) === l1)
// Esta es la importante: si dependiera del orden, un reintento que lea las
// filas en otro orden mandaria el mismo dinero con otro identificador.
check('el orden no importa', idDeLote([{ id: 'pay_a' }, { id: 'pay_b' }, { id: 'pay_c' }]) === l1)
check('si cambia un pago, cambia el id', idDeLote([{ id: 'pay_a' }]) !== l1)

// ---------------------------------------------------------------------------
console.log('\n--- Estados: un pago enviado no es un pago cobrado ---')

check('SUCCESS es cobrado', ESTADOS.SUCCESS === 'COMPLETED')
check('FAILED es fallido', ESTADOS.FAILED === 'FAILED')
check('BLOCKED tambien', ESTADOS.BLOCKED === 'FAILED')
check('RETURNED tambien: el dinero ha vuelto', ESTADOS.RETURNED === 'FAILED')
// UNCLAIMED es el caso que se presta a error. PayPal ya ha avisado al
// creador y le da treinta dias para abrir su cuenta: darlo por fallido seria
// cancelar un pago que todavia puede llegar.
check('UNCLAIMED sigue pendiente, no fallido', ESTADOS.UNCLAIMED === 'PENDING')
check('PENDING sigue pendiente', ESTADOS.PENDING === 'PENDING')
check('un estado que no conocemos se queda pendiente', (ESTADOS.LO_QUE_SEA || 'PENDING') === 'PENDING')
check('y hay un motivo que ensenar', /30 dias/.test(MOTIVOS.UNCLAIMED))
check('para un correo sin cuenta tambien', /cuenta de PayPal/.test(MOTIVOS.RECEIVER_UNREGISTERED))

// ---------------------------------------------------------------------------
console.log('\n--- Hablar con PayPal ---')

const fetchReal = globalThis.fetch
let llamadas = []
function responder(mapa) {
  globalThis.fetch = async (url, opciones = {}) => {
    const u = String(url)
    llamadas.push({ url: u, headers: opciones.headers || {}, body: opciones.body })
    const clave = Object.keys(mapa).find((k) => u.includes(k))
    const r = mapa[clave] || { status: 404, cuerpo: { name: 'NOT_FOUND' } }
    return { ok: r.status < 400, status: r.status, json: async () => r.cuerpo }
  }
}

const TOKEN_OK = { status: 200, cuerpo: { access_token: 'tok_123', expires_in: 32400 } }

resetPaypal()
llamadas = []
responder({
  '/v1/oauth2/token': TOKEN_OK,
  '/v1/payments/payouts': {
    status: 201,
    cuerpo: { batch_header: { payout_batch_id: 'LOTE1', batch_status: 'PENDING' } },
  },
})

const r1 = await paypal('POST', '/v1/payments/payouts', { items: [] }, 'mikro-abc')
check('el lote vuelve con su identificador', r1.batch_header.payout_batch_id === 'LOTE1')
check('primero se pide el token', llamadas[0].url.includes('/v1/oauth2/token'))
check('con las credenciales en Basic', String(llamadas[0].headers.Authorization).startsWith('Basic '))
check('y la llamada va con el token', llamadas[1].headers.Authorization === 'Bearer tok_123')
// Sin esta cabecera, un corte de red a mitad de envio y su reintento son dos
// pagos.
check('con la cabecera de idempotencia', llamadas[1].headers['PayPal-Request-Id'] === 'mikro-abc')
check('contra el entorno de pruebas', llamadas[1].url.includes('sandbox'))

const antes = llamadas.length
await paypal('POST', '/v1/payments/payouts', { items: [] }, 'mikro-def')
check('el token no se vuelve a pedir', llamadas.length === antes + 1, `${llamadas.length - antes}`)

console.log('\n--- Cuando PayPal dice que no ---')

resetPaypal()
responder({ '/v1/oauth2/token': { status: 401, cuerpo: { error: 'invalid_client' } } })
let e1 = null
try {
  await paypal('GET', '/v1/payments/payouts/X')
} catch (e) {
  e1 = e.message
}
check('unas credenciales malas lo dicen', /credenciales/i.test(e1 || ''), e1)
// El error mas comun de verdad: las de sandbox puestas en real, o al reves.
check('y avisan del entorno, que es el fallo tipico', /sandbox/i.test(e1 || ''), e1)

resetPaypal()
responder({
  '/v1/oauth2/token': TOKEN_OK,
  '/v1/payments/payouts': { status: 400, cuerpo: { name: 'INSUFFICIENT_FUNDS' } },
})
let e2 = null
try {
  await paypal('POST', '/v1/payments/payouts', {}, 'x')
} catch (e) {
  e2 = e.message
}
check('quedarse sin saldo se entiende', /saldo/i.test(e2 || ''), e2)

resetPaypal()
responder({
  '/v1/oauth2/token': TOKEN_OK,
  '/v1/payments/payouts': { status: 403, cuerpo: { name: 'AUTHORIZATION_ERROR' } },
})
let e3 = null
try {
  await paypal('POST', '/v1/payments/payouts', {}, 'x')
} catch (e) {
  e3 = e.message
}
check('no tener Payouts aprobado se entiende', /Payouts/.test(e3 || ''), e3)

resetPaypal()
responder({
  '/v1/oauth2/token': TOKEN_OK,
  '/v1/payments/payouts': {
    status: 500,
    cuerpo: { name: 'ALGO_RARO_NUEVO', message: 'something went wrong' },
  },
})
let e4 = null
try {
  await paypal('POST', '/v1/payments/payouts', {}, 'x')
} catch (e) {
  e4 = e
}
// Un error que no conocemos se deja pasar tal cual: un mensaje raro que se
// puede buscar es mejor que uno bonito que no dice nada.
check('uno desconocido no se disfraza', /something went wrong/.test(e4?.message || ''), e4?.message)
check('y se guarda la respuesta entera', e4?.paypal?.name === 'ALGO_RARO_NUEVO')
check('con su codigo', e4?.status === 500)

console.log('\n--- Un lote repetido no es un fallo ---')

check(
  'PayPal diciendo que ya existe se reconoce',
  esRepetido({ paypal: { name: 'BATCH_ALREADY_EXISTS' } }) === true,
)
check('y por el mensaje tambien', esRepetido({ message: 'duplicate request id' }) === true)
check('un error de verdad no', esRepetido({ paypal: { name: 'INSUFFICIENT_FUNDS' } }) === false)

globalThis.fetch = fetchReal

console.log(`\n=== ${passed} correctas, ${failed} fallidas ===\n`)
process.exit(failed > 0 ? 1 : 0)
