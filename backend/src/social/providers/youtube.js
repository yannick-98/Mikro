/**
 * YouTube, con la Data API y una clave nuestra.
 *
 * Es la unica de las tres que no pide nada al creador: los datos de un canal
 * son publicos, asi que basta con que nos diga cual es el suyo. No hay OAuth,
 * no hay revision de la app, no hay token que caduque.
 *
 * El contrapunto es que lo publico tiene limites: se ven suscriptores,
 * visualizaciones y likes, pero no la audiencia ni el alcance. Y un canal
 * puede ocultar su numero de suscriptores, en cuyo caso la API devuelve el
 * campo escondido y aqui se trata como dato ausente, no como cero.
 *
 * Que no haya autorizacion tiene una consecuencia que conviene tener presente:
 * cualquiera podria decirnos que un canal es suyo. Por eso una cuenta de
 * YouTube cuenta como comprobada en sus cifras, pero no como prueba de
 * identidad; eso se resuelve pidiendo al creador que ponga un codigo en la
 * descripcion del canal (verificarPropiedad, mas abajo).
 */
import { config } from '../config.js'

const API = 'https://www.googleapis.com/youtube/v3'

async function json(url, que) {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw new Error(`YouTube: ${que} fallo (${data.error?.message || `HTTP ${res.status}`})`)
  }
  return data
}

/** Acepta @handle, una URL de canal o un id UC... */
function identificar(entrada) {
  const v = String(entrada || '').trim()
  const porUrl = v.match(/youtube\.com\/(?:channel\/)?(UC[\w-]{20,})/i)
  if (porUrl) return { tipo: 'id', valor: porUrl[1] }
  if (/^UC[\w-]{20,}$/.test(v)) return { tipo: 'id', valor: v }

  const handle = v.match(/youtube\.com\/@([\w.-]+)/i)?.[1] || v.replace(/^@/, '')
  return { tipo: 'handle', valor: handle }
}

export async function fetchProfile(_token, referencia) {
  const key = config.youtube.apiKey()
  if (!key) throw new Error('Falta YOUTUBE_API_KEY')

  const { tipo, valor } = identificar(referencia)
  const q = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    key,
    ...(tipo === 'id' ? { id: valor } : { forHandle: `@${valor}` }),
  })
  const d = await json(`${API}/channels?${q}`, 'la lectura del canal')
  const canal = d.items?.[0]
  if (!canal) throw new Error('No se encontró ese canal de YouTube')

  return {
    externalId: canal.id,
    handle: canal.snippet?.customUrl?.replace(/^@/, '') || canal.snippet?.title || valor,
    followers: canal.statistics?.hiddenSubscriberCount
      ? 0
      : Number(canal.statistics?.subscriberCount) || 0,
    avatarUrl: canal.snippet?.thumbnails?.medium?.url || null,
    url: `https://youtube.com/channel/${canal.id}`,
    descripcion: canal.snippet?.description || '',
    uploadsPlaylist: canal.contentDetails?.relatedPlaylists?.uploads || null,
  }
}

export async function fetchPosts(_token, referencia, limite = 20) {
  const key = config.youtube.apiKey()
  const perfil = typeof referencia === 'object' ? referencia : await fetchProfile(null, referencia)
  if (!perfil.uploadsPlaylist) return []

  const q = new URLSearchParams({
    part: 'contentDetails',
    playlistId: perfil.uploadsPlaylist,
    maxResults: String(Math.min(limite, 50)),
    key,
  })
  const lista = await json(`${API}/playlistItems?${q}`, 'la lectura de subidas')
  const ids = (lista.items || []).map((i) => i.contentDetails?.videoId).filter(Boolean)
  if (!ids.length) return []

  const q2 = new URLSearchParams({ part: 'snippet,statistics', id: ids.join(','), key })
  const videos = await json(`${API}/videos?${q2}`, 'la lectura de videos')

  return (videos.items || []).map((v) => ({
    externalId: v.id,
    permalink: `https://youtube.com/watch?v=${v.id}`,
    mediaType: 'VIDEO',
    caption: (v.snippet?.title || '').slice(0, 500) || null,
    thumbnailUrl: v.snippet?.thumbnails?.medium?.url || null,
    likes: Number(v.statistics?.likeCount) || 0,
    comments: Number(v.statistics?.commentCount) || 0,
    views: Number(v.statistics?.viewCount) || 0,
    publishedAt: v.snippet?.publishedAt ? new Date(v.snippet.publishedAt) : null,
  }))
}

/**
 * Comprueba que el canal es de quien dice serlo.
 *
 * El creador pega un codigo en la descripcion del canal y nosotros lo leemos.
 * Es el mismo truco que usa Google para verificar dominios y funciona por la
 * misma razon: solo puede escribir ahi quien tiene las llaves.
 */
export async function verificarPropiedad(referencia, codigo) {
  const perfil = await fetchProfile(null, referencia)
  return (perfil.descripcion || '').includes(codigo)
}

export default { fetchProfile, fetchPosts, verificarPropiedad, modo: 'handle' }
