/**
 * Tokens de acceso a la Admin API.
 *
 * Shopify ya no admite tokens offline perpetuos para la Admin API en apps
 * publicas nuevas: el token dura una hora y viene con uno de refresco de 90
 * dias. Toda la integracion pasa por accessTokenFor(), que se encarga de
 * renovarlo antes de que caduque para que ninguna otra parte del codigo tenga
 * que acordarse.
 */
import { prisma } from '../lib/prisma.js'
import { shopifyEnv, isShopDomain } from './config.js'

const TOKEN_URL = (shop) => `https://${shop}/admin/oauth/access_token`

// Margen de renovacion: se pide uno nuevo cinco minutos antes de caducar, para
// que una peticion larga no se quede a medias con el token vencido.
const RENEW_MARGIN_MS = 5 * 60 * 1000

async function postToken(shop, body) {
  const { apiKey, apiSecret } = shopifyEnv()
  const res = await fetch(TOKEN_URL(shop), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: apiKey, client_secret: apiSecret, ...body }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data.error_description || data.error || `HTTP ${res.status}`
    throw new Error(`Shopify rechazo la peticion de token: ${detail}`)
  }
  return data
}

/** Guarda lo que devuelve Shopify, calculando la fecha de caducidad. */
function tokenFields(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    // expires_in viene en segundos; si no viene, se asume la hora habitual.
    tokenExpires: new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000),
    scopes: data.scope || null,
  }
}

/**
 * Canjea el token de sesion del admin por uno de acceso.
 *
 * expiring: 1 no es opcional. Sin el, Shopify devuelve un token perpetuo que
 * las apps publicas nuevas ya no pueden usar contra la Admin API.
 */
export async function exchangeSessionToken(shop, sessionToken) {
  if (!isShopDomain(shop)) throw new Error('Dominio de tienda no valido')
  const data = await postToken(shop, {
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: sessionToken,
    subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
    requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
    expiring: 1,
  })
  return tokenFields(data)
}

/** Renueva con el token de refresco, que es lo que toca para esto. */
export async function refreshAccessToken(shop, refreshToken) {
  if (!isShopDomain(shop)) throw new Error('Dominio de tienda no valido')
  const data = await postToken(shop, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  return tokenFields(data)
}

/**
 * Token valido para una tienda, renovandolo si hace falta.
 *
 * Devuelve null cuando no hay forma de conseguirlo (tienda desinstalada, sin
 * token guardado o con el refresco caducado). Quien llama decide que hacer:
 * normalmente, pedirle a la tienda que vuelva a abrir la app.
 */
export async function accessTokenFor(shopDomain) {
  const shop = await prisma.shopifyShop.findUnique({ where: { domain: shopDomain } })
  if (!shop || shop.uninstalledAt || !shop.accessToken) return null

  const vigente = shop.tokenExpires && shop.tokenExpires.getTime() - Date.now() > RENEW_MARGIN_MS
  if (vigente) return shop.accessToken
  if (!shop.refreshToken) return null

  try {
    const fields = await refreshAccessToken(shopDomain, shop.refreshToken)
    await prisma.shopifyShop.update({ where: { id: shop.id }, data: fields })
    return fields.accessToken
  } catch {
    // El refresco tambien caduca (90 dias). No es un error del sistema: es una
    // tienda que lleva tres meses sin abrir la app y tendra que volver a entrar.
    await prisma.shopifyShop.update({
      where: { id: shop.id },
      data: { accessToken: null, refreshToken: null, tokenExpires: null },
    })
    return null
  }
}

export default { exchangeSessionToken, refreshAccessToken, accessTokenFor }
