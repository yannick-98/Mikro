/**
 * Pruebas del calculo de metricas y del cifrado de credenciales.
 *
 *   node backend/scripts/social-test.js
 *
 * No toca la red ni la base de datos. Aqui se comprueba lo que decide el orden
 * del ranking: si el engagement se calcula mal, el error no da ninguna senal,
 * solo coloca a la gente en el puesto que no le toca.
 */
import crypto from 'node:crypto'

process.env.SECRETS_KEY = crypto.randomBytes(32).toString('hex')

const {
  seleccionarPosts,
  engagementRate,
  engagementByViews,
  postsPerWeek,
  anomalias,
  resumirCuenta,
  MIN_POSTS,
} = await import('../src/social/metrics.js')
const { encrypt, decrypt, resetSecretsCache } = await import('../src/lib/secrets.js')

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

const AHORA = new Date('2026-10-11T12:00:00Z')
const haceDias = (d) => new Date(AHORA.getTime() - d * 86400000)

const post = (d, likes, comments, extra = {}) => ({
  publishedAt: haceDias(d),
  likes,
  comments,
  views: 0,
  shares: 0,
  ...extra,
})

// ---------------------------------------------------------------------------
console.log('\n--- Seleccion de publicaciones ---')

const surtido = [
  post(0.2, 10, 1), // demasiado reciente: todavia esta sumando
  post(2, 100, 5),
  post(10, 120, 8),
  post(200, 900, 50), // fuera de la ventana
]
const elegidas = seleccionarPosts(surtido, AHORA)
check('la de hace dos horas no cuenta', !elegidas.some((p) => p.likes === 10))
check('la de hace 200 dias no cuenta', !elegidas.some((p) => p.likes === 900))
check('quedan las de la ventana', elegidas.length === 2, `${elegidas.length}`)
check('vienen de la mas nueva a la mas vieja', elegidas[0].likes === 100)
check('sin publicaciones no revienta', seleccionarPosts(null, AHORA).length === 0)

// ---------------------------------------------------------------------------
console.log('\n--- Engagement ---')

const diez = [post(1, 90, 10), post(3, 90, 10), post(5, 90, 10)]
check('media simple sobre seguidores', engagementRate(diez, 1000) === 10, `${engagementRate(diez, 1000)}`)
check('sin seguidores no hay tasa', engagementRate(diez, 0) === null)
check('sin publicaciones no hay tasa', engagementRate([], 1000) === null)

// La media de razones y no la razon de totales: un viral no puede disfrazar
// una cuenta que normalmente no mueve a nadie.
const conViral = [post(1, 9700, 300), post(3, 10, 0), post(5, 10, 0)]
const porRazones = engagementRate(conViral, 10000)
check('un viral no arrastra la media entera', porRazones < 34 && porRazones > 33, `${porRazones}`)

const videos = [
  post(1, 100, 10, { views: 10000, shares: 40 }),
  post(4, 200, 20, { views: 20000, shares: 80 }),
]
check('engagement por visualizaciones', engagementByViews(videos) === 1.5, `${engagementByViews(videos)}`)
check('sin vistas no se inventa', engagementByViews(diez) === null)

// ---------------------------------------------------------------------------
console.log('\n--- Frecuencia ---')

const semanal = seleccionarPosts([post(1, 1, 1), post(8, 1, 1), post(15, 1, 1), post(22, 1, 1)], AHORA)
const porSemana = postsPerWeek(semanal, AHORA)
check('una por semana sale ~1', porSemana >= 1.2 && porSemana <= 1.4, `${porSemana}`)

const rafaga = seleccionarPosts([post(1, 1, 1), post(2, 1, 1), post(3, 1, 1), post(4, 1, 1)], AHORA)
check('una rafaga reciente no se diluye', postsPerWeek(rafaga, AHORA) === 7, `${postsPerWeek(rafaga, AHORA)}`)
check('sin publicaciones, cero', postsPerWeek([], AHORA) === 0)

// ---------------------------------------------------------------------------
console.log('\n--- Senales de cifras infladas ---')

const sinConversacion = Array.from({ length: 6 }, (_, i) => post(i + 1, 5000, 2))
const avisos1 = anomalias({ posts: sinConversacion, followers: 50000, snapshots: [] })
check('likes sin comentarios se marca', avisos1.some((a) => a.codigo === 'POCOS_COMENTARIOS'))

const normal = Array.from({ length: 6 }, (_, i) => post(i + 1, 1000, 25))
check(
  'una cuenta normal no se marca',
  !anomalias({ posts: normal, followers: 30000, snapshots: [] }).length,
)

const saltos = [
  { followers: 10000, takenAt: haceDias(6) },
  { followers: 14000, takenAt: haceDias(3) },
]
check(
  'un salto de seguidores se marca',
  anomalias({ posts: normal, followers: 14000, snapshots: saltos }).some(
    (a) => a.codigo === 'SALTO_SEGUIDORES',
  ),
)

const crecimientoSano = [
  { followers: 10000, takenAt: haceDias(6) },
  { followers: 10300, takenAt: haceDias(3) },
]
check(
  'crecer un 3% no es sospechoso',
  !anomalias({ posts: normal, followers: 10300, snapshots: crecimientoSano }).some(
    (a) => a.codigo === 'SALTO_SEGUIDORES',
  ),
)

const imposible = Array.from({ length: 6 }, (_, i) => post(i + 1, 8000, 400))
check(
  'un engagement imposible se marca',
  anomalias({ posts: imposible, followers: 20000, snapshots: [] }).some(
    (a) => a.codigo === 'ENGAGEMENT_IMPROBABLE',
  ),
)

// ---------------------------------------------------------------------------
console.log('\n--- Resumen de una cuenta ---')

const pocas = resumirCuenta({ posts: [post(1, 100, 10)], followers: 5000, ahora: AHORA })
check('con una sola publicacion no hay muestra', pocas.suficiente === false)
check('y aun asi devuelve cifras', typeof pocas.engagement === 'number')
check('no se marcan anomalias sin muestra', pocas.anomalias.length === 0)
check(`el minimo son ${MIN_POSTS} publicaciones`, MIN_POSTS === 3)

const completo = resumirCuenta({
  posts: [post(1, 300, 20), post(4, 280, 18), post(7, 320, 22), post(10, 290, 20)],
  followers: 10000,
  ahora: AHORA,
})
check('con cuatro publicaciones ya hay muestra', completo.suficiente === true)
check('cuenta las analizadas', completo.postsAnalyzed === 4)
check('engagement alrededor del 3,1%', completo.engagement > 3 && completo.engagement < 3.2, `${completo.engagement}`)
check('media de likes', completo.avgLikes === 298, `${completo.avgLikes}`)
check('guarda la fecha de la ultima', completo.lastPostAt?.getTime() === haceDias(1).getTime())

// ---------------------------------------------------------------------------
console.log('\n--- Cifrado de credenciales ---')

const token = 'IGQWRPc2FAkZAHRWUVdxdHM3eF9rWlhmX0ZAtest-0123456789'
const cifrado = encrypt(token)
check('el cifrado no se parece al original', !cifrado.includes(token))
check('y se puede volver a leer', decrypt(cifrado) === token)
check('dos cifrados del mismo valor son distintos', encrypt(token) !== encrypt(token))
check('vacio no se cifra', encrypt('') === null && encrypt(null) === null)
check('con basura pegada al final no se descifra', decrypt(`${cifrado}x`) === null)

// Manipulacion de verdad: cambiar un caracter dentro del texto cifrado. GCM
// autentica, asi que esto tiene que fallar al descifrar y no devolver basura.
const partes = cifrado.split(':')
const trastocado = partes[3][0] === 'A' ? 'B' : 'A'
check(
  'un texto cifrado manipulado no se descifra',
  decrypt([partes[0], partes[1], partes[2], trastocado + partes[3].slice(1)].join(':')) === null,
)
check(
  'una etiqueta manipulada no se descifra',
  decrypt([partes[0], partes[1], Buffer.alloc(16).toString('base64'), partes[3]].join(':')) === null,
)
check('basura no revienta', decrypt('nada-de-nada') === null)
check('un numero de partes raro se rechaza', decrypt('v1:solo:dos') === null)

// Cambiar la clave no debe dar un texto equivocado: debe no dar nada.
process.env.SECRETS_KEY = crypto.randomBytes(32).toString('hex')
resetSecretsCache()
check('con otra clave no se descifra', decrypt(cifrado) === null)

process.env.SECRETS_KEY = ''
resetSecretsCache()
let lanzo = false
try {
  encrypt('algo')
} catch {
  lanzo = true
}
check('sin clave configurada, cifrar falla en vez de guardar en claro', lanzo)

console.log(`\n=== ${passed} correctas, ${failed} fallidas ===\n`)
process.exit(failed > 0 ? 1 : 0)
