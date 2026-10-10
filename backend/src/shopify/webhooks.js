/**
 * Alta de las suscripciones a webhooks.
 *
 * Se registran desde el codigo y no solo desde la configuracion de la app
 * para que una tienda que instala hoy quede suscrita hoy, sin depender de que
 * alguien haya desplegado bien el fichero de configuracion.
 */
import { adminGraphql } from './admin.js'
import { shopifyEnv } from './config.js'

export const WEBHOOKS_QUERY = `
  query suscripciones {
    webhookSubscriptions(first: 50) {
      nodes {
        id
        topic
        uri
      }
    }
  }
`

// uri y no callbackUrl: callbackUrl esta obsoleto. Y es String, no URL,
// porque el mismo campo admite destinos que no son HTTP (pubsub://, ARN de
// EventBridge). Lo confirma el validador del esquema, no la intuicion.
const CREATE = `
  mutation suscribir($topic: WebhookSubscriptionTopic!, $uri: String!) {
    webhookSubscriptionCreate(
      topic: $topic
      webhookSubscription: { uri: $uri, format: JSON }
    ) {
      webhookSubscription { id topic uri }
      userErrors { field message }
    }
  }
`

/**
 * Los temas que necesita la app.
 *
 * Los de cumplimiento (customers/*, shop/redact) no estan aqui a proposito:
 * esos los gestiona Shopify desde la configuracion de la app, no por API.
 */
export const TOPICS = [
  { topic: 'ORDERS_CREATE', path: 'orders-create' },
  { topic: 'ORDERS_PAID', path: 'orders-paid' },
  { topic: 'REFUNDS_CREATE', path: 'refunds-create' },
  { topic: 'APP_UNINSTALLED', path: 'app-uninstalled' },
]

/**
 * Deja la tienda suscrita a todo lo que falta.
 *
 * Es idempotente: se consulta lo que ya hay y solo se crea lo que no esta,
 * porque esto corre cada vez que la tienda abre la app.
 */
export async function ensureWebhooks(shopDomain) {
  const { appUrl } = shopifyEnv()
  const base = `${appUrl.replace(/\/$/, '')}/api/shopify/webhooks`

  const data = await adminGraphql(shopDomain, WEBHOOKS_QUERY)
  const existentes = new Set(
    (data.webhookSubscriptions?.nodes || [])
      .filter((n) => typeof n.uri === 'string' && n.uri.startsWith(base))
      .map((n) => n.topic),
  )

  const creados = []
  for (const { topic, path } of TOPICS) {
    if (existentes.has(topic)) continue
    const res = await adminGraphql(shopDomain, CREATE, { topic, uri: `${base}/${path}` })
    const errores = res.webhookSubscriptionCreate?.userErrors || []
    // Un fallo aqui no debe tumbar la apertura de la app: se anota y se sigue,
    // y el siguiente intento lo vuelve a probar.
    if (errores.length) console.warn(`[shopify] no se pudo suscribir ${topic}:`, errores[0]?.message)
    else creados.push(topic)
  }
  return creados
}

export default { ensureWebhooks, TOPICS, WEBHOOKS_QUERY }
