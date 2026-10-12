/**
 * Da de alta los planes en Stripe y deja el webhook escuchando lo suyo.
 *
 *   npm run planes:alta
 *
 * Se puede volver a lanzar las veces que haga falta: lo que ya existe se
 * reutiliza. Hace falta una vez en pruebas y otra en real, porque son dos
 * mundos separados con objetos distintos.
 *
 * Los precios se buscan por `lookupKey` y no por su identificador de Stripe.
 * Asi no hay que guardar ningun `price_...` en una variable de entorno, que
 * es como se acaba con dos variables por plan sin saber cual es de cual.
 */
import { stripe, stripeConfigured } from '../src/stripe/config.js'
import { PLANES } from '../src/billing/planes.js'
import { asegurarPrecios } from '../src/billing/suscripciones.js'

const EVENTOS = [
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
]

if (!stripeConfigured()) {
  console.log('\n   Falta STRIPE_SECRET_KEY.\n')
  process.exit(1)
}

const s = stripe()

try {
  const cuenta = await s.accounts.retrieve()
  console.log(`\n   Cuenta ${cuenta.id}`)

  console.log('\n1. Los planes')
  for (const plan of PLANES) {
    if (!plan.lookupKey) {
      console.log(`   —     ${plan.nombre.padEnd(10)} gratis, no se da de alta`)
      continue
    }
    console.log(`         ${plan.nombre.padEnd(10)} ${String(plan.precio).padStart(4)} €/mes · ${plan.comision}% de comisión`)
  }

  const precios = await asegurarPrecios()
  for (const p of precios) {
    console.log(`   ${p.creado ? 'CREADO' : 'ya está'}  ${p.plan.padEnd(8)} ${p.priceId}  (${p.lookupKey})`)
  }

  console.log('\n2. El webhook tiene que escuchar los eventos de suscripción')
  const endpoints = (await s.webhookEndpoints.list({ limit: 100 })).data.filter(
    (e) => e.url.includes('/api/stripe/webhooks') && !e.application,
  )

  if (!endpoints.length) {
    console.log('   AVISO no hay ningún endpoint de nuestra cuenta todavía')
    console.log('         en producción lo crea `npm run stripe:real`')
  }

  for (const e of endpoints) {
    const faltan = EVENTOS.filter((x) => !e.enabled_events.includes(x) && !e.enabled_events.includes('*'))
    if (!faltan.length) {
      console.log(`   ya está  ${e.id} los escucha todos`)
      continue
    }
    // Se anaden a los que ya tenia: reemplazar la lista dejaria sin escuchar
    // los cobros, y eso no se notaria hasta que alguien pagase.
    await s.webhookEndpoints.update(e.id, {
      enabled_events: [...new Set([...e.enabled_events, ...EVENTOS])],
    })
    console.log(`   AÑADIDO ${e.id} +${faltan.length} eventos`)
  }

  console.log(`
   Listo. Los planes se contratan desde /empresa/plan.

   Lo que vendes con esto: la empresa paga menos por colaboración y el
   creador cobra exactamente lo mismo. La diferencia sale de la comisión
   de Mikro.
`)
} catch (e) {
  console.log(`\n   FALLO ${e.message}\n`)
  process.exit(1)
}
