/**
 * Lo que cobra un creador por una colaboracion.
 *
 * Hasta ahora solo habia una respuesta posible: lo pactado. Con el pago por
 * resultado hay dos partes y conviene no mezclarlas nunca, porque **no valen
 * lo mismo**:
 *
 *  - el **fijo** se deposita en garantia antes de grabar. Es dinero seguro:
 *    el creador lo cobra aunque no venda nada.
 *  - el **variable** es un porcentaje de lo que venda su codigo. Todavia no
 *    existe cuando se acepta la colaboracion, no se puede retener, y puede
 *    acabar siendo cero.
 *
 * Esa diferencia es lo mas importante de este modulo y se arrastra hasta la
 * pantalla: un creador tiene derecho a saber cuanto de lo que le ofrecen es
 * seguro antes de decir que si. Presentar "100 EUR + 10%" como si fueran 250
 * seria venderle una expectativa como si fuera un sueldo.
 *
 * Las ventas salen de las atribuciones de Shopify ligadas a la colaboracion,
 * y se cuentan **netas de devoluciones**: pagar comision sobre un pedido que
 * la tienda ha tenido que reintegrar seria el peor error posible en una cifra
 * que decide a quien se paga.
 */

import { desgloseDe } from '../billing/planes.js'

export const MODELOS = ['FIXED', 'FIXED_VARIABLE', 'VARIABLE']

export const MODELO_ETIQUETA = {
  FIXED: 'Pago fijo',
  FIXED_VARIABLE: 'Fijo + comisión por ventas',
  VARIABLE: 'Solo comisión por ventas',
}

export const llevaVariable = (payModel) => payModel === 'FIXED_VARIABLE' || payModel === 'VARIABLE'
export const llevaFijo = (payModel) => payModel !== 'VARIABLE'

const redondea = (n) => Math.round(n * 100) / 100

/**
 * La comision que paga el creador, en porcentaje.
 *
 * Es siempre la base, **no la del plan de la empresa**. El plan de la empresa
 * no cambia el trato del creador: lo que compra es un descuento sobre lo que
 * paga ella, y ese descuento sale de la comision de Mikro
 * (billing/planes.js). Si esto leyera el porcentaje del plan, un creador
 * veria cambiar lo que cobra segun lo que su cliente hubiera contratado por
 * su cuenta, que es exactamente lo que no puede pasar.
 */
const feePct = () => Number(process.env.PLATFORM_FEE_PCT || 12)

/**
 * Reparto de una colaboracion.
 *
 * `atribuciones` son las de esa colaboracion, con salesTotal y refundedTotal.
 * Devuelve las dos partes por separado y el total, nunca solo el total.
 */
export function repartoDeal(deal, atribuciones = []) {
  const bruto = atribuciones.reduce((a, x) => a + (x.salesTotal || 0), 0)
  const devuelto = atribuciones.reduce((a, x) => a + (x.refundedTotal || 0), 0)
  const ventasNetas = Math.max(0, bruto - devuelto)

  const pct = feePct()

  // Fijo: lo que se pacto. En una campana solo variable es cero y no pasa
  // nada; lo que no puede pasar es que salga un numero inventado.
  const fijo = llevaFijo(deal.payModel) ? deal.fee || 0 : 0
  const fijoComision = deal.feePlatform || 0

  // Variable: porcentaje de la venta neta. La comision de Mikro se aplica
  // igual que al fijo, porque es lo mismo: ingresos del creador.
  const variable = llevaVariable(deal.payModel)
    ? redondea((ventasNetas * (deal.commissionPct || 0)) / 100)
    : 0
  const variableComision = redondea((variable * pct) / 100)

  return {
    payModel: deal.payModel || 'FIXED',
    commissionPct: deal.commissionPct || 0,

    ventasBrutas: redondea(bruto),
    ventasDevueltas: redondea(devuelto),
    ventasNetas: redondea(ventasNetas),

    fijo,
    fijoNeto: fijo - fijoComision,
    variable,
    variableNeto: redondea(variable - variableComision),

    total: redondea(fijo + variable),
    totalNeto: redondea(fijo - fijoComision + variable - variableComision),
    comisionMikro: redondea(fijoComision + variableComision),

    // Lo unico garantizado de antemano. Va aparte a proposito.
    garantizado: fijo - fijoComision,
    pendienteDeVentas: llevaVariable(deal.payModel),

    // Lo que paga la empresa por el fijo, que con plan es menos que el cache:
    // la diferencia es el descuento del plan y sale de Mikro, no del creador.
    // Va aparte de `fijo` porque son dos cifras distintas y confundirlas es
    // ensenarle a cada uno el numero del otro.
    empresaPaga: redondea(desgloseDe(deal).brandCents / 100),
    descuentoPlan: redondea(desgloseDe(deal).descuentoCents / 100),
  }
}

/**
 * Lo que una campana ofrece, antes de que haya ninguna venta.
 *
 * Sirve para pintar la oferta en el muro de oportunidades. Deliberadamente no
 * estima cuanto se puede llegar a ganar con el variable: nadie sabe lo que va
 * a vender un creador, y una cifra inventada aqui es la forma mas rapida de
 * que alguien acepte un trato que no le compensa.
 */
export function ofertaCampana(campaign) {
  const fijo = llevaFijo(campaign.payModel)
    ? { min: campaign.budgetMin, max: campaign.budgetMax }
    : null

  return {
    payModel: campaign.payModel || 'FIXED',
    etiqueta: MODELO_ETIQUETA[campaign.payModel] || MODELO_ETIQUETA.FIXED,
    fijo,
    commissionPct: llevaVariable(campaign.payModel) ? campaign.commissionPct : 0,
    // El descuento que llevara el codigo. Para el creador no es un detalle
    // administrativo: es su argumento de venta, lo que puede decir en camara.
    discountType: campaign.discountType || 'PERCENTAGE',
    discountPct: campaign.discountPct || 0,
    // Que parte es segura. Es el dato con el que un creador decide.
    garantizado: fijo ? fijo.min : 0,
  }
}

/**
 * Comprueba que lo que pide la empresa tiene sentido.
 *
 * Devuelve un mensaje de error o null. Todo lo que hay aqui existe porque sin
 * ello se podria publicar una oferta que no se puede cumplir.
 */
export function validarOferta({
  kind,
  payModel,
  commissionPct,
  discountPct,
  budgetMin,
  budgetMax,
  tieneTienda,
}) {
  if (!MODELOS.includes(payModel)) return 'Ese modelo de pago no existe'

  if (kind === 'SERVICE' && llevaVariable(payModel)) {
    return 'El pago por comisión solo está disponible en campañas de producto: en un servicio todavía no podemos medir la venta'
  }

  if (llevaVariable(payModel)) {
    if (!tieneTienda) {
      return 'Para pagar por comisión necesitas tu tienda conectada a Mikro: es lo que nos permite saber qué ha vendido cada creador'
    }
    if (!commissionPct || commissionPct < 1 || commissionPct > 50) {
      return 'La comisión tiene que estar entre el 1% y el 50%'
    }
  }

  if (discountPct != null && (discountPct < 0 || discountPct > 70)) {
    return 'El descuento del código tiene que estar entre el 0% y el 70%'
  }

  // No es un error, pero si una cuenta que conviene hacer antes de publicar:
  // el descuento sale del precio y la comision sale de lo que queda.
  if (llevaVariable(payModel) && discountPct >= 30 && commissionPct >= 20) {
    return `Un ${discountPct}% de descuento más un ${commissionPct}% de comisión deja muy poco margen. Revísalo antes de publicarlo`
  }

  if (llevaFijo(payModel)) {
    if (!budgetMin || budgetMin < 1) return 'Indica el importe fijo que vas a pagar'
    if (budgetMax < budgetMin) return 'El presupuesto máximo no puede ser menor que el mínimo'
  }

  return null
}

export default { repartoDeal, ofertaCampana, validarOferta, MODELOS, MODELO_ETIQUETA, llevaVariable, llevaFijo }
