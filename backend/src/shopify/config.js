/**
 * Configuracion de la app de Shopify.
 *
 * La version de la API se fija a mano y no se usa "latest" ni "unstable":
 * Shopify publica una estable cada trimestre y mantiene cada una doce meses,
 * asi que subirla tiene que ser una decision con su commit y su prueba, no
 * algo que cambie solo un martes por la manana.
 */
export const API_VERSION = '2026-10'

/**
 * Permisos que pide la app.
 *
 * Solo lo que hace falta para lo que promete: leer pedidos para atribuir las
 * ventas y gestionar descuentos para crear el codigo de cada creador. No se
 * piden datos de clientes: Mikro no los necesita y pedirlos obligaria a
 * responderlos en las peticiones de acceso del RGPD.
 */
export const SCOPES = ['read_orders', 'write_discounts', 'read_products']

export const shopifyEnv = () => ({
  apiKey: process.env.SHOPIFY_API_KEY || '',
  apiSecret: process.env.SHOPIFY_API_SECRET || '',
  appUrl: process.env.SHOPIFY_APP_URL || process.env.PUBLIC_URL || 'http://localhost:5173',
})

/** La app solo puede funcionar si tiene credenciales. */
export const shopifyConfigured = () => {
  const { apiKey, apiSecret } = shopifyEnv()
  return !!apiKey && !!apiSecret
}

/**
 * Dominio de tienda valido.
 *
 * Se comprueba con una expresion cerrada porque este valor acaba dentro de la
 * URL a la que se manda el token de la tienda: aceptar cualquier cadena seria
 * dejar que un parametro decida a que servidor llamamos.
 */
const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/

export function isShopDomain(value) {
  return typeof value === 'string' && value.length <= 120 && SHOP_DOMAIN.test(value)
}

/** Normaliza lo que llegue a un dominio de tienda, o null si no lo es. */
export function toShopDomain(value) {
  if (typeof value !== 'string') return null
  const clean = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return isShopDomain(clean) ? clean : null
}

export default { API_VERSION, SCOPES, shopifyEnv, shopifyConfigured, isShopDomain, toShopDomain }
