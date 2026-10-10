/**
 * Cliente de la Admin API (GraphQL).
 *
 * Solo GraphQL: la REST Admin API esta en retirada y las apps nuevas no
 * deberian construirse sobre ella.
 */
import { API_VERSION } from './config.js'
import { accessTokenFor } from './tokens.js'

export class ShopifyApiError extends Error {
  constructor(message, { status, errors } = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

/** Lanza una consulta contra una tienda ya instalada. */
export async function adminGraphql(shopDomain, query, variables = {}) {
  const token = await accessTokenFor(shopDomain)
  if (!token) throw new ShopifyApiError('La tienda tiene que volver a abrir la app', { status: 401 })

  const res = await fetch(`https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (res.status === 429) {
    throw new ShopifyApiError('Shopify esta limitando las peticiones, reintenta en unos segundos', { status: 429 })
  }

  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ShopifyApiError(`Shopify respondio ${res.status}`, { status: res.status })

  // GraphQL devuelve 200 con errores dentro: mirar solo el codigo HTTP es
  // justo la forma de que un fallo pase desapercibido.
  if (body.errors?.length) {
    throw new ShopifyApiError(body.errors[0]?.message || 'Error de la Admin API', {
      status: 400,
      errors: body.errors,
    })
  }

  return body.data
}

/**
 * Comprueba los errores de usuario de una mutacion.
 *
 * Las mutaciones de Shopify no fallan: devuelven userErrors y un resultado
 * vacio. Sin esto, una creacion fallida parece correcta hasta que alguien se
 * pregunta por que no hay descuento.
 */
export function throwOnUserErrors(result, label = 'La operacion') {
  const errors = result?.userErrors || []
  if (errors.length) {
    throw new ShopifyApiError(`${label}: ${errors.map((e) => e.message).join('; ')}`, {
      status: 400,
      errors,
    })
  }
  return result
}

export const SHOP_QUERY = `
  query shopInfo {
    shop {
      name
      email
      myshopifyDomain
      currencyCode
      billingAddress { countryCodeV2 }
      plan { displayName }
    }
  }
`

export default { adminGraphql, throwOnUserErrors, ShopifyApiError, SHOP_QUERY }
