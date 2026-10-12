/**
 * Consultar un perfil publico por su @, sin pedirle permiso a nadie.
 *
 * ## Por que existe esto, habiendo OAuth
 *
 * Conectar la cuenta de verdad es mejor dato y peor producto. Un creador que
 * se registra tiene que salir de Mikro, entrar en Instagram, aceptar una
 * pantalla de permisos que habla de "acceso a tu contenido" y volver. Ahi se
 * cae gente, y la que se cae es justo la que no conoce la marca todavia.
 *
 * Escribir su @ y que las cifras aparezcan solas es otra cosa. A cambio hay
 * que tener claro que se pierde, que es bastante:
 *
 *  - **No prueba de quien es la cuenta.** Cualquiera puede escribir @cristiano
 *    en el formulario. Esto se resuelve aparte, con un codigo en la biografia
 *    (social/propiedad.js), y es imprescindible: en Mikro se cobra dinero.
 *  - **Solo lo publico.** Seguidores, likes, comentarios y fechas si; alcance,
 *    impresiones y datos de audiencia no, porque eso solo lo ve el dueno.
 *  - **Se paga por consulta.** No es una API oficial gratis: es un servicio
 *    que cobra por perfil consultado. De ahi el cache y los intervalos
 *    largos de aqui abajo; sin ellos, una tarea diaria multiplica la factura
 *    por el numero de creadores.
 *  - **Puede romperse.** El servicio raspa perfiles publicos. Cuando la
 *    plataforma cambia algo, se rompe y lo arregla el servicio, no nosotros,
 *    pero mientras tanto no hay datos.
 *
 * Lo que NO se pierde, y es lo que importa: el engagement y la frecuencia los
 * seguimos calculando **nosotros** a partir de las publicaciones reales
 * (metrics.js). El creador no escribe ninguna cifra en ningun sitio.
 *
 * ## Proveedores
 *
 * Esto es una capa fina a proposito. El proveedor se elige por variable de
 * entorno y lo que sale de aqui esta normalizado, asi que cambiarlo es
 * escribir una funcion y no tocar el resto de la aplicacion.
 *
 * YouTube no pasa por aqui: tiene API oficial y gratis, y ya la usa su
 * proveedor.
 */


export const PLATAFORMAS_LOOKUP = ['instagram', 'tiktok']

/**
 * Cuantas publicaciones se piden. Veinte son de sobra para el calculo
 * (metrics.js mira noventa dias y pide tres como minimo) y cada una de mas se
 * paga.
 */
const POSTS = 20

/**
 * Cache en memoria, de un minuto.
 *
 * No es por velocidad: es porque sincronizar una cuenta pide el perfil y
 * luego las publicaciones, y en estos servicios las dos cosas vienen de la
 * misma consulta cobrada. Sin esto, cada sincronizacion pagaria el doble.
 *
 * Un minuto porque solo tiene que cubrir una sincronizacion, no servir de
 * almacen: lo que hay que guardar se guarda en la base.
 */
const cache = new Map()
const CACHE_MS = 60 * 1000

function deCache(clave) {
  const e = cache.get(clave)
  if (!e) return null
  if (Date.now() - e.t > CACHE_MS) {
    cache.delete(clave)
    return null
  }
  return e.v
}

export function vaciarCache() {
  cache.clear()
}

/** Acepta @nombre, nombre, o la URL del perfil. */
export function normalizarHandle(entrada) {
  const v = String(entrada || '').trim()
  const deUrl = v.match(/(?:instagram\.com|tiktok\.com)\/@?([A-Za-z0-9._]+)/i)
  return (deUrl ? deUrl[1] : v.replace(/^@/, '')).replace(/\/$/, '').trim()
}

/** Que servicio esta configurado. Vacio si ninguno. */
export function proveedorLookup() {
  const elegido = (process.env.SOCIAL_LOOKUP_PROVIDER || '').trim().toLowerCase()
  if (elegido) return SERVICIOS[elegido] ? elegido : ''
  if (process.env.APIFY_TOKEN) return 'apify'
  return ''
}

export function lookupDisponible(platform) {
  return PLATAFORMAS_LOOKUP.includes(platform) && !!proveedorLookup()
}

// ---------------------------------------------------------------------------
// Apify
//
// Se paga por resultado y tiene una capa gratuita, asi que se puede probar
// sin contratar nada. Cada plataforma es un "actor" distinto con su propia
// forma de entrada y de salida; lo que hacen los dos adaptadores de abajo es
// traducir eso a la forma que usa Mikro.
//
// Los nombres de campo se leen con alternativas a proposito: estos actores
// los cambian de vez en cuando, y es mejor quedarse sin un dato que tirar la
// sincronizacion entera.
// ---------------------------------------------------------------------------

const ACTORES = {
  instagram: process.env.APIFY_ACTOR_INSTAGRAM || 'apify~instagram-profile-scraper',
  tiktok: process.env.APIFY_ACTOR_TIKTOK || 'clockworks~tiktok-scraper',
}

async function apify(platform, handle) {
  const token = process.env.APIFY_TOKEN
  const entrada =
    platform === 'instagram'
      ? { usernames: [handle] }
      : { profiles: [handle], resultsPerPage: POSTS, shouldDownloadVideos: false, shouldDownloadCovers: false }

  const url =
    `https://api.apify.com/v2/acts/${ACTORES[platform]}/run-sync-get-dataset-items` +
    `?token=${encodeURIComponent(token)}&clean=true&limit=${POSTS + 1}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entrada),
    // El servicio corta a los 300 s; antes de eso ya no merece la pena
    // esperar, porque al otro lado hay alguien mirando una pantalla.
    signal: AbortSignal.timeout(90_000),
  })

  const datos = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = datos?.error?.message || `HTTP ${res.status}`
    // 402 es "se ha agotado el saldo". Merece su propio mensaje porque la
    // solucion no es reintentar.
    if (res.status === 402) throw new Error('El servicio de consulta se ha quedado sin saldo')
    throw new Error(`El servicio de consulta falló (${msg})`)
  }
  if (!Array.isArray(datos) || !datos.length) {
    throw new Error('No se encontró ese perfil')
  }

  return platform === 'instagram' ? deApifyInstagram(datos, handle) : deApifyTikTok(datos, handle)
}

const num = (...v) => {
  for (const x of v) if (typeof x === 'number' && Number.isFinite(x)) return x
  return 0
}

function deApifyInstagram(datos, handle) {
  const p = datos[0]
  if (p.error || p.errorDescription) throw new Error(p.errorDescription || 'No se encontró ese perfil')

  const nombre = p.username || handle
  const posts = (p.latestPosts || p.posts || []).slice(0, POSTS).map((m) => ({
    externalId: String(m.id || m.shortCode || m.shortcode || ''),
    permalink: m.url || (m.shortCode ? `https://instagram.com/p/${m.shortCode}` : null),
    mediaType: (m.type || 'IMAGE').toUpperCase().includes('VIDEO') ? 'VIDEO' : 'IMAGE',
    caption: (m.caption || '').slice(0, 500) || null,
    thumbnailUrl: m.displayUrl || m.thumbnailUrl || null,
    likes: num(m.likesCount, m.likes),
    comments: num(m.commentsCount, m.comments),
    views: num(m.videoPlayCount, m.videoViewCount, m.playCount),
    publishedAt: m.timestamp ? new Date(m.timestamp) : null,
  }))

  return {
    perfil: {
      externalId: String(p.id || p.userId || nombre),
      handle: nombre,
      followers: num(p.followersCount, p.followers),
      url: `https://instagram.com/${nombre}`,
      avatarUrl: p.profilePicUrlHD || p.profilePicUrl || null,
      descripcion: p.biography || p.bio || '',
    },
    posts: posts.filter((x) => x.externalId),
  }
}

function deApifyTikTok(datos, handle) {
  // Este actor devuelve videos, no un perfil: los datos de la cuenta vienen
  // repetidos dentro de cada video.
  const autor = datos.find((d) => d.authorMeta)?.authorMeta || {}
  const nombre = autor.name || autor.uniqueId || handle

  const posts = datos
    .filter((d) => d.id || d.webVideoUrl)
    .slice(0, POSTS)
    .map((d) => ({
      externalId: String(d.id || d.webVideoUrl),
      permalink: d.webVideoUrl || null,
      mediaType: 'VIDEO',
      caption: (d.text || '').slice(0, 500) || null,
      thumbnailUrl: d.videoMeta?.coverUrl || d.covers?.default || null,
      likes: num(d.diggCount, d.likes),
      comments: num(d.commentCount, d.comments),
      views: num(d.playCount, d.views),
      shares: num(d.shareCount),
      publishedAt: d.createTimeISO
        ? new Date(d.createTimeISO)
        : d.createTime
          ? new Date(Number(d.createTime) * 1000)
          : null,
    }))

  return {
    perfil: {
      externalId: String(autor.id || nombre),
      handle: nombre,
      followers: num(autor.fans, autor.followerCount),
      url: `https://tiktok.com/@${nombre}`,
      avatarUrl: autor.avatar || null,
      descripcion: autor.signature || '',
    },
    posts,
  }
}

const SERVICIOS = { apify }

// ---------------------------------------------------------------------------

/**
 * Perfil y publicaciones de un @, en la forma que usa Mikro.
 *
 * Una sola funcion y no dos porque los servicios cobran por consulta: pedir
 * el perfil y las publicaciones por separado seria pagar dos veces lo mismo.
 */
export async function consultar(platform, entrada) {
  if (!PLATAFORMAS_LOOKUP.includes(platform)) {
    throw new Error(`${platform} no se consulta por @`)
  }
  const servicio = proveedorLookup()
  if (!servicio) throw new Error('No hay servicio de consulta configurado')

  const handle = normalizarHandle(entrada)
  if (!handle) throw new Error('Dinos tu usuario, por ejemplo @mikro')

  const clave = `${servicio}:${platform}:${handle.toLowerCase()}`
  const guardado = deCache(clave)
  if (guardado) return guardado

  const resultado = await SERVICIOS[servicio](platform, handle)
  cache.set(clave, { t: Date.now(), v: resultado })
  return resultado
}

export default {
  consultar,
  lookupDisponible,
  proveedorLookup,
  normalizarHandle,
  vaciarCache,
  PLATAFORMAS_LOOKUP,
}
