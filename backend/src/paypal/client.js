/**
 * Hablar con PayPal.
 *
 * No hay libreria oficial que merezca la pena para lo que usamos —dos
 * llamadas— asi que esto es fetch y poco mas. Lo unico que tiene miga es el
 * token: PayPal no usa claves de API en cada peticion, sino un token que se
 * pide con las credenciales y caduca a las nueve horas. Pedirlo en cada
 * llamada funcionaria y seria una peticion de mas por cada pago.
 */
import { API, clientId, clientSecret, paypalConfigured } from './config.js'

let token = null
let caduca = 0

/** Margen para no usar un token que caduca mientras va por el cable. */
const MARGEN_MS = 60 * 1000

export function resetPaypal() {
  token = null
  caduca = 0
}

async function accessToken() {
  if (token && Date.now() < caduca - MARGEN_MS) return token

  const credenciales = Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64')
  const res = await fetch(`${API()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credenciales}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const datos = await res.json().catch(() => ({}))
  if (!res.ok || !datos.access_token) {
    // El mensaje de PayPal aqui suele ser "invalid_client", que no dice gran
    // cosa; lo util es recordar que casi siempre es la cuenta equivocada.
    throw new Error(
      `PayPal no acepta las credenciales (${datos.error || res.status}). Revisa que sean las del entorno correcto: las de sandbox no valen en real.`,
    )
  }

  token = datos.access_token
  caduca = Date.now() + Number(datos.expires_in || 32400) * 1000
  return token
}

/**
 * Una llamada a la API.
 *
 * `requestId` va en la cabecera PayPal-Request-Id, que es su clave de
 * idempotencia: si la red falla a mitad y se reintenta, PayPal reconoce la
 * peticion y no paga dos veces. Sin esto, un corte de conexion en el momento
 * justo nos cuesta el doble de lo que vale la colaboracion.
 */
export async function paypal(metodo, ruta, cuerpo, requestId) {
  if (!paypalConfigured()) throw new Error('PayPal no esta configurado en este entorno')

  const res = await fetch(`${API()}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
    },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  })

  const datos = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(explicar(datos, res.status))
    err.status = res.status
    err.paypal = datos
    throw err
  }
  return datos
}

/**
 * El error de PayPal, en castellano y sin su jerga.
 *
 * Los que estan nombrados son los que de verdad pasan. El resto se deja pasar
 * tal cual en vez de inventarse una traduccion: un mensaje raro que se puede
 * buscar es mejor que uno bonito que no dice nada.
 */
const ERRORES = {
  INSUFFICIENT_FUNDS: 'No hay saldo en la cuenta de PayPal para enviar estos pagos',
  SENDER_RESTRICTED: 'PayPal tiene restringida la cuenta que envia',
  SENDER_LOCKED: 'La cuenta de PayPal que envia esta bloqueada',
  AUTHORIZATION_ERROR: 'La cuenta de PayPal no tiene permiso para enviar pagos (Payouts)',
  USER_BUSINESS_ERROR: 'PayPal no permite esta operacion a esta cuenta',
  VALIDATION_ERROR: 'PayPal ha rechazado los datos del pago',
}

function explicar(datos, status) {
  const nombre = datos?.name || datos?.error
  if (ERRORES[nombre]) return ERRORES[nombre]

  const detalle = datos?.details?.[0]
  const texto = detalle?.description || datos?.message || `HTTP ${status}`
  return `PayPal: ${texto}`
}

/** Si el fallo es "esto ya lo mande", que no es un fallo. */
export const esRepetido = (e) =>
  /already|duplicate/i.test(`${e?.paypal?.name || ''} ${e?.paypal?.message || ''} ${e?.message || ''}`)

export default { paypal, resetPaypal, esRepetido }
