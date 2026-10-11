/**
 * Las cuentas de los creadores en Stripe.
 *
 * Cuentas Express: Stripe se encarga del alta, de pedir el DNI, de verificar
 * la identidad y de la cuenta bancaria, en su propio formulario. Mikro no ve
 * ni guarda nada de eso, y es a proposito: custodiar documentos de identidad
 * de cientos de autonomos es una responsabilidad que no queremos y que no
 * sabriamos llevar mejor que Stripe.
 *
 * El estado de la cuenta (si puede cobrar, si le falta algo) se guarda en
 * nuestra base para poder ensenarlo sin llamar a Stripe en cada pantalla,
 * y se refresca por webhook cuando Stripe lo cambia.
 */
import { prisma } from '../lib/prisma.js'
import { APP_URL, stripe } from './config.js'

/**
 * Crea la cuenta del creador si no la tiene.
 *
 * `controller` en vez del antiguo `type: 'express'`: es la forma nueva de
 * decir quien responde de que. Aqui Stripe pone el formulario y el soporte,
 * y Mikro paga las comisiones y responde de los saldos negativos, que es lo
 * que exige el modelo de cargos y transferencias separados.
 */
export async function asegurarCuenta(creator) {
  if (creator.stripeAccountId) return creator.stripeAccountId

  const cuenta = await stripe().accounts.create({
    country: 'ES',
    email: creator.user?.email,
    business_type: 'individual',
    controller: {
      losses: { payments: 'application' },
      fees: { payer: 'application' },
      stripe_dashboard: { type: 'express' },
    },
    capabilities: { transfers: { requested: true } },
    business_profile: {
      name: creator.displayName,
      product_description: 'Creación de contenido para marcas',
      url: `${APP_URL()}/kit/${creator.handle}`,
    },
    metadata: { mikroCreatorId: creator.id, mikroHandle: creator.handle },
  })

  await prisma.creator.update({
    where: { id: creator.id },
    data: { stripeAccountId: cuenta.id },
  })
  return cuenta.id
}

/**
 * El enlace al formulario de Stripe.
 *
 * Caduca en minutos y es de un solo uso, asi que se pide uno nuevo cada vez
 * que el creador pulsa el boton. Guardarlo seria guardar una llave caducada.
 */
export async function enlaceDeAlta(accountId, { refresh, retorno } = {}) {
  const link = await stripe().accountLinks.create({
    account: accountId,
    refresh_url: refresh || `${APP_URL()}/creador/perfil?stripe=reintentar`,
    return_url: retorno || `${APP_URL()}/creador/perfil?stripe=listo`,
    type: 'account_onboarding',
  })
  return link.url
}

/** El enlace a su panel de Stripe, para ver sus cobros y cambiar el banco. */
export async function enlaceDePanel(accountId) {
  const link = await stripe().accounts.createLoginLink(accountId)
  return link.url
}

/**
 * Traduce lo que falta a algo que una persona entienda.
 *
 * Stripe devuelve cosas como `individual.verification.document`, que no le
 * dice nada a nadie. Si no sabemos traducir un requisito, se dice que hay
 * algo pendiente y se manda al formulario, en vez de ensenar la clave en
 * crudo o callarse.
 */
const PENDIENTES = {
  'individual.verification.document': 'Falta que subas un documento de identidad',
  'individual.id_number': 'Falta tu NIF',
  'individual.address.line1': 'Falta tu dirección',
  'external_account': 'Falta la cuenta bancaria donde quieres cobrar',
  'business_profile.url': 'Falta un enlace a tu perfil',
  'tos_acceptance.date': 'Falta aceptar las condiciones de Stripe',
}

export function explicarPendiente(account) {
  const req = account.requirements || {}
  // past_due es un subconjunto de currently_due, asi que juntarlos sin mas
  // repetia cada frase dos veces. Lo vi en una prueba de verdad: "Falta tu
  // direccion. Falta aceptar las condiciones. Falta tu direccion. Falta
  // aceptar las condiciones."
  const lista = [...new Set([...(req.currently_due || []), ...(req.past_due || [])])]
  if (!lista.length) return null

  const traducidos = [...new Set(lista.map((c) => PENDIENTES[c]).filter(Boolean))]
  if (traducidos.length) return traducidos.join('. ')
  return 'Stripe necesita algún dato más para poder pagarte'
}

/**
 * Guarda en nuestra base lo que Stripe dice de una cuenta.
 *
 * Se llama desde el webhook `account.updated` y tambien a mano cuando el
 * creador vuelve del formulario, porque el webhook puede tardar unos
 * segundos y el creador esta mirando la pantalla.
 */
export async function refrescarCuenta(accountId, cuentaYaTraida) {
  const cuenta = cuentaYaTraida || (await stripe().accounts.retrieve(accountId))

  const creator = await prisma.creator.findFirst({
    where: { stripeAccountId: accountId },
    select: { id: true, stripeOnboardedAt: true },
  })
  if (!creator) return null

  const payoutsOk = !!cuenta.payouts_enabled
  const data = {
    stripeChargesOk: !!cuenta.charges_enabled,
    stripePayoutsOk: payoutsOk,
    stripePendiente: explicarPendiente(cuenta),
  }
  // La fecha de alta se pone una sola vez, cuando de verdad queda lista.
  if (payoutsOk && !creator.stripeOnboardedAt) data.stripeOnboardedAt = new Date()

  return prisma.creator.update({ where: { id: creator.id }, data })
}

/** Lo que la interfaz necesita saber de la cuenta de un creador. */
export function estadoCobros(creator) {
  if (!creator?.stripeAccountId) {
    return { estado: 'SIN_EMPEZAR', puedeCobrar: false, pendiente: null }
  }
  if (creator.stripePayoutsOk) {
    return { estado: 'LISTA', puedeCobrar: true, pendiente: null, desde: creator.stripeOnboardedAt }
  }
  return { estado: 'INCOMPLETA', puedeCobrar: false, pendiente: creator.stripePendiente }
}

export default { asegurarCuenta, enlaceDeAlta, enlaceDePanel, refrescarCuenta, estadoCobros }
