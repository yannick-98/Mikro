/**
 * Cobros con Stripe Connect.
 *
 * ## Por que este montaje y no otro
 *
 * Mikro promete que el dinero no llega al creador hasta que la empresa
 * aprueba el contenido. Hay tres formas de hacer eso con Stripe y solo una
 * sirve:
 *
 *  - **Cargos de destino** (`transfer_data`): el dinero sale hacia el creador
 *    en el mismo momento del cobro. No hay nada que retener.
 *  - **Autorizar y capturar despues**: la retencion de una tarjeta caduca en
 *    una semana, y una campana tarda mas que eso en publicarse.
 *  - **Cargos y transferencias separados**: se cobra a la empresa contra la
 *    cuenta de Mikro, el dinero se queda ahi, y la transferencia al creador
 *    es una llamada aparte que se hace al aprobar. Esta es la buena.
 *
 * ## Lo que esto NO es
 *
 * **No es una cuenta escrow segregada.** El dinero cobrado vive en el saldo
 * de Stripe de Mikro hasta que se transfiere; `transfer_group` es solo una
 * etiqueta para reconciliar, no retiene nada por si misma. Stripe tiene una
 * funcion de segregacion de fondos de verdad, pero esta en acceso privado y
 * exige condiciones que hoy no cumplimos.
 *
 * Lo que si se puede decir, y es lo que dice la interfaz: la empresa paga por
 * adelantado, el dinero esta cobrado antes de que el creador grabe nada, y no
 * se le envia hasta que el trabajo se aprueba. Lo que no se puede decir es
 * que esos fondos esten fuera del alcance de los acreedores de Mikro, porque
 * no lo estan. Esa diferencia importa y por eso esta escrita aqui.
 *
 * ## Quien paga que
 *
 * La empresa paga el importe acordado, ni un euro mas. El creador recibe el
 * 88%. La comision de Stripe sale del 12% de Mikro, que es justo como estan
 * hechas las cuentas del plan de negocio.
 */
import Stripe from 'stripe'

// Fijada a proposito, igual que la de Shopify. Una API que cambia debajo sin
// avisar es una integracion que se rompe un martes, y aqui se rompe con
// dinero de por medio.
export const API_VERSION = '2024-11-20.acacia'

export const MONEDA = 'eur'

let cliente

export function stripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY
}

/** El cliente, creado una vez. Lanza si no hay credenciales. */
export function stripe() {
  if (!stripeConfigured()) {
    throw new Error('Stripe no esta configurado en este entorno')
  }
  if (!cliente) {
    cliente = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: API_VERSION,
      // Reintentar lo que Stripe considere reintentable, con su clave de
      // idempotencia. Sin esto, un corte de red en mitad de un cobro puede
      // dejarnos sin saber si se cobro o no.
      maxNetworkRetries: 2,
      appInfo: { name: 'Mikro', url: 'https://mikro-marketplace.netlify.app' },
    })
  }
  return cliente
}

/** Para las pruebas, que cambian la clave entre casos. */
export function resetStripe() {
  cliente = undefined
}

/**
 * Los secretos de firma de los webhooks.
 *
 * En plural y no en singular porque hacen falta dos endpoints: uno para los
 * eventos de nuestra cuenta (cobros, devoluciones) y otro marcado como
 * "connect" para los de las cuentas de los creadores. Stripe no deja que un
 * mismo endpoint reciba las dos cosas, y cada uno tiene su propio secreto.
 *
 * Esto se descubrio probando: sin el endpoint de connect, account.updated no
 * llegaba nunca y el alta de un creador se quedaba para siempre en "le falta
 * algo" aunque Stripe ya la hubiera aprobado.
 *
 * Se separan por comas en la misma variable, para no multiplicar ajustes.
 */
export const webhookSecrets = () =>
  (process.env.STRIPE_WEBHOOK_SECRET || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

export const webhookSecret = () => webhookSecrets()[0] || ''

// No hay clave publica. El pago ocurre en una pagina alojada por Stripe, asi
// que el navegador nunca habla con Stripe desde nuestro codigo y no hay nada
// que publicar. Si algun dia se monta un formulario propio hara falta, y con
// ella el cumplimiento de PCI que ahora nos ahorramos.

export const APP_URL = () =>
  (process.env.APP_URL || process.env.SHOPIFY_APP_URL || process.env.URL || 'http://localhost:5173').replace(
    /\/$/,
    '',
  )

/** Los importes de Mikro son euros enteros; los de Stripe, centimos. */
export const aCentimos = (euros) => Math.round(Number(euros) * 100)
export const aEuros = (centimos) => Math.round(Number(centimos)) / 100

export default { stripe, stripeConfigured, webhookSecret, API_VERSION, MONEDA, aCentimos, aEuros }
