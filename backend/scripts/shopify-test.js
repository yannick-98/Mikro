/**
 * Pruebas de la integracion con Shopify que no necesitan Shopify.
 *
 *   node backend/scripts/shopify-test.js
 *
 * Se centran en lo que falla en silencio y caro: la verificacion de firmas y
 * de tokens. Un webhook que acepta firmas invalidas no da ningun error, solo
 * deja que cualquiera invente ventas en el panel de una tienda.
 *
 * No toca la base de datos ni la red.
 */
import crypto from 'node:crypto'
import http from 'node:http'
import jwt from 'jsonwebtoken'

const API_KEY = 'clave-de-prueba'
const API_SECRET = 'secreto-de-prueba'

process.env.SHOPIFY_API_KEY = API_KEY
process.env.SHOPIFY_API_SECRET = API_SECRET
process.env.JWT_SECRET = 'secreto-jwt-de-prueba'
process.env.NODE_ENV = 'test'

const { webhookSignatureValid, querySignatureValid, verifySessionToken } = await import(
  '../src/shopify/verify.js'
)
const { buildCode } = await import('../src/shopify/discounts.js')
const { shareLink, toStorePath } = await import('../src/shopify/links.js')
const { toShopDomain, isShopDomain } = await import('../src/shopify/config.js')

let passed = 0
let failed = 0

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1
    console.log(`  OK   ${name}`)
  } else {
    failed += 1
    console.log(`  FALLO ${name} ${extra}`)
  }
}

const firmar = (body, secret = API_SECRET) =>
  crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64')

const sessionToken = (over = {}) =>
  jwt.sign(
    {
      iss: 'https://tienda-demo.myshopify.com/admin',
      dest: 'https://tienda-demo.myshopify.com',
      aud: API_KEY,
      sub: '42',
      sid: 'abc',
      ...over,
    },
    over.secret || API_SECRET,
    { expiresIn: over.expiresIn || '1m', algorithm: 'HS256' },
  )

// ---------------------------------------------------------------------------
console.log('\n--- Firma de webhooks ---')

const cuerpo = JSON.stringify({ id: 1, total_price: '42.50' })
check('firma correcta aceptada', webhookSignatureValid(cuerpo, firmar(cuerpo)))
check('firma correcta sobre Buffer', webhookSignatureValid(Buffer.from(cuerpo), firmar(cuerpo)))
check('cuerpo manipulado rechazado', !webhookSignatureValid(cuerpo.replace('42.50', '9999'), firmar(cuerpo)))
check('secreto distinto rechazado', !webhookSignatureValid(cuerpo, firmar(cuerpo, 'otro-secreto')))
check('sin cabecera rechazado', !webhookSignatureValid(cuerpo, undefined))
check('cabecera vacia rechazada', !webhookSignatureValid(cuerpo, ''))
// Una firma mas corta hace estallar timingSafeEqual si no se comprueba el largo.
check('firma de otra longitud no revienta', !webhookSignatureValid(cuerpo, 'abc'))
check('firma mas larga no revienta', !webhookSignatureValid(cuerpo, firmar(cuerpo) + 'xx'))

// Espacios distintos, mismo JSON: por esto la firma va sobre el cuerpo crudo.
const reserializado = JSON.stringify(JSON.parse(cuerpo), null, 2)
check('reserializar invalida la firma (por eso se usa el crudo)', !webhookSignatureValid(reserializado, firmar(cuerpo)))

// ---------------------------------------------------------------------------
console.log('\n--- Firma de query string ---')

const query = { shop: 'tienda-demo.myshopify.com', timestamp: '1700000000', host: 'YWRtaW4=' }
const mensaje = Object.keys(query).sort().map((k) => `${k}=${query[k]}`).join('&')
const hmacHex = crypto.createHmac('sha256', API_SECRET).update(mensaje, 'utf8').digest('hex')

check('query firmada aceptada', querySignatureValid({ ...query, hmac: hmacHex }))
check('query manipulada rechazada', !querySignatureValid({ ...query, shop: 'otra.myshopify.com', hmac: hmacHex }))
check('query sin hmac rechazada', !querySignatureValid(query))
check('parametro anadido rechazado', !querySignatureValid({ ...query, extra: 'x', hmac: hmacHex }))

// ---------------------------------------------------------------------------
console.log('\n--- Token de sesion ---')

check('token valido aceptado', verifySessionToken(sessionToken()).shop === 'tienda-demo.myshopify.com')

const rechaza = (nombre, token) => {
  try {
    verifySessionToken(token)
    check(nombre, false, '(no deberia haberlo aceptado)')
  } catch {
    check(nombre, true)
  }
}

rechaza('token de otra app rechazado', sessionToken({ aud: 'otra-clave' }))
rechaza('token firmado con otro secreto rechazado', sessionToken({ secret: 'secreto-ajeno' }))
rechaza('token caducado rechazado', sessionToken({ expiresIn: '-5m' }))
rechaza('emisor y tienda distintos rechazados', sessionToken({ iss: 'https://otra.myshopify.com/admin' }))
rechaza('destino que no es una tienda rechazado', sessionToken({ dest: 'https://evil.example.com', iss: 'https://evil.example.com/admin' }))
rechaza('token manipulado rechazado', `${sessionToken()}x`)

// Confusion de algoritmo: un token con alg:none no debe colarse nunca.
const sinFirma = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(
  JSON.stringify({ iss: 'https://tienda-demo.myshopify.com/admin', dest: 'https://tienda-demo.myshopify.com', aud: API_KEY }),
).toString('base64url')}.`
rechaza('token sin firma (alg:none) rechazado', sinFirma)

// ---------------------------------------------------------------------------
console.log('\n--- Dominios de tienda ---')

check('dominio valido', isShopDomain('mi-tienda.myshopify.com'))
check('dominio con protocolo se normaliza', toShopDomain('https://mi-tienda.myshopify.com/admin') === 'mi-tienda.myshopify.com')
check('mayusculas se normalizan', toShopDomain('Mi-Tienda.MyShopify.com') === 'mi-tienda.myshopify.com')
check('dominio ajeno rechazado', toShopDomain('evil.com') === null)
// El clasico: un dominio que solo acaba pareciendose.
check('sufijo enganoso rechazado', toShopDomain('evil.com/x.myshopify.com') === null)
check('subdominio enganoso rechazado', toShopDomain('mi-tienda.myshopify.com.evil.com') === null)

// ---------------------------------------------------------------------------
console.log('\n--- Codigos de descuento ---')

const codigo = buildCode('marta.garcia')
check('formato del codigo', /^MIKRO-[A-Z0-9]{1,10}-[A-Z0-9]{4}$/.test(codigo), codigo)
check('acentos y puntos fuera', buildCode('josé.lópez').startsWith('MIKRO-JOSELOPEZ-'), buildCode('josé.lópez'))
check('sin handle sigue dando codigo', /^MIKRO-CREADOR-/.test(buildCode('')))
const muestras = new Set(Array.from({ length: 300 }, () => buildCode('marta')))
check('los codigos no se repiten', muestras.size === 300, `${muestras.size}/300`)

// ---------------------------------------------------------------------------
console.log('\n--- Enlaces para compartir ---')

const HOSTS = ['flores.example', 'tienda-demo.myshopify.com']

check('destino vacio no es destino', toStorePath('', HOSTS) === null)
check('solo la barra no es destino', toStorePath('/', HOSTS) === null)
check('ruta suelta', toStorePath('/products/rosas', HOSTS) === '/products/rosas')
check('ruta sin barra inicial', toStorePath('products/rosas', HOSTS) === '/products/rosas')
check(
  'url propia se reduce a su ruta',
  toStorePath('https://flores.example/products/rosas?variant=7', HOSTS) === '/products/rosas?variant=7',
)
check('el www no cambia de tienda', toStorePath('https://www.flores.example/a', HOSTS) === '/a')
check(
  'dominio de myshopify tambien vale',
  toStorePath('https://tienda-demo.myshopify.com/collections/todo', HOSTS) === '/collections/todo',
)

// Esto es lo que impide que el enlace de un creador lleve a otro sitio: sin
// esta comprobacion, el redirect de Shopify seria un salto comodo hacia una
// pagina de phishing con la credibilidad del creador detras.
const fuera = (valor) => {
  try {
    toStorePath(valor, HOSTS)
    return false
  } catch {
    return true
  }
}
check('otro dominio rechazado', fuera('https://evil.example/login'))
check('subdominio enganoso rechazado', fuera('https://flores.example.evil.com/x'))
check('url sin esquema rechazada', fuera('//evil.example/x'))

const enlace = shareLink({
  host: 'flores.example',
  code: 'IMPULSO-MARTA',
  campaignTitle: 'Reto 21 días',
  creatorHandle: 'marta.garcia',
  landingPath: '/products/rosas',
})
const partes = new URL(enlace)
check('el enlace aplica el codigo', partes.pathname === '/discount/IMPULSO-MARTA', partes.pathname)

// El destino, con los utm_ dentro: es la direccion en la que acaba el
// visitante, y la que lee la analitica de la tienda.
const aterriza = new URL(partes.searchParams.get('redirect'), 'https://flores.example')
check('lleva al destino', aterriza.pathname === '/products/rosas', aterriza.pathname)
check('trae utm_source', aterriza.searchParams.get('utm_source') === 'mikro')
check('la campana viaja en utm_campaign', aterriza.searchParams.get('utm_campaign') === 'reto-21-dias')
check('el creador viaja en utm_content', aterriza.searchParams.get('utm_content') === 'marta-garcia')

const destinoDe = (opts) =>
  new URL(new URL(shareLink(opts)).searchParams.get('redirect'), 'https://flores.example')
check(
  'sin creador, el utm_content es el codigo',
  destinoDe({ host: 'flores.example', code: 'ABC-1' }).searchParams.get('utm_content') === 'abc-1',
)
check(
  'sin destino, el enlace lleva a la portada',
  destinoDe({ host: 'flores.example', code: 'ABC-1' }).pathname === '/',
)

// Un destino que ya traia parametros no los pierde: /products/x?variant=7
// sigue llevando su variante, con los utm_ aniadidos al lado.
const conVariante = destinoDe({
  host: 'flores.example',
  code: 'ABC-1',
  landingPath: '/products/rosas?variant=7',
})
check('el destino conserva sus parametros', conVariante.searchParams.get('variant') === '7')
check('y recibe los utm igualmente', conVariante.searchParams.get('utm_source') === 'mikro')

check('sin dominio no se inventa enlace', shareLink({ host: null, code: 'ABC' }) === null)

// ---------------------------------------------------------------------------
console.log('\n--- Ruta de webhooks (cuerpo en crudo) ---')

// Esta es la que importa de verdad: comprueba que express.raw esta montado
// antes del express.json general. Si alguien invierte ese orden, las firmas
// dejan de cuadrar y la app se queda sin recibir ventas sin que nadie lo note.
const { createApp } = await import('../src/app.js')
const server = http.createServer(createApp())
await new Promise((r) => server.listen(0, r))
const base = `http://127.0.0.1:${server.address().port}`

const enviar = (payload, { firma, topic = 'orders/create', id = crypto.randomUUID() } = {}) =>
  fetch(`${base}/api/shopify/webhooks/orders-create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Hmac-Sha256': firma ?? firmar(payload),
      'X-Shopify-Shop-Domain': 'tienda-demo.myshopify.com',
      'X-Shopify-Topic': topic,
      'X-Shopify-Webhook-Id': id,
    },
    body: payload,
  })

const pedido = JSON.stringify({ id: 99, total_price: '30.00', discount_codes: [] })

const sinFirmaRes = await enviar(pedido, { firma: 'no-vale' })
check('webhook con firma invalida -> 401', sinFirmaRes.status === 401, `status=${sinFirmaRes.status}`)

const ausente = await fetch(`${base}/api/shopify/webhooks/orders-create`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: pedido,
})
check('webhook sin firma -> 401', ausente.status === 401, `status=${ausente.status}`)

const manipulado = await enviar(pedido, { firma: firmar(pedido.replace('30.00', '3000')) })
check('webhook con cuerpo cambiado -> 401', manipulado.status === 401, `status=${manipulado.status}`)

const compliance = await fetch(`${base}/api/shopify/webhooks/shop-redact`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Shopify-Hmac-Sha256': 'invalida' },
  body: '{}',
})
check('webhook de cumplimiento con firma invalida -> 401', compliance.status === 401, `status=${compliance.status}`)

await new Promise((r) => server.close(r))

console.log(`\n=== ${passed} correctas, ${failed} fallidas ===\n`)
process.exit(failed > 0 ? 1 : 0)
