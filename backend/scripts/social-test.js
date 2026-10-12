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


// ---------------------------------------------------------------------------
console.log('\n--- Alta por @: normalizar lo que escriba la gente ---')

const { normalizarHandle, consultar, vaciarCache, lookupDisponible, proveedorLookup } =
  await import('../src/social/lookup.js')

check('con arroba', normalizarHandle('@pepe') === 'pepe')
check('sin arroba', normalizarHandle('pepe') === 'pepe')
check('con espacios', normalizarHandle('  @pepe  ') === 'pepe')
check('pegando la URL de Instagram', normalizarHandle('https://instagram.com/pepe/') === 'pepe')
check(
  'pegando la URL de TikTok, que lleva arroba',
  normalizarHandle('https://www.tiktok.com/@pepe') === 'pepe',
  normalizarHandle('https://www.tiktok.com/@pepe'),
)
check('con puntos y guiones bajos, que son validos', normalizarHandle('@pe.pe_1') === 'pe.pe_1')

console.log('\n--- Sin servicio configurado no se promete nada ---')

delete process.env.APIFY_TOKEN
delete process.env.SOCIAL_LOOKUP_PROVIDER
check('sin credenciales, no hay proveedor', proveedorLookup() === '')
check('y la plataforma no esta disponible por @', lookupDisponible('instagram') === false)

let fallo = null
try {
  await consultar('instagram', '@pepe')
} catch (e) {
  fallo = e.message
}
check('consultar falla con un motivo claro', /servicio de consulta/.test(fallo || ''), fallo)

process.env.APIFY_TOKEN = 'apify_token_de_prueba'
check('con token, el proveedor es apify', proveedorLookup() === 'apify')
check('instagram se puede consultar', lookupDisponible('instagram') === true)
check('tiktok tambien', lookupDisponible('tiktok') === true)
// YouTube tiene API oficial y gratis: no tiene por que pasar por un servicio
// de pago, y confundirlo seria pagar por lo que ya es gratis.
check('youtube no pasa por el servicio de pago', lookupDisponible('youtube') === false)

console.log('\n--- Lo que devuelve el servicio se traduce a lo nuestro ---')

// El fetch se sustituye por uno de mentira: estas pruebas comprueban la
// traduccion de la respuesta, que es donde esta el riesgo. Lo que no se puede
// probar aqui es que el servicio siga devolviendo estos campos; de eso avisa
// el syncError de la cuenta, que es visible.
const fetchReal = globalThis.fetch
let llamadas = []
const responder = (cuerpo, status = 200) => {
  globalThis.fetch = async (url, opciones) => {
    llamadas.push({ url: String(url), body: JSON.parse(opciones?.body || '{}') })
    return { ok: status >= 200 && status < 300, status, json: async () => cuerpo }
  }
}

const AHORA_ISO = AHORA.toISOString()

vaciarCache()
llamadas = []
responder([
  {
    id: '555',
    username: 'pepe',
    followersCount: 12000,
    profilePicUrl: 'https://cdn/x.jpg',
    biography: 'Fotografo en Madrid',
    latestPosts: [
      {
        id: 'p1',
        shortCode: 'abc',
        type: 'Video',
        caption: 'uno',
        likesCount: 400,
        commentsCount: 20,
        videoPlayCount: 9000,
        timestamp: AHORA_ISO,
        displayUrl: 'https://cdn/1.jpg',
      },
      {
        id: 'p2',
        type: 'Image',
        likesCount: 300,
        commentsCount: 10,
        timestamp: haceDias(5).toISOString(),
      },
    ],
  },
])

const ig = await consultar('instagram', '@PEPE')
check('los seguidores salen del perfil', ig.perfil.followers === 12000)
check('el @ se guarda como lo dice la plataforma', ig.perfil.handle === 'pepe')
check('la URL del perfil se arma sola', ig.perfil.url === 'https://instagram.com/pepe')
check('la biografia viene, que hace falta para verificar', /Madrid/.test(ig.perfil.descripcion))
check('llegan las dos publicaciones', ig.posts.length === 2, `${ig.posts.length}`)
check('los likes se traducen', ig.posts[0].likes === 400)
check('los comentarios tambien', ig.posts[0].comments === 20)
check('las visualizaciones de un video', ig.posts[0].views === 9000)
check('un video se marca como video', ig.posts[0].mediaType === 'VIDEO')
check('una foto no', ig.posts[1].mediaType === 'IMAGE')
check('la fecha se convierte a Date', ig.posts[0].publishedAt instanceof Date)
check('se pide solo ese usuario', llamadas[0]?.body?.usernames?.[0] === 'PEPE', JSON.stringify(llamadas[0]?.body))
// El token va en la URL del servicio, no en el cuerpo. Da igual donde, pero
// no en los dos sitios: un secreto repetido es un secreto que se filtra por
// el sitio que nadie estaba mirando.
check(
  'el token no viaja en el cuerpo',
  !JSON.stringify(llamadas[0]?.body || {}).includes('apify_token'),
)

// Lo importante de todo esto: con esas publicaciones, el engagement lo
// calculamos nosotros, con el mismo codigo que ya estaba probado arriba. El
// creador no escribe ninguna cifra en ningun sitio.
const resumenLookup = resumirCuenta({
  posts: ig.posts,
  followers: ig.perfil.followers,
  ahora: AHORA,
})
check(
  'el engagement se calcula de las publicaciones traidas',
  resumenLookup.engagement > 0,
  `${resumenLookup.engagement}%`,
)

console.log('\n--- El cache evita pagar dos veces la misma consulta ---')

// sincronizarCuenta pide el perfil y luego las publicaciones. Si eso fueran
// dos consultas, la factura seria el doble por el mismo dato.
const antes = llamadas.length
await consultar('instagram', '@pepe')
check('la segunda consulta no sale a la red', llamadas.length === antes)
vaciarCache()
await consultar('instagram', '@pepe')
check('tras vaciar el cache, si sale', llamadas.length === antes + 1)

console.log('\n--- TikTok viene al reves: videos con el autor dentro ---')

vaciarCache()
llamadas = []
responder([
  {
    id: 'v1',
    text: 'baile',
    createTimeISO: AHORA_ISO,
    diggCount: 5000,
    commentCount: 80,
    shareCount: 40,
    playCount: 120000,
    webVideoUrl: 'https://tiktok.com/@ana/video/v1',
    videoMeta: { coverUrl: 'https://cdn/c.jpg' },
    authorMeta: { id: '9', name: 'ana', fans: 45000, signature: 'mikro-abc123 en la bio' },
  },
  {
    id: 'v2',
    createTime: Math.floor(haceDias(3).getTime() / 1000),
    diggCount: 3000,
    commentCount: 20,
    authorMeta: { name: 'ana', fans: 45000 },
  },
])

const tt = await consultar('tiktok', 'ana')
check('los seguidores salen del autor del video', tt.perfil.followers === 45000)
check('el @ sale del autor', tt.perfil.handle === 'ana')
check('la URL de TikTok lleva arroba', tt.perfil.url === 'https://tiktok.com/@ana')
check('llegan los dos videos', tt.posts.length === 2)
check('diggCount son los likes', tt.posts[0].likes === 5000)
check('playCount son las visualizaciones', tt.posts[0].views === 120000)
check('los compartidos se guardan', tt.posts[0].shares === 40)
check(
  'createTime en segundos se convierte bien',
  tt.posts[1].publishedAt?.toISOString().slice(0, 10) === haceDias(3).toISOString().slice(0, 10),
)
check('se piden las publicaciones del perfil', llamadas[0]?.body?.profiles?.[0] === 'ana')

console.log('\n--- Cuando el servicio falla, se dice que ha fallado ---')

vaciarCache()
responder({ error: { message: 'sin saldo' } }, 402)
let msg402 = null
try {
  await consultar('instagram', 'pepe')
} catch (e) {
  msg402 = e.message
}
check('quedarse sin saldo tiene su propio aviso', /sin saldo/i.test(msg402 || ''), msg402)

vaciarCache()
responder([], 200)
let msgVacio = null
try {
  await consultar('instagram', 'nopepe')
} catch (e) {
  msgVacio = e.message
}
check('un perfil que no existe lo dice', /no se encontró/i.test(msgVacio || ''), msgVacio)

vaciarCache()
responder([{ error: 'not_found', errorDescription: 'El perfil es privado' }])
let msgPriv = null
try {
  await consultar('instagram', 'privado')
} catch (e) {
  msgPriv = e.message
}
check('un perfil privado explica por que', /privado/i.test(msgPriv || ''), msgPriv)

globalThis.fetch = fetchReal

// ---------------------------------------------------------------------------
console.log('\n--- El codigo que prueba que la cuenta es tuya ---')

process.env.JWT_SECRET = 'secreto-de-prueba'
const { codigoPara, contiene, cuentaParaElPerfil } = await import('../src/social/propiedad.js')

const c1 = codigoPara('creador-1', 'instagram')
check('tiene la forma esperada', /^mikro-[0-9a-f]{6}$/.test(c1), c1)
check('es el mismo si vuelve manana', codigoPara('creador-1', 'instagram') === c1)
check('es distinto en otra red', codigoPara('creador-1', 'tiktok') !== c1)
// Si fuera adivinable, cualquiera podria poner el codigo de otro en su propia
// biografia y verificar una cuenta que no es suya.
check('es distinto para otro creador', codigoPara('creador-2', 'instagram') !== c1)

check('se encuentra tal cual', contiene(`Fotógrafo · ${c1}`, c1))
check('en mayusculas tambien', contiene(c1.toUpperCase(), c1))
check('con el guion raro que mete el movil', contiene(c1.replace('-', '–'), c1))
check('con espacios alrededor', contiene(`  ${c1}  `, c1))
check('si no esta, no esta', contiene('Fotógrafo en Madrid', c1) === false)
check('un codigo parecido no vale', contiene('mikro-000000', c1) === false)

console.log('\n--- Que cuentas salen al escaparate ---')

const base = { source: 'CONNECTED', followers: 10000 }
check('autorizada, si', cuentaParaElPerfil({ ...base, metodo: 'OAUTH' }) === true)
check(
  'por @ y verificada, si',
  cuentaParaElPerfil({ ...base, metodo: 'LOOKUP', ownershipVerifiedAt: AHORA }) === true,
)
// La que de verdad importa: cifras reales de una cuenta que quiza no es suya.
check(
  'por @ y sin verificar, NO',
  cuentaParaElPerfil({ ...base, metodo: 'LOOKUP', ownershipVerifiedAt: null }) === false,
)
check(
  'declarada, no',
  cuentaParaElPerfil({ source: 'DECLARED', followers: 10000, metodo: 'OAUTH' }) === false,
)
check('sin seguidores, no', cuentaParaElPerfil({ ...base, followers: 0, metodo: 'OAUTH' }) === false)

console.log('\n--- De cuantas formas se puede dar de alta cada red ---')

process.env.APIFY_TOKEN = 'apify_token_de_prueba'
process.env.YOUTUBE_API_KEY = 'clave-de-prueba'
delete process.env.INSTAGRAM_APP_ID
delete process.env.INSTAGRAM_APP_SECRET
const { modosDe, estadoPlataformas } = await import('../src/social/config.js')

check('youtube, solo por el canal', modosDe('youtube').join() === 'handle')
check('instagram sin credenciales de OAuth, solo por @', modosDe('instagram').join() === 'handle')

process.env.INSTAGRAM_APP_ID = 'id'
process.env.INSTAGRAM_APP_SECRET = 'secreto'
check(
  'con las dos cosas, el @ va primero',
  modosDe('instagram').join() === 'handle,oauth',
  modosDe('instagram').join(),
)

delete process.env.APIFY_TOKEN
check('sin servicio de consulta queda OAuth', modosDe('instagram').join() === 'oauth')

delete process.env.INSTAGRAM_APP_ID
check('sin nada, ninguna forma', modosDe('instagram').length === 0)

delete process.env.YOUTUBE_API_KEY
check('youtube sin clave tampoco', modosDe('youtube').length === 0)
check(
  'y la interfaz se entera de que no hay nada',
  estadoPlataformas().every((p) => p.disponible === false && p.porHandle === false),
)

console.log(`\n=== ${passed} correctas, ${failed} fallidas ===\n`)
process.exit(failed > 0 ? 1 : 0)
