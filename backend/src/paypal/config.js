/**
 * Cobrar por PayPal, para el creador que no quiere dar su IBAN.
 *
 * ## Lo que hay que entender antes de tocar esto
 *
 * El dinero de una colaboracion lo cobra Stripe y se queda **en el saldo de
 * Stripe**. Una transferencia a un creador con cuenta bancaria sale de ahi, y
 * por eso es inmediata y automatica.
 *
 * PayPal no funciona asi. Un pago de PayPal sale del **saldo de PayPal**, que
 * es otro sitio y no se llena solo: hay que mover el dinero de Stripe al banco
 * y del banco a PayPal. Eso es una operacion de tesoreria, la hace una persona
 * y no hay API que la haga por nosotros.
 *
 * La consecuencia esta en el diseno y no se puede disimular: cuando se aprueba
 * el contenido de un creador que cobra por PayPal, **el pago se encola**, no
 * se envia. Sale cuando alguien lanza el envio del lote, con el saldo que
 * haya. Por eso la interfaz le dice al creador "en los proximos dias" y no "ya
 * esta en camino", que es lo que puede decir la via del banco.
 *
 * Lo que no cambia es la garantia que se le vende a la empresa: el dinero esta
 * cobrado desde el principio y no sale hacia el creador hasta que se aprueba.
 * Eso es verdad por las dos vias.
 *
 * ## Lo que cuesta
 *
 * PayPal cobra al que envia, no al que recibe: alrededor del 2% con un tope.
 * Sobre un pago de 220 EUR son unos 4,40 EUR, y salen de la comision de Mikro,
 * igual que la de Stripe. Con el reparto de hoy (250 cobrados, 220 al creador,
 * ~4 de Stripe) el margen pasa de unos 26 EUR a unos 21. Es una decision de
 * negocio, no tecnica, y esta escrita aqui para que se tome sabiendola.
 */

/** Sandbox mientras no se diga lo contrario: aqui se mueve dinero. */
export const modoReal = () => process.env.PAYPAL_MODE === 'live'

export const API = () =>
  modoReal() ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

export const clientId = () => process.env.PAYPAL_CLIENT_ID || ''
export const clientSecret = () => process.env.PAYPAL_CLIENT_SECRET || ''

/** La divisa es la misma que la de los cobros: mezclarlas seria cambiar dinero sin querer. */
export const MONEDA = 'EUR'

export function paypalConfigured() {
  return !!(clientId() && clientSecret())
}

/**
 * PayPal quiere los importes como texto con dos decimales.
 *
 * Un numero en coma flotante aqui es como se pierden centimos: 0.1 + 0.2 no
 * es 0.3, y el que paga la diferencia siempre es el mismo.
 */
export const aImporte = (euros) => (Math.round(Number(euros) * 100) / 100).toFixed(2)

/** Y los devuelve igual, en texto. En centimos no se pierde nada. */
export const aCentimos = (importe) => Math.round(Number(importe) * 100)

export default { API, clientId, clientSecret, paypalConfigured, modoReal, MONEDA, aImporte }
