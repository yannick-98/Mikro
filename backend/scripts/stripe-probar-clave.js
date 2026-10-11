/**
 * ¿Sirve esta clave de Stripe?
 *
 *   npm run stripe:probar -- sk_test_loquesea
 *
 * Contesta en dos segundos y dice exactamente que falta, para no tener que
 * averiguarlo a base de intentar cosas.
 */
import Stripe from 'stripe'

const clave = process.argv[2] || process.env.STRIPE_SECRET_KEY

if (!clave) {
  console.error('\n  Pásame la clave:  npm run stripe:probar -- sk_test_...\n')
  process.exit(1)
}

if (clave.startsWith('sk_live_')) {
  console.error('\n  ✗ Esa es la clave REAL (sk_live_). Hace falta la de prueba (sk_test_).')
  console.error('    En el dashboard, interruptor "Modo de prueba" arriba a la derecha.\n')
  process.exit(1)
}

if (!clave.startsWith('sk_test_')) {
  console.error('\n  ✗ Eso no parece una clave secreta de Stripe. Tiene que empezar por sk_test_\n')
  process.exit(1)
}

const s = new Stripe(clave, { apiVersion: '2024-11-20.acacia' })

console.log('')
try {
  const cuenta = await s.accounts.retrieve()
  console.log(`  Cuenta: ${cuenta.id} (${cuenta.country})`)
  console.log(`  Entorno: ${cuenta.business_profile?.name || 'sin nombre'}`)
} catch (e) {
  console.error(`  ✗ La clave no vale: ${e.message}\n`)
  process.exit(1)
}

// La prueba de fuego: crear una cuenta conectada. Es lo primero que hace el
// circuito y lo unico que de verdad distingue un entorno con Connect activado.
try {
  const prueba = await s.accounts.create({
    country: 'ES',
    business_type: 'individual',
    controller: {
      losses: { payments: 'application' },
      fees: { payer: 'application' },
      stripe_dashboard: { type: 'express' },
    },
    capabilities: { transfers: { requested: true } },
    metadata: { mikro: 'comprobacion' },
  })
  // Se borra en el momento: solo existia para saber si se podia crear.
  await s.accounts.del(prueba.id)

  console.log('\n  ✓ Connect está activado. Esta clave sirve.')
  console.log('    Pégala en STRIPE_SECRET_KEY del .env y avísame.\n')
} catch (e) {
  if (e.message.includes('signed up for Connect')) {
    console.error('\n  ✗ Connect NO está activado en este entorno.')
    console.error('')
    console.error('    Importante: los sandbox de Stripe son entornos separados y cada')
    console.error('    uno necesita su propia activación. Si diste de alta Connect en tu')
    console.error('    cuenta principal, esta clave tiene que salir de ahí:')
    console.error('')
    console.error('      1. En el dashboard, selector de entorno (arriba a la izquierda).')
    console.error('      2. Sal del sandbox a tu cuenta.')
    console.error('      3. Activa el interruptor "Modo de prueba" (arriba a la derecha).')
    console.error('      4. Desarrolladores → Claves de API → revelar la clave secreta.')
    console.error('')
    console.error('    Vuelve a probarla aquí antes de pegarla en ningún sitio.\n')
  } else {
    console.error(`\n  ✗ ${e.message}\n`)
  }
  process.exit(1)
}
