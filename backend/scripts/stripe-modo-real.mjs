/**
 * Pasa produccion a cobrar de verdad.
 *
 *   npm run stripe:real              (lee la clave de .env.live)
 *   npm run stripe:real -- --mirar   (solo comprueba, no cambia nada)
 *
 * Produccion estuvo en modo prueba para poder recorrer el circuito entero sin
 * mover dinero real. Volver atras son tres cosas que hay que hacer juntas o
 * no funciona ninguna:
 *
 *   1. La clave sk_live_ en Netlify.
 *   2. Los dos endpoints de webhook, que en modo real no existen todavia:
 *      los de prueba son otros y sus secretos no sirven aqui.
 *   3. Las claves de prueba en los contextos de preview, para que una rama de
 *      trabajo no cobre a nadie de verdad.
 *
 * Haciendolo a mano es facil dejarse uno, y el fallo es silencioso: con la
 * clave real y el secreto de prueba los cobros se abren, pero el aviso de
 * Stripe se rechaza por firma y la colaboracion queda pagada en Stripe y sin
 * pagar en Mikro. Por eso esto es un script y no una lista de pasos.
 *
 * El secreto de firma de un endpoint SOLO se puede leer al crearlo. Si ya
 * hubiera endpoints en modo real no se pueden reutilizar: habria que
 * rehacerlos, y eso no se hace sin decirlo (--recrear).
 *
 * Ninguna clave se imprime, ni entera ni a medias.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import Stripe from 'stripe'
import { API_VERSION } from '../src/stripe/config.js'

const RAIZ = path.resolve(import.meta.dirname, '../..')
const URL_WEBHOOK = 'https://mikro-marketplace.netlify.app/api/stripe/webhooks'
const CUENTA = 'acct_1QwCHgP9HQqYU7lm'

// Los mismos que escucha el manejador, repartidos como exige Stripe: los de
// Connect no caben en un endpoint normal.
const ENDPOINTS = [
  {
    nombre: 'de la cuenta',
    connect: false,
    eventos: [
      'checkout.session.completed',
      'payment_intent.payment_failed',
      'transfer.reversed',
      'transfer.canceled',
    ],
  },
  { nombre: 'de cuentas conectadas', connect: true, eventos: ['account.updated'] },
]

const args = process.argv.slice(2)
const soloMirar = args.includes('--mirar')
const recrear = args.includes('--recrear')

let mal = 0
const ok = (t, extra = '') => console.log(`   OK    ${t}${extra ? `  — ${extra}` : ''}`)
const aviso = (t) => console.log(`   AVISO ${t}`)
const fallo = (t) => {
  mal += 1
  console.log(`   FALLO ${t}`)
}

/**
 * La clave, de un fichero y no de la linea de comandos: lo que se teclea
 * queda en el historial del terminal, y una clave real en el historial es
 * una clave filtrada.
 */
function laClave() {
  for (const f of ['.env.live', 'backend/.env.live']) {
    const p = path.join(RAIZ, f)
    if (!existsSync(p)) continue
    const m = readFileSync(p, 'utf8').match(/sk_(live|test)_[A-Za-z0-9]+/)
    if (m) return m[0]
  }
  return null
}

/** Netlify, sin shell y sin ensenar el valor por pantalla. */
function netlify(argv, valor) {
  const todo = valor === undefined ? argv : [...argv, valor]
  return execFileSync('npx', ['--no-install', 'netlify', ...todo], {
    cwd: RAIZ,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })
}

function ponerEnNetlify(nombre, valor, contextos) {
  netlify(
    [
      'env:set',
      nombre,
      '--context',
      ...contextos,
      '--scope',
      'builds',
      'functions',
      'runtime',
      '--secret',
      '--force',
    ],
    valor,
  )
}

/** Las claves de prueba que ya hay en el .env de local. */
function clavesDePrueba() {
  const p = path.join(RAIZ, '.env')
  if (!existsSync(p)) return {}
  const txt = readFileSync(p, 'utf8')
  const leer = (n) => txt.match(new RegExp(`^${n}\\s*=\\s*"?([^"\\r\\n]+)"?`, 'm'))?.[1]?.trim()
  return { secreta: leer('STRIPE_SECRET_KEY'), webhook: leer('STRIPE_WEBHOOK_SECRET') }
}

// ---------------------------------------------------------------------------
console.log('\n1. La clave')

const clave = laClave()

if (!clave) {
  console.log([
    '',
    '   No hay clave real que usar.',
    '',
    `   Pegala en ${path.join(RAIZ, '.env.live')} asi:`,
    '',
    '       STRIPE_SECRET_KEY=sk_live_...',
    '',
    '   y vuelve a lanzar: npm run stripe:real',
    '',
    '   Esta en Stripe con el modo de prueba APAGADO:',
    '   Desarrolladores -> Claves de API -> clave secreta.',
    '',
  ].join('\n'))
  process.exit(1)
}
if (!clave.startsWith('sk_live_')) {
  fallo('esa clave no es de modo real (las reales empiezan por sk_live_)')
  process.exit(1)
}
ok('clave de modo real', `sk_live_…${clave.slice(-4)}`)

const s = new Stripe(clave, { apiVersion: API_VERSION, maxNetworkRetries: 2 })

// ---------------------------------------------------------------------------
console.log('\n2. La cuenta de Stripe')

let cuenta
try {
  cuenta = await s.accounts.retrieve()
} catch (e) {
  fallo(`la clave no sirve: ${e.message}`)
  process.exit(1)
}

ok('la clave abre la cuenta', cuenta.id)
if (cuenta.id !== CUENTA) fallo(`es otra cuenta: se esperaba ${CUENTA}`)
if (cuenta.charges_enabled) ok('puede cobrar')
else fallo('la cuenta no puede cobrar todavia: Stripe pide completar el alta')
if (cuenta.payouts_enabled) ok('puede recibir pagos en el banco')
else aviso('los pagos al banco no estan activos: se puede cobrar, pero el dinero se queda en Stripe')

// Lo que ve un creador al darse de alta. Estuvo en "INMOPATH" de un proyecto
// anterior, y de ahi lo sacaba Stripe para el formulario de Connect.
const desc = cuenta.settings?.payments?.statement_descriptor || '(vacio)'
const panel = cuenta.settings?.dashboard?.display_name || '(vacio)'
console.log(`   extracto del banco: ${desc}`)
console.log(`   nombre en el panel: ${panel}`)
if (/inmopath|auttask/i.test(`${desc} ${panel}`)) {
  aviso('ahi sigue un nombre antiguo: Ajustes -> Pagos -> Datos publicos del negocio')
}

try {
  await s.accounts.list({ limit: 1 })
  ok('Connect esta activo en modo real')
} catch (e) {
  fallo(`Connect no esta activo en modo real: ${e.message}`)
}

// PayPal como metodo de pago. Se enciende aqui y no a mano porque en modo
// real es otra configuracion distinta de la de pruebas, y es justo el tipo de
// ajuste que se queda sin hacer.
//
// Encenderlo no basta para los cobros de colaboraciones: esos llevan datos de
// Connect, y PayPal junto a Connect lo tiene que aprobar Stripe a mano. Para
// las suscripciones si vale desde el primer momento.
if (!soloMirar) {
  try {
    const cfg = (await s.paymentMethodConfigurations.list({ limit: 5 })).data.find(
      (c) => c.is_default,
    )
    if (cfg) {
      const r = await s.paymentMethodConfigurations.update(cfg.id, {
        paypal: { display_preference: { preference: 'on' } },
      })
      if (r.paypal?.display_preference?.value === 'on') ok('PayPal activado como metodo de pago')
      else aviso('PayPal no se ha podido activar; hazlo desde Ajustes -> Metodos de pago')
    }
  } catch (e) {
    aviso(`PayPal no se ha podido activar: ${e.message}`)
  }
}

// ---------------------------------------------------------------------------
console.log('\n3. Los dos endpoints de webhook')

const existentes = (await s.webhookEndpoints.list({ limit: 100 })).data.filter(
  (e) => e.url === URL_WEBHOOK,
)
for (const e of existentes) {
  console.log(`   ya hay uno: ${e.id}  ${e.application ? '(connect)' : '(cuenta)'}  ${e.status}`)
}

if (existentes.length && !soloMirar && !recrear) {
  console.log([
    '',
    '   Esos endpoints ya existen y su secreto de firma no se puede volver a',
    '   leer: Stripe lo ensena una sola vez, al crearlo. Sin el secreto no se',
    '   puede verificar lo que entregan, asi que no sirven.',
    '',
    '   Si no se estan usando para nada, lanza:',
    '       npm run stripe:real -- --recrear',
    `   y se rehacen (se borran ${existentes.length} y se crean ${ENDPOINTS.length}).`,
    '',
  ].join('\n'))
  process.exit(1)
}

const secretos = []
if (soloMirar) {
  for (const e of ENDPOINTS) {
    const hay = existentes.some((x) => !!x.application === e.connect && x.status === 'enabled')
    if (hay) ok(`endpoint ${e.nombre}`, 'existe (secreto no legible)')
    else aviso(`falta el endpoint ${e.nombre}`)
  }
} else {
  for (const e of existentes) {
    await s.webhookEndpoints.del(e.id)
    ok('borrado el anterior', e.id)
  }
  for (const e of ENDPOINTS) {
    const creado = await s.webhookEndpoints.create({
      url: URL_WEBHOOK,
      enabled_events: e.eventos,
      connect: e.connect,
      api_version: API_VERSION,
      description: `Mikro · ${e.nombre}`,
    })
    secretos.push(creado.secret)
    ok(`endpoint ${e.nombre}`, `${creado.id} · ${e.eventos.length} eventos`)
  }
}

// ---------------------------------------------------------------------------
console.log('\n4. Netlify')

if (soloMirar) {
  console.log('   (--mirar: no se toca nada)')
} else {
  ponerEnNetlify('STRIPE_SECRET_KEY', clave, ['production'])
  ok('STRIPE_SECRET_KEY real en produccion')

  ponerEnNetlify('STRIPE_WEBHOOK_SECRET', secretos.join(','), ['production'])
  ok('STRIPE_WEBHOOK_SECRET con los dos secretos nuevos')

  // Las ramas y los previews se quedan en prueba a proposito: una rama a
  // medias no puede cobrarle a nadie de verdad.
  const prueba = clavesDePrueba()
  if (prueba.secreta?.startsWith('sk_test_') && prueba.webhook) {
    ponerEnNetlify('STRIPE_SECRET_KEY', prueba.secreta, ['deploy-preview', 'branch-deploy'])
    ponerEnNetlify('STRIPE_WEBHOOK_SECRET', prueba.webhook, ['deploy-preview', 'branch-deploy'])
    ok('previews y ramas se quedan en modo prueba')
  } else {
    aviso('no encuentro las claves de prueba en .env: los previews se quedan sin Stripe')
  }
}

console.log([
  '',
  '   Netlify solo recoge los ajustes nuevos al desplegar. Lo publicado ahora',
  '   mismo sigue con las claves de prueba hasta el siguiente despliegue.',
  '',
].join('\n'))

if (!soloMirar) {
  console.log(`   Borra el fichero con la clave cuando acabes: ${path.join(RAIZ, '.env.live')}\n`)
}

console.log(mal > 0 ? `=== ${mal} cosas mal ===\n` : '=== listo ===\n')
process.exit(mal > 0 ? 1 : 0)
