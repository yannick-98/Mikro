/**
 * Instagram, con Instagram Login.
 *
 * Es el camino nuevo: el creador entra con su cuenta de Instagram
 * profesional y no hace falta que tenga una pagina de Facebook enlazada, que
 * era la pega del flujo antiguo y la razon por la que la mitad de los
 * creadores se quedaban por el camino.
 *
 * El recorrido tiene tres pasos y conviene no saltarse ninguno:
 *   1. el creador autoriza en instagram.com y vuelve con un codigo;
 *   2. el codigo se canjea en api.instagram.com por un token corto (1 hora);
 *   3. el token corto se cambia en graph.instagram.com por uno largo (60
 *      dias), que es el unico que vale para trabajar.
 *
 * El token largo se renueva solo mientras se use. Si un creador deja la cuenta
 * conectada y no entra en dos meses, caduca y hay que volver a pedirle
 * permiso: por eso sync marca el error en vez de borrar la cuenta.
 */
import { config, redirectUri } from '../config.js'

const SCOPES = ['instagram_business_basic']

const base = () => `https://graph.instagram.com/${config.instagram.version()}`

/** A donde se manda al creador para que autorice. */
export function authUrl(state) {
  const q = new URLSearchParams({
    client_id: config.instagram.clientId(),
    redirect_uri: redirectUri('instagram'),
    response_type: 'code',
    scope: SCOPES.join(','),
    state,
  })
  return `https://www.instagram.com/oauth/authorize?${q}`
}

async function json(res, que) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error || data.error_message) {
    const msg = data.error?.message || data.error_message || `HTTP ${res.status}`
    throw new Error(`Instagram: ${que} fallo (${msg})`)
  }
  return data
}

/** Canjea el codigo por un token largo. Devuelve lo que hay que guardar. */
export async function exchangeCode(code) {
  const corto = await json(
    await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.instagram.clientId(),
        client_secret: config.instagram.clientSecret(),
        grant_type: 'authorization_code',
        redirect_uri: redirectUri('instagram'),
        code,
      }),
    }),
    'el canje del codigo',
  )

  const q = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: config.instagram.clientSecret(),
    access_token: corto.access_token,
  })
  const largo = await json(
    await fetch(`https://graph.instagram.com/access_token?${q}`),
    'el cambio a token largo',
  )

  return {
    accessToken: largo.access_token,
    externalId: String(corto.user_id || ''),
    expiresIn: Number(largo.expires_in) || 60 * 86400,
    scopes: SCOPES.join(','),
  }
}

/** Renueva el token largo. Solo funciona si tiene mas de 24 h de vida. */
export async function refresh(accessToken) {
  const q = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: accessToken })
  const data = await json(
    await fetch(`https://graph.instagram.com/refresh_access_token?${q}`),
    'la renovacion del token',
  )
  return { accessToken: data.access_token, expiresIn: Number(data.expires_in) || 60 * 86400 }
}

/** Perfil: quien es y cuantos le siguen. */
export async function fetchProfile(accessToken) {
  const q = new URLSearchParams({
    fields: 'id,username,account_type,media_count,followers_count,profile_picture_url',
    access_token: accessToken,
  })
  const d = await json(await fetch(`${base()}/me?${q}`), 'la lectura del perfil')
  return {
    externalId: String(d.id),
    handle: d.username,
    followers: Number(d.followers_count) || 0,
    avatarUrl: d.profile_picture_url || null,
    url: d.username ? `https://instagram.com/${d.username}` : null,
  }
}

/** Ultimas publicaciones con sus interacciones. */
export async function fetchPosts(accessToken, limite = 25) {
  const q = new URLSearchParams({
    fields:
      'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count',
    limit: String(limite),
    access_token: accessToken,
  })
  const d = await json(await fetch(`${base()}/me/media?${q}`), 'la lectura de publicaciones')

  return (d.data || []).map((m) => ({
    externalId: String(m.id),
    permalink: m.permalink || null,
    // media_product_type distingue un reel de una foto, y para una marca no es
    // lo mismo: el reel es lo que se compra hoy.
    mediaType: m.media_product_type === 'REELS' ? 'REEL' : m.media_type || null,
    caption: m.caption ? String(m.caption).slice(0, 500) : null,
    thumbnailUrl: m.thumbnail_url || m.media_url || null,
    // like_count desaparece si el creador oculto los likes: en ese caso es
    // ausencia de dato, no un cero, y asi se guarda.
    likes: m.like_count == null ? 0 : Number(m.like_count) || 0,
    comments: Number(m.comments_count) || 0,
    views: 0,
    publishedAt: m.timestamp ? new Date(m.timestamp) : null,
  }))
}

export default { authUrl, exchangeCode, refresh, fetchProfile, fetchPosts, modo: 'oauth' }
