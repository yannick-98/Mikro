/**
 * Los planes de Mikro.
 *
 * ## Que vende un plan
 *
 * **Solo una cosa: una comision mas baja.** No hay funciones escondidas
 * detras del plan, y es una decision a conciencia.
 *
 * Lo facil aqui es inventarse tres niveles y repartir funciones entre ellos
 * —"analiticas avanzadas", "soporte prioritario"— porque asi la tabla de
 * precios se rellena sola. El problema es que eso convierte el producto en
 * una negociacion: la empresa deja de preguntarse si Mikro le sale a cuenta y
 * empieza a preguntarse que le estamos escondiendo. Y para esconder algo hay
 * que empeorar a proposito el plan gratuito, que es justo el que tiene que
 * enamorar a alguien que todavia no se fia.
 *
 * Con una sola variable, la pregunta es aritmetica y se puede contestar sin
 * vendedor. De hecho la contestamos nosotros, con sus propios numeros: ver
 * `recomendar()`.
 *
 * ## El plan no cambia los tratos ya cerrados
 *
 * La comision se congela en cada colaboracion al crearla (`Deal.platformPct`).
 * Suscribirse hoy no abarata lo que se acordo ayer, y darse de baja no encarece
 * lo que esta a medias. Sin eso, un cambio de plan reescribiria dinero que dos
 * partes ya habian pactado, que es exactamente lo que no puede pasar.
 */

/** 12% es lo que paga quien no tiene plan. Lo demas se compara contra esto. */
export const COMISION_BASE = () => Number(process.env.PLATFORM_FEE_PCT || 12)

/**
 * `lookupKey` es como se encuentra el precio en Stripe sin guardar un
 * identificador suyo en el codigo. Si alguien borra el precio y lo rehace, el
 * script de alta lo vuelve a crear con la misma llave y aqui no cambia nada.
 */
export const PLANES = [
  {
    id: 'FREE',
    nombre: 'Gratis',
    precio: 0,
    comision: 12,
    lookupKey: null,
    resumen: 'Para empezar y ver si esto funciona para ti.',
    paraQuien: 'Menos de 1.000 € al mes en colaboraciones.',
  },
  {
    id: 'PRO',
    nombre: 'Pro',
    precio: 29,
    comision: 9,
    lookupKey: 'mikro_pro_mensual',
    resumen: 'Tres puntos menos de comisión en todo lo que cierres.',
    paraQuien: 'La pyme que hace dos o tres colaboraciones al mes.',
  },
  {
    id: 'AGENCIA',
    nombre: 'Agencia',
    precio: 99,
    comision: 6,
    lookupKey: 'mikro_agencia_mensual',
    resumen: 'La mitad de comisión que sin plan.',
    paraQuien: 'Volumen alto o varias marcas.',
  },
]

export const PLAN_IDS = PLANES.map((p) => p.id)
export const planPorId = (id) => PLANES.find((p) => p.id === id) || PLANES[0]
export const planPorLookupKey = (k) => PLANES.find((p) => p.lookupKey === k) || null

/**
 * Estados en los que un plan de pago sigue valiendo.
 *
 * `past_due` esta dentro a proposito: a una empresa cuya tarjeta ha caducado
 * se le avisa y se le dan dias para arreglarlo, no se le sube la comision en
 * mitad de una campana. Stripe reintenta el cobro varias veces antes de
 * cancelar, y cuando cancela de verdad llega `canceled` y entonces si.
 */
export const ESTADOS_VIVOS = ['active', 'trialing', 'past_due']

/**
 * La comision que le toca a una empresa, en porcentaje.
 *
 * Una empresa sin plan, o con uno que dejo de pagarse, paga la base. No hay
 * castigo por haber tenido plan: se vuelve exactamente a donde estaba.
 */
export function comisionDe(brand) {
  if (!brand?.plan || brand.plan === 'FREE') return COMISION_BASE()
  if (!ESTADOS_VIVOS.includes(brand.planStatus || '')) return COMISION_BASE()
  return planPorId(brand.plan).comision
}

/** Lo que cuesta una colaboracion de `importe` euros a esa comision. */
export const comisionSobre = (importe, pct) => Math.round((Number(importe) * pct) / 100)

/**
 * El reparto de una colaboracion, que con los planes deja de ser una resta.
 *
 * Lo primero es entender que un plan **no cambia el trato del creador**. Él
 * sigue facturando su caché íntegro a la empresa y sigue pagando su 12% de
 * comisión, tenga la empresa el plan que tenga: su acuerdo no puede moverse
 * porque otros dos hayan firmado algo.
 *
 * Lo que compra un plan es un **descuento sobre lo que paga la empresa**, y
 * ese descuento sale de la comisión de Mikro. Con 250 € pactados y plan Pro:
 *
 *   el creador factura           250,00 €   (como siempre)
 *   Mikro le factura el 12%       30,00 €   (como siempre)
 *   el creador cobra             220,00 €   (como siempre)
 *   Mikro descuenta a la empresa   7,50 €   (los 3 puntos del plan)
 *   la empresa paga              242,50 €
 *   a Mikro le quedan             22,50 €
 *
 * Esta forma de contarlo no es un capricho contable: es la única en la que
 * las facturas cuadran con el dinero que se mueve. Si en vez de un descuento
 * se bajara la comisión del creador, él cobraría más —no es lo que se vende—
 * y si se bajara su caché, cobraría menos, que es peor.
 *
 * En céntimos porque ahí aparecen los medios euros: el 3% de 250 son 7,50, y
 * redondear a 8 es regalar cincuenta céntimos en cada colaboración.
 *
 * `fee * puntos` da céntimos directamente: el p% de `fee` euros son
 * `fee * p / 100` euros, o sea `fee * p` céntimos.
 */
export function importesDe(fee, platformPct, base = COMISION_BASE()) {
  const bruto = Number(fee) || 0
  const comisionCreador = Math.round((bruto * base) / 100)
  const descuentoCents = Math.max(0, Math.round(bruto * (base - Number(platformPct))))

  return {
    fee: bruto,
    comisionCreador,
    creatorNet: bruto - comisionCreador,
    descuentoCents,
    brandCents: bruto * 100 - descuentoCents,
    mikroCents: comisionCreador * 100 - descuentoCents,
  }
}

/**
 * Lo mismo, leido de una colaboracion ya guardada.
 *
 * Con el apaño para las anteriores a los planes, que no tienen las columnas
 * nuevas: todas se cerraron al 12% y sin descuento, asi que la empresa pago
 * el cache entero.
 */
export function desgloseDe(deal) {
  const fee = deal?.fee || 0
  const comisionCreador = deal?.feePlatform || 0

  if (!deal?.brandTotalCents) {
    return {
      fee,
      comisionCreador,
      creatorNet: fee - comisionCreador,
      descuentoCents: 0,
      brandCents: fee * 100,
      mikroCents: comisionCreador * 100,
    }
  }

  const descuentoCents = fee * 100 - deal.brandTotalCents
  return {
    fee,
    comisionCreador,
    creatorNet: deal.creatorNet || fee - comisionCreador,
    descuentoCents,
    brandCents: deal.brandTotalCents,
    mikroCents: comisionCreador * 100 - descuentoCents,
  }
}

/**
 * A partir de cuanto gasto mensual compensa un plan.
 *
 * El plan sale a cuenta cuando lo que ahorra en comision supera lo que
 * cuesta: precio / (puntos que baja / 100). Devuelve null para el gratuito,
 * que no tiene umbral porque no cuesta nada.
 */
export function umbralDe(plan, base = COMISION_BASE()) {
  const puntos = base - plan.comision
  if (!plan.precio || puntos <= 0) return null
  return Math.ceil(plan.precio / (puntos / 100))
}

/**
 * Que plan le conviene a alguien que gasta `gastoMensual` euros al mes.
 *
 * Esto existe para poder decirle a una empresa **que se baje de plan**. Un
 * comparador que solo sabe recomendar hacia arriba no es un comparador, es un
 * anuncio; y el dia que alguien hace la cuenta y ve que lleva seis meses
 * pagando de mas, lo que pierde Mikro no son 29 euros al mes.
 *
 * Devuelve el plan con el coste total mas bajo para ese gasto. A igualdad,
 * gana el mas barato de cuota: en el empate, el que menos compromete.
 */
export function recomendar(gastoMensual) {
  const coste = (plan) => plan.precio + (gastoMensual * plan.comision) / 100

  return PLANES.reduce((mejor, plan) => {
    const d = coste(plan) - coste(mejor)
    if (d < -0.0001) return plan
    if (Math.abs(d) <= 0.0001 && plan.precio < mejor.precio) return plan
    return mejor
  }, PLANES[0])
}

/**
 * Lo que le cuesta cada plan a ese nivel de gasto, para pintar la tabla.
 *
 * `ahorro` se compara siempre contra no tener plan, que es la unica
 * referencia que la empresa ya conoce. Negativo significa que ese plan le
 * saldria mas caro, y se ensena igual: una tabla en la que todos los numeros
 * son buenos no la cree nadie.
 */
export function comparar(gastoMensual) {
  const base = COMISION_BASE()
  const sinPlan = (gastoMensual * base) / 100

  return PLANES.map((plan) => {
    const comision = (gastoMensual * plan.comision) / 100
    const total = plan.precio + comision
    return {
      ...plan,
      umbral: umbralDe(plan, base),
      costeMensual: Math.round(total * 100) / 100,
      comisionMensual: Math.round(comision * 100) / 100,
      ahorro: Math.round((sinPlan - total) * 100) / 100,
    }
  })
}

export default {
  PLANES,
  PLAN_IDS,
  ESTADOS_VIVOS,
  COMISION_BASE,
  planPorId,
  planPorLookupKey,
  comisionDe,
  comisionSobre,
  umbralDe,
  recomendar,
  comparar,
}
