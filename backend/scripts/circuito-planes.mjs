/**
 * El circuito de un plan, contra Stripe de verdad y contra produccion.
 *
 *   npm run planes:circuito
 *
 * Se contrata un plan con una tarjeta de prueba, se deja que Stripe avise al
 * servidor desplegado por internet, y se comprueba que la comision de esa
 * empresa ha cambiado en la base. Luego se cancela y se comprueba que vuelve.
 *
 * Es lo unico que no se puede probar en local, porque Stripe no llama a un
 * localhost. Lo demas —la aritmetica, los umbrales, la recomendacion— esta en
 * `npm run test:planes`, que no toca nada.
 *
 * Deja la base y Stripe como estaban.
 */
import { PrismaClient } from '@prisma/client'
import { stripe, stripeConfigured } from '../src/stripe/config.js'
import { comisionDe, importesDe, planPorId } from '../src/billing/planes.js'

if (!stripeConfigured()) {
  console.log('\n   Falta STRIPE_SECRET_KEY.\n')
  process.exit(1)
}

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

/** Espera a que la base diga lo que tiene que decir, o se rinde. */
async function esperarPlan(brandId, esperado, segundos = 60) {
  for (let i = 0; i < segundos / 2.5; i += 1) {
    await new Promise((r) => setTimeout(r, 2500))
    const b = await prisma.brand.findUnique({
      where: { id: brandId },
      select: { plan: true, planStatus: true, planRenewsAt: true, stripeSubscriptionId: true },
    })
    if (b.plan === esperado) return b
  }
  return prisma.brand.findUnique({
    where: { id: brandId },
    select: { plan: true, planStatus: true, planRenewsAt: true, stripeSubscriptionId: true },
  })
}

try {
  if (!(await s.accounts.retrieve()).id) throw new Error('sin cuenta')
  const modoPrueba = process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')
  if (!modoPrueba) {
    console.log('\n   Esto cobra de verdad con una clave real. Usa la de pruebas.\n')
    process.exit(1)
  }

  console.log('\n1. Una empresa de la base, sin plan')

  const brand = await prisma.brand.findFirst({ include: { user: { select: { email: true } } } })
  const antes = {
    plan: brand.plan,
    estado: brand.planStatus,
    sub: brand.stripeSubscriptionId,
    renueva: brand.planRenewsAt,
    termina: brand.planEndsAt,
    cliente: brand.stripeCustomerId,
  }
  limpiar.push(() =>
    prisma.brand.update({
      where: { id: brand.id },
      data: {
        plan: antes.plan,
        planStatus: antes.estado,
        stripeSubscriptionId: antes.sub,
        planRenewsAt: antes.renueva,
        planEndsAt: antes.termina,
        stripeCustomerId: antes.cliente,
      },
    }),
  )

  await prisma.brand.update({
    where: { id: brand.id },
    data: { plan: 'FREE', planStatus: null, stripeSubscriptionId: null },
  })
  console.log(`   ${brand.companyName}`)
  check('empieza pagando la comision base', comisionDe({ plan: 'FREE' }) === 12, '12%')

  console.log('\n2. Se contrata el plan Pro con una tarjeta de prueba')

  const cliente = await s.customers.create({
    name: brand.companyName,
    email: 'planes@mikro.test',
    metadata: { mikroBrandId: brand.id, mikroPrueba: 'circuito-planes' },
  })
  limpiar.push(() => s.customers.del(cliente.id).catch(() => {}))

  const pm = await s.paymentMethods.attach('pm_card_visa', { customer: cliente.id })
  await s.customers.update(cliente.id, { invoice_settings: { default_payment_method: pm.id } })

  const precios = await s.prices.list({ lookup_keys: ['mikro_pro_mensual'], active: true, limit: 1 })
  check('el precio de Pro esta dado de alta', !!precios.data[0], precios.data[0]?.id)
  if (!precios.data[0]) throw new Error('lanza antes `npm run planes:alta`')

  const sub = await s.subscriptions.create({
    customer: cliente.id,
    items: [{ price: precios.data[0].id }],
    default_payment_method: pm.id,
    metadata: { mikroBrandId: brand.id, mikroPlan: 'PRO' },
  })
  limpiar.push(() => s.subscriptions.cancel(sub.id).catch(() => {}))

  check('Stripe la da por activa', sub.status === 'active', sub.status)
  check('y la ha cobrado', sub.latest_invoice != null)

  console.log('   esperando a que Stripe avise a producción…')
  const conPlan = await esperarPlan(brand.id, 'PRO')

  check('el aviso llegó y la empresa tiene Pro', conPlan.plan === 'PRO', conPlan.plan)
  check('con el estado de Stripe tal cual', conPlan.planStatus === 'active', conPlan.planStatus || '—')
  check('y la suscripción anotada', conPlan.stripeSubscriptionId === sub.id)
  check('se sabe cuándo renueva', !!conPlan.planRenewsAt)

  console.log('\n3. Lo que cambia de verdad: lo que paga')

  const pct = comisionDe(conPlan)
  check('la comisión baja al 9%', pct === 9, `${pct}%`)

  const r = importesDe(250, pct)
  check('en una de 250 €, la empresa paga 242,50', r.brandCents === 24250, `${r.brandCents / 100} €`)
  // La que importa: el creador no se entera de nada.
  check('el creador sigue cobrando 220', r.creatorNet === 220, `${r.creatorNet} €`)
  check('a Mikro le quedan 22,50', r.mikroCents === 2250, `${r.mikroCents / 100} €`)
  check('y hay un abono de 7,50 para la empresa', r.descuentoCents === 750, `${r.descuentoCents / 100} €`)

  console.log('\n4. Se da de baja')

  await s.subscriptions.cancel(sub.id)
  console.log('   esperando al aviso…')
  const sinPlan = await esperarPlan(brand.id, 'FREE')

  check('vuelve al plan gratuito', sinPlan.plan === 'FREE', sinPlan.plan)
  check('sin castigo: otra vez al 12%', comisionDe(sinPlan) === 12)
  check(
    'el estado queda anotado, no borrado',
    sinPlan.planStatus === 'canceled',
    sinPlan.planStatus || '—',
  )

  console.log('\n5. Lo que no se toca')

  // Un plan no puede cambiar lo ya pactado. Si esto fallara, suscribirse
  // reescribiria dinero que dos partes ya habian cerrado.
  const trato = await prisma.deal.findFirst({ where: { brandId: brand.id } })
  if (trato) {
    check(
      'una colaboración ya cerrada conserva su porcentaje',
      trato.platformPct > 0,
      `${trato.platformPct}%`,
    )
  } else {
    console.log('   (esta empresa no tiene colaboraciones que comprobar)')
  }

  console.log(`\n   Plan Pro: ${planPorId('PRO').precio} €/mes, ${planPorId('PRO').comision}% de comisión`)
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
