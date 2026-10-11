/**
 * TikTok, con Login Kit y la Display API.
 *
 * Dos diferencias con Instagram que importan al escribir el codigo:
 *
 *  - los permisos van separados. user.info.basic da el nombre, pero los
 *    seguidores estan en user.info.stats, que es un permiso aparte. Pedir solo
 *    el basico y esperar follower_count es el error clasico aqui.
 *  - la lista de videos es un POST, no un GET, y los campos se piden en la
 *    query mientras el cuerpo lleva la paginacion. Es raro, pero es asi.
 *
 * El token dura 24 horas y el de refresco 365 dias, asi que renovar no es un
 * caso excepcional: es lo normal en cada sincronizacion.
 */
import { config, redirectUri } from '../config.js'

const SCOPES = ['user.info.basic', 'user.info.stats', 'video.list']
const API = 'https://open.tiktokapis.com/v2'

export function authUrl(state) {
  const q = new URLSearchParams({
    client_key: config.tiktok.clientId(),
    scope: SCOPES.join(','),
    response_type: 'code',
    redirect_uri: redirectUri('tiktok'),
    state,
  })
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`
}

async function json(res, que) {
  const data = await res.json().catch(() => ({}))
  // TikTok contesta 200 con el fallo dentro de error.code, asi que mirar solo
  // el codigo HTTP deja pasar errores como si fueran respuestas buenas.
  const err = data.error
  const malo = !res.ok || (err && err.code && err.code !== 'ok')
  if (malo) {
    throw new Error(`TikTok: ${que} fallo (${err?.message || err?.code || `HTTP ${res.status}`})`)
  }
  return data
}

async function token(params) {
  const d = await json(
    await fetch(`${API}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: config.tiktok.clientId(),
        client_secret: config.tiktok.clientSecret(),
        ...params,
      }),
    }),
    'el canje del token',
  )
  return {
    accessToken: d.access_token,
    refreshToken: d.refresh_token || null,
    externalId: d.open_id ? String(d.open_id) : null,
    expiresIn: Number(d.expires_in) || 86400,
    scopes: d.scope || SCOPES.join(','),
  }
}

export const exchangeCode = (code) =>
  token({ code, grant_type: 'authorization_code', redirect_uri: redirectUri('tiktok') })

export const refresh = (refreshToken) =>
  token({ grant_type: 'refresh_token', refresh_token: refreshToken })

export async function fetchProfile(accessToken) {
  const q = new URLSearchParams({
    fields: 'open_id,display_name,username,avatar_url,follower_count,likes_count,video_count',
  })
  const d = await json(
    await fetch(`${API}/user/info/?${q}`, { headers: { Authorization: `Bearer ${accessToken}` } }),
    'la lectura del perfil',
  )
  const u = d.data?.user || {}
  return {
    externalId: String(u.open_id || ''),
    handle: u.username || u.display_name || '',
    followers: Number(u.follower_count) || 0,
    avatarUrl: u.avatar_url || null,
    url: u.username ? `https://tiktok.com/@${u.username}` : null,
  }
}

export async function fetchPosts(accessToken, limite = 20) {
  const q = new URLSearchParams({
    fields:
      'id,title,video_description,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time',
  })
  const d = await json(
    await fetch(`${API}/video/list/?${q}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_count: Math.min(limite, 20) }),
    }),
    'la lectura de videos',
  )

  return (d.data?.videos || []).map((v) => ({
    externalId: String(v.id),
    permalink: v.share_url || null,
    mediaType: 'VIDEO',
    caption: (v.title || v.video_description || '').slice(0, 500) || null,
    thumbnailUrl: v.cover_image_url || null,
    likes: Number(v.like_count) || 0,
    comments: Number(v.comment_count) || 0,
    shares: Number(v.share_count) || 0,
    views: Number(v.view_count) || 0,
    // create_time viene en segundos desde epoch, no en milisegundos.
    publishedAt: v.create_time ? new Date(Number(v.create_time) * 1000) : null,
  }))
}

export default { authUrl, exchangeCode, refresh, fetchProfile, fetchPosts, modo: 'oauth' }
