/**
 * Comprobaciones de autenticidad de todo lo que llega de Shopify.
 *
 * Es el punto mas delicado de la integracion: estas rutas son publicas y
 * cualquiera puede llamarlas. Lo unico que distingue un webhook de Shopify de
 * uno inventado es la firma, asi que aqui no se confia en nada que no venga
 * firmado y no se compara ninguna firma con ===.
 */
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { shopifyEnv, toShopDomain } from './config.js'

/**
 * Comparacion en tiempo constante.
 *
 * Un === sale antes del bucle en cuanto encuentra un byte distinto, y esa
 * diferencia de microsegundos deja adivinar la firma byte a byte. timingSafeEqual
 * exige que midan lo mismo, de ahi la comprobacion previa de longitud.
 */
function sameSecret(a, b) {
  const ba = Buffer.from(a || '', 'utf8')
  const bb = Buffer.from(b || '', 'utf8')
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

/**
 * Firma de un webhook.
 *
 * Se calcula sobre el cuerpo en crudo, no sobre el JSON ya interpretado: al
 * pasar por JSON.parse y volver a serializar cambian los espacios y el orden,
 * y la firma deja de cuadrar aunque el mensaje sea legitimo.
 */
export function webhookSignatureValid(rawBody, header, secret = shopifyEnv().apiSecret) {
  if (!secret || !header || !rawBody) return false
  const digest = crypto
    .createHmac('sha256', secret)
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8'))
    .digest('base64')
  return sameSecret(digest, header)
}

/**
 * Firma de una peticion por query string (instalacion y enlaces del admin).
 *
 * Shopify firma todos los parametros menos hmac, ordenados alfabeticamente.
 */
export function querySignatureValid(query = {}, secret = shopifyEnv().apiSecret) {
  const { hmac, signature, ...rest } = query
  if (!secret || !hmac) return false
  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${Array.isArray(rest[key]) ? rest[key].join(',') : rest[key]}`)
    .join('&')
  const digest = crypto.createHmac('sha256', secret).update(message, 'utf8').digest('hex')
  return sameSecret(digest, String(hmac))
}

/**
 * Token de sesion del admin incrustado (el id_token de App Bridge).
 *
 * Es un JWT firmado con el secreto de la app. Verificar la firma no basta:
 * hay que comprobar que va dirigido a esta app (aud) y de que tienda viene
 * (dest), porque un token legitimo de otra app o de otra tienda tambien tiene
 * una firma valida para quien no mire mas alla.
 */
export function verifySessionToken(token) {
  const { apiKey, apiSecret } = shopifyEnv()
  if (!apiSecret || !apiKey) throw new Error('La app de Shopify no esta configurada')

  // clockTolerance: los tokens duran alrededor de un minuto y el reloj de una
  // funcion serverless no siempre coincide al segundo con el de Shopify.
  const payload = jwt.verify(token, apiSecret, { algorithms: ['HS256'], clockTolerance: 10 })

  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
  if (!audience.includes(apiKey)) throw new Error('El token no es para esta app')

  const shop = toShopDomain(payload.dest)
  if (!shop) throw new Error('El token no indica una tienda valida')

  // iss y dest tienen que hablar de la misma tienda.
  const issuer = toShopDomain(payload.iss)
  if (!issuer || issuer !== shop) throw new Error('El emisor del token no coincide con la tienda')

  return { shop, userId: payload.sub, sessionId: payload.sid, expiresAt: payload.exp }
}

export default { webhookSignatureValid, querySignatureValid, verifySessionToken }
