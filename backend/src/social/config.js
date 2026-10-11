/**
 * Credenciales de las plataformas.
 *
 * Cada proveedor se activa solo si tiene lo que necesita. Un Mikro sin
 * credenciales de TikTok sigue funcionando: la pantalla dice que esa conexion
 * no esta disponible, en vez de ofrecer un boton que lleva a un error.
 */

export const APP_URL = () => (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')

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

/** Si una plataforma puede usarse ahora mismo. */
export function disponible(platform) {
  if (platform === 'youtube') return !!config.youtube.apiKey()
  const c = config[platform]
  return !!(c && c.clientId() && c.clientSecret())
}

/** Como se conecta cada una, que la interfaz necesita saberlo. */
export const MODO = {
  instagram: 'oauth',
  tiktok: 'oauth',
  youtube: 'handle', // basta con decirnos el canal
}

export function estadoPlataformas() {
  return PLATAFORMAS.map((p) => ({ platform: p, modo: MODO[p], disponible: disponible(p) }))
}

export default { config, PLATAFORMAS, MODO, disponible, estadoPlataformas, redirectUri, APP_URL }
