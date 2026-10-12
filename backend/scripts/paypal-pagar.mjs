/**
 * Saca los pagos que esperan en PayPal.
 *
 *   npm run paypal:pagar              lista lo que saldria. No envia nada.
 *   npm run paypal:pagar -- --enviar  lo manda de verdad.
 *   npm run paypal:pagar -- --cerrar  pregunta como quedaron los enviados.
 *
 * No envia por defecto a proposito. Esto mueve dinero de verdad y desde una
 * cuenta cuyo saldo hay que haber llenado antes a mano: un comando que paga
 * por el hecho de escribirlo mal es un comando mal hecho.
 *
 * Lo normal es dejar --cerrar en una tarea diaria y lanzar el envio cuando se
 * haya pasado saldo a PayPal.
 */
import { PrismaClient } from '@prisma/client'
import { paypalConfigured, modoReal } from '../src/paypal/config.js'
import { cerrarPendientes, enviarLote, idDeLote, pendientesDeEnviar } from '../src/paypal/payouts.js'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL } },
})

const args = process.argv.slice(2)
const enviar = args.includes('--enviar')
const cerrar = args.includes('--cerrar')

const euros = (n) => `${Number(n).toFixed(2)} €`

try {
  if (!paypalConfigured()) {
    console.log('\n   PayPal no esta configurado: faltan PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET.\n')
    process.exit(1)
  }

  console.log(`\n   Entorno: ${modoReal() ? 'REAL — esto mueve dinero' : 'pruebas (sandbox)'}`)

  if (cerrar) {
    console.log('\n--- Cerrando lo que ya se envio ---')
    const r = await cerrarPendientes()
    console.log(`   ${r.lotes} lotes abiertos`)
    console.log(`   ${r.completados} cobrados, ${r.fallidos} fallidos, ${r.pendientes} aun en camino`)
    if (r.error) console.log(`   AVISO ${r.error}`)
  }

  const pendientes = await pendientesDeEnviar()

  console.log(`\n--- Esperando a salir: ${pendientes.length} ---`)
  if (!pendientes.length) {
    console.log('   nada que enviar')
  } else {
    let total = 0
    for (const p of pendientes) {
      total += p.amount
      const dias = Math.floor((Date.now() - p.createdAt.getTime()) / 86400000)
      console.log(
        `   ${euros(p.amount).padStart(10)}  ${p.paypalEmail.padEnd(32)}  ${p.reference}` +
          (dias > 0 ? `  (${dias} ${dias === 1 ? 'dia' : 'dias'} esperando)` : ''),
      )
    }
    console.log(`   ${'—'.repeat(40)}`)
    console.log(`   ${euros(total).padStart(10)}  en total`)
    // La comision la paga quien envia, o sea nosotros, y sale del margen.
    console.log(`   ${euros(total * 0.02).padStart(10)}  aprox. de comision de PayPal (2%)`)
    console.log(`\n   Lote: ${idDeLote(pendientes)}`)
  }

  if (!enviar) {
    if (pendientes.length) {
      console.log('\n   Esto es solo la lista. Para enviarlo:')
      console.log('       npm run paypal:pagar -- --enviar')
      console.log('\n   Antes, comprueba que hay saldo en la cuenta de PayPal: estos pagos')
      console.log('   salen de ahi, no del saldo de Stripe.\n')
    } else {
      console.log('')
    }
    process.exit(0)
  }

  if (pendientes.length) {
    console.log('\n--- Enviando ---')
    const r = await enviarLote()
    if (r.error) {
      console.log(`   FALLO ${r.error}`)
      console.log('   No se ha enviado nada. El motivo queda anotado en cada pago.\n')
      process.exit(1)
    }
    console.log(`   ${r.enviados} pagos enviados en el lote ${r.lote}`)
    console.log('   Siguen en PENDING hasta que PayPal diga que han llegado.')
    console.log('   Para saberlo: npm run paypal:pagar -- --cerrar\n')
  }
} catch (e) {
  console.log(`\n   FALLO ${e.message}\n`)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
