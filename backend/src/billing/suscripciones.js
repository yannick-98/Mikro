/**
 * Las suscripciones, contra Stripe Billing.
 *
 * ## Por que los precios se crean desde aqui y no a mano
 *
 * Un precio de Stripe es un objeto con su identificador, y la tentacion es
 * crearlo en el panel y pegar el `price_...` en una variable de entorno. Eso
 * funciona hasta que hay dos entornos: el precio de pruebas y el real son
 * objetos distintos con identificadores distintos, y acabas con dos variables
 * por plan que nadie recuerda cual es cual.
 *
 * En su lugar cada plan tiene una `lookupKey` estable. `asegurarPrecios()`
 * busca por esa llave y crea lo que falte, asi que funciona igual en pruebas
 * que en real y se puede volver a lanzar sin miedo.
 *
 * ## El estado de la suscripcion no se guarda al volver del pago
 *
 * Igual que con los cobros: la verdad llega por webhook. Si nos fiaramos de
 * que el navegador vuelva a la pagina de exito, bastaria con escribir esa URL
 * a mano para tener plan Agencia sin pagarlo.
 */
import { prisma } from '../lib/prisma.js'
import { APP_URL, MONEDA, aCentimos, stripe } from '../stripe/config.js'
import { ESTADOS_VIVOS, PLANES, planPorId, planPorLookupKey } from './planes.js'

/** El cliente de Stripe de la empresa. El mismo que paga las colaboraciones. */
async function asegurarCliente(brand) {
  if (brand.stripeCustomerId) return brand.stripeCustomerId

  const cliente = await stripe().customers.create({
    name: brand.companyName,
    email: brand.user?.email,
    metadata: { mikroBrandId: brand.id },
  })
  await prisma.brand.update({ where: { id: brand.id }, data: { stripeCustomerId: cliente.id } })
  return cliente.id
}

/**
 * Crea en Stripe lo que falte de los planes de pago.
 *
 * Idempotente: lo que ya existe se reutiliza. Devuelve el precio de cada plan.
 */
export async function asegurarPrecios() {
  const s = stripe()
  const salida = []

  for (const plan of PLANES) {
    if (!plan.lookupKey) continue

    const encontrados = await s.prices.list({
      lookup_keys: [plan.lookupKey],
      active: true,
      expand: ['data.product'],
      limit: 1,
    })
    let precio = encontrados.data[0]

    if (!precio) {
      const producto = await s.products.create({
        name: `Mikro ${plan.nombre}`,
        description: plan.resumen,
        metadata: { mikroPlan: plan.id },
      })
      precio = await s.prices.create({
        product: producto.id,
        currency: MONEDA,
        unit_amount: aCentimos(plan.precio),
        recurring: { interval: 'month' },
        lookup_key: plan.lookupKey,
        metadata: { mikroPlan: plan.id },
      })
    }

    salida.push({ plan: plan.id, priceId: precio.id, lookupKey: plan.lookupKey, creado: !encontrados.data[0] })
  }

  return salida
}

/** El precio de un plan, buscado por su llave. */
async function precioDe(plan) {
  const r = await stripe().prices.list({ lookup_keys: [plan.lookupKey], active: true, limit: 1 })
  if (!r.data[0]) {
    throw new Error('Ese plan no está dado de alta en la pasarela todavía')
  }
  return r.data[0].id
}

/**
 * Abre el pago de una suscripcion. Devuelve la URL a la que mandar a la
 * empresa.
 *
 * El plan NO se guarda aqui. Se guarda cuando Stripe avisa de que la
 * suscripcion existe y esta cobrada.
 */
export async function abrirSuscripcion(brand, planId) {
  const plan = planPorId(planId)
  if (!plan.lookupKey) throw new Error('El plan gratuito no se paga')

  const customer = await asegurarCliente(brand)

  const sesion = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer,
    locale: 'es',
    client_reference_id: brand.id,
    line_items: [{ price: await precioDe(plan), quantity: 1 }],
    subscription_data: { metadata: { mikroBrandId: brand.id, mikroPlan: plan.id } },
    metadata: { mikroBrandId: brand.id, mikroPlan: plan.id },
    // Para la factura de la empresa, que la necesita para deducirse el gasto.
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    success_url: `${APP_URL()}/empresa/plan?suscripcion=ok`,
    cancel_url: `${APP_URL()}/empresa/plan?suscripcion=cancelada`,
  })

  return sesion.url
}

/**
 * El portal de Stripe: cambiar de tarjeta, ver facturas, darse de baja.
 *
 * Se usa el suyo en vez de hacer el nuestro porque todo eso son pantallas con
 * normativa detras (SCA, facturas con sus datos fiscales, cancelaciones) y
 * reconstruirlas seria trabajo para tener algo peor.
 */
export async function enlaceDePortal(brand) {
  if (!brand.stripeCustomerId) throw new Error('Todavía no tienes ningún plan contratado')

  const sesion = await stripe().billingPortal.sessions.create({
    customer: brand.stripeCustomerId,
    return_url: `${APP_URL()}/empresa/plan`,
  })
  return sesion.url
}

/**
 * Que plan es una suscripcion de Stripe.
 *
 * Se mira primero lo que diga la propia suscripcion y luego la llave del
 * precio. Lo segundo es la red de seguridad: si alguien cambia el plan desde
 * el panel de Stripe, los metadatos se quedan con el plan viejo y la llave
 * del precio no.
 */
export function planDeSuscripcion(sub) {
  const porPrecio = planPorLookupKey(sub?.items?.data?.[0]?.price?.lookup_key)
  if (porPrecio) return porPrecio.id
  const enMetadatos = sub?.metadata?.mikroPlan
  if (enMetadatos && planPorId(enMetadatos).id === enMetadatos) return enMetadatos
  return 'FREE'
}

/**
 * Guarda lo que Stripe dice de una suscripcion.
 *
 * Es el unico sitio donde una empresa cambia de plan. Lo llama el webhook.
 */
export async function aplicarSuscripcion(sub) {
  const brandId = sub?.metadata?.mikroBrandId
  const brand = brandId
    ? await prisma.brand.findUnique({ where: { id: brandId } })
    : await prisma.brand.findFirst({ where: { stripeCustomerId: sub?.customer } })
  if (!brand) return null

  const vivo = ESTADOS_VIVOS.includes(sub.status)
  const plan = vivo ? planDeSuscripcion(sub) : 'FREE'

  const renueva = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null

  return prisma.brand.update({
    where: { id: brand.id },
    data: {
      plan,
      planStatus: sub.status,
      stripeSubscriptionId: sub.id,
      planRenewsAt: vivo ? renueva : null,
      // Darse de baja no quita el plan en ese momento: se ha pagado el mes.
      // Stripe lo marca con cancel_at_period_end y lo cancela de verdad al
      // final; mientras tanto, la comision sigue siendo la suya.
      planEndsAt: sub.cancel_at_period_end ? renueva : null,
    },
  })
}

/** El gasto en colaboraciones de los ultimos 30 dias, para la recomendacion. */
export async function gastoMensual(brandId) {
  const desde = new Date(Date.now() - 30 * 86400000)
  const r = await prisma.deal.aggregate({
    where: { brandId, createdAt: { gte: desde }, status: { not: 'CANCELLED' } },
    _sum: { fee: true },
    _count: { _all: true },
  })
  return { gasto: r._sum.fee || 0, colaboraciones: r._count._all || 0 }
}

export default {
  asegurarPrecios,
  abrirSuscripcion,
  enlaceDePortal,
  aplicarSuscripcion,
  planDeSuscripcion,
  gastoMensual,
}
