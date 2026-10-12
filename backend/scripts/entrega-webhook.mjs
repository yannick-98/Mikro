/**
 * Comprueba que Stripe entrega los avisos a produccion de verdad.
 *
 *   npm run stripe:entrega
 *
 * Es lo unico que no se puede probar en local: Stripe no llama a un
 * localhost. Aqui se provoca un evento real, se deja que Stripe lo entregue
 * por internet al servidor desplegado, y se comprueba que llego mirando el
 * rastro que deja en la base.
 *
 * Se usa account.updated porque es el unico de los nuestros que se puede
 * disparar por API. Demuestra lo mismo que haria falta para un cobro: que
 * Stripe llama, que la firma se verifica y que el manejador corre.
 *
 * Esta prueba existe por un fallo que solo aparecia aqui: account.updated de
 * una cuenta conectada es un evento de Connect, y un endpoint normal no los
 * recibe. Sin el segundo endpoint, el alta de un creador se quedaba para
 * siempre en "le falta algo" aunque Stripe ya la hubiera aprobado.
 *
 * Deja la base y Stripe como estaban.
 */
import { PrismaClient } from '@prisma/client'
import { stripe } from '../src/stripe/config.js'

const s = stripe()
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL } },
})

const limpiar = []
let bien = 0
let mal = 0
const check = (t, cond, extra = '') => {
  if (cond) {
    bien += 1
    console.log(`   OK    ${t}${extra ? `  — ${extra}` : ''}`)
  } else {
    mal += 1
    console.log(`   FALLO ${t}${extra ? `  — ${extra}` : ''}`)
  }
}

try {
  console.log('\n1. Una cuenta de creador, ligada a un creador real de la base')

  const cuenta = await s.accounts.create({
    country: 'ES',
    email: 'entrega@mikro.test',
    business_type: 'individual',
    controller: {
      losses: { payments: 'application' },
      fees: { payer: 'application' },
      requirement_collection: 'application',
      stripe_dashboard: { type: 'none' },
    },
    capabilities: { transfers: { requested: true } },
    metadata: { mikroPrueba: 'entrega-webhook' },
  })
  limpiar.push(() => s.accounts.del(cuenta.id).catch(() => {}))

  const creador = await prisma.creator.findFirst()
  const antes = {
    id: creador.stripeAccountId,
    ok: creador.stripePayoutsOk,
    pend: creador.stripePendiente,
    desde: creador.stripeOnboardedAt,
  }
  await prisma.creator.update({
    where: { id: creador.id },
    data: {
      stripeAccountId: cuenta.id,
      stripePayoutsOk: false,
      stripePendiente: null,
      stripeOnboardedAt: null,
    },
  })
  limpiar.push(() =>
    prisma.creator.update({
      where: { id: creador.id },
      data: {
        stripeAccountId: antes.id,
        stripePayoutsOk: antes.ok,
        stripePendiente: antes.pend,
        stripeOnboardedAt: antes.desde,
      },
    }),
  )
  console.log(`   ${cuenta.id} → creador ${creador.handle}`)
  console.log('   antes del aviso: puede cobrar = false')

  console.log('\n2. Se completa la cuenta. Stripe tiene que avisar a producción.')

  await s.accounts.update(cuenta.id, {
    individual: {
      first_name: 'Entrega',
      last_name: 'Real',
      email: 'entrega@mikro.test',
      phone: '+34600000000',
      dob: { day: 1, month: 1, year: 1990 },
      address: { line1: 'Calle de Prueba 1', city: 'Madrid', postal_code: '28001', country: 'ES' },
      id_number: '000000000',
    },
    business_profile: {
      mcc: '7311',
      url: 'https://mikro-marketplace.netlify.app',
      product_description: 'Contenido',
    },
    external_account: {
      object: 'bank_account',
      country: 'ES',
      currency: 'eur',
      account_number: 'ES0700120345030000067890',
    },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
  })
  console.log('   esperando a que Stripe llame a producción…')

  let visto = null
  for (let i = 0; i < 24; i += 1) {
    await new Promise((r) => setTimeout(r, 2500))
    visto = await prisma.creator.findUnique({
      where: { id: creador.id },
      select: { stripePayoutsOk: true, stripeOnboardedAt: true },
    })
    if (visto.stripePayoutsOk) break
  }

  check(
    'Stripe entregó el aviso y producción lo procesó',
    visto?.stripePayoutsOk === true,
    visto?.stripePayoutsOk ? 'la base lo refleja' : 'la base sigue igual',
  )
  check(
    'y quedó anotado cuándo',
    !!visto?.stripeOnboardedAt,
    visto?.stripeOnboardedAt ? new Date(visto.stripeOnboardedAt).toLocaleTimeString('es-ES') : '',
  )

  console.log('\n3. Lo que registró Stripe')
  // Los eventos de una cuenta conectada viven en esa cuenta, no en la
  // principal: hay que pedirlos con su ambito.
  let nuestro = null
  let pendientes = null
  // El contador de Stripe tarda unos segundos en bajar a cero aunque la
  // entrega ya haya ocurrido, asi que se espera en vez de dar por fallido
  // algo que solo iba con retraso.
  for (let i = 0; i < 8; i += 1) {
    const eventos = await s.events.list({ limit: 10 }, { stripeAccount: cuenta.id })
    nuestro = eventos.data.find((e) => e.type === 'account.updated')
    pendientes = nuestro?.pending_webhooks
    if (pendientes === 0) break
    await new Promise((r) => setTimeout(r, 3000))
  }

  check('el evento consta en la cuenta conectada', !!nuestro, nuestro?.id)
  check(
    'Stripe da la entrega por buena',
    pendientes === 0,
    pendientes === 0 ? 'producción respondió 200' : `quedan ${pendientes} sin entregar`,
  )
} catch (e) {
  mal += 1
  console.log(`   FALLO ${e.message}`)
} finally {
  console.log('\n--- Limpiando ---')
  for (const f of limpiar.reverse()) await f()
  console.log('   hecho')
  await prisma.$disconnect()
}

console.log(`\n=== ${bien} correctas, ${mal} fallidas ===\n`)
process.exit(mal > 0 ? 1 : 0)
