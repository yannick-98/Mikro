/**
 * Credenciales de las plataformas.
 *
 * Cada proveedor se activa solo si tiene lo que necesita. Un Mikro sin
 * credenciales de TikTok sigue funcionando: la pantalla dice que esa conexion
 * no esta disponible, en vez de ofrecer un boton que lleva a un error.
 */
import { lookupDisponible } from './lookup.js'

/**
 * El dominio publico de Mikro.
 *
 * Aqui vuelve el creador despues de autorizar, asi que equivocarse manda a la
 * gente a un localhost que no existe. Por eso hay varias redes de seguridad:
 * APP_URL si se ha puesto, el que ya usa la app de Shopify, y URL, que
 * Netlify define sola en cada despliegue. El localhost queda solo para
 * desarrollo.
 */
export const APP_URL = () =>
  (
    process.env.APP_URL ||
    process.env.SHOPIFY_APP_URL ||
    process.env.URL ||
    'http://localhost:5173'
  ).replace(/\/$/, '')

/** A donde vuelve la plataforma despues de que el creador autorice. */
export const redirectUri = (platform) =>
  process.env[`${platform.toUpperCase()}_REDIRECT_URI`] ||
  `${APP_URL()}/api/social/${platform}/callback`

export const config = {
  instagram: {
    clientId: () => process.env.INSTAGRAM_APP_ID || '',
    clientSecret: () => process.env.INSTAGRAM_APP_SECRET || '',
    // La version se fija a proposito: una API que cambia debajo sin avisar es
    // una integracion que se rompe un martes por la manana.
    version: () => process.env.INSTAGRAM_API_VERSION || 'v23.0',
  },
  tiktok: {
    clientId: () => process.env.TIKTOK_CLIENT_KEY || '',
    clientSecret: () => process.env.TIKTOK_CLIENT_SECRET || '',
  },
  youtube: {
    // YouTube no necesita que el creador autorice nada: los datos de un canal
    // son publicos y basta una clave de API nuestra. Es la unica de las tres
    // que funciona el primer dia.
    apiKey: () => process.env.YOUTUBE_API_KEY || '',
  },
}

export const PLATAFORMAS = ['instagram', 'tiktok', 'youtube']

/**
 * De cuantas formas se puede dar de alta cada red, de la mas facil a la mas
 * completa.
 *
 *  - **handle**: el creador escribe su @ y los datos los traemos nosotros.
 *    Es el camino normal, porque es el unico que no manda a nadie fuera de
 *    Mikro. En YouTube va por la API oficial; en Instagram y TikTok, por un
 *    servicio de consulta.
 *  - **oauth**: el creador autoriza de verdad. Mas friccion y mejor dato (y
 *    prueba por si mismo de quien es la cuenta), asi que se ofrece como paso
 *    opcional para quien quiera el sello completo.
 *
 * Una plataforma puede tener las dos, una, o ninguna. Lo de "ninguna" no es
 * teorico: cada forma necesita sus credenciales, y sin ellas la pantalla dice
 * que no esta disponible en vez de ofrecer un boton que lleva a un error.
 */
export function modosDe(platform) {
  const modos = []
  if (platform === 'youtube') {
    if (config.youtube.apiKey()) modos.push('handle')
    return modos
  }
  if (lookupDisponible(platform)) modos.push('handle')
  const c = config[platform]
  if (c && c.clientId() && c.clientSecret()) modos.push('oauth')
  return modos
}

/** Si una plataforma puede usarse ahora mismo, de alguna forma. */
export function disponible(platform) {
  return modosDe(platform).length > 0
}

/** La forma preferida: la de menos friccion de las que haya. */
export const modoDe = (platform) => modosDe(platform)[0] || null

export function estadoPlataformas() {
  return PLATAFORMAS.map((p) => ({
    platform: p,
    modo: modoDe(p),
    modos: modosDe(p),
    disponible: disponible(p),
    // Lo que de verdad le interesa a la interfaz: si puede pedir solo el @.
    porHandle: modosDe(p).includes('handle'),
  }))
}

export default {
  config,
  PLATAFORMAS,
  modosDe,
  modoDe,
  disponible,
  estadoPlataformas,
  redirectUri,
  APP_URL,
}
