/**
 * Sincroniza las cuentas de redes que lleven tiempo sin actualizarse.
 *
 *   node backend/scripts/social-sync.js [--horas 24] [--limite 50]
 *
 * Pensado para una tarea diaria. Las cifras de un perfil envejecen: un
 * engagement de hace tres meses no describe al creador de hoy, y una marca que
 * contrata mirando ese numero esta decidiendo con datos caducados.
 *
 * Va de una en una a proposito. No hay ninguna prisa y a las plataformas no
 * les gusta que les lluevan peticiones.
 */
import 'dotenv/config'
import { sincronizarPendientes } from '../src/social/sync.js'
import { prisma } from '../src/lib/prisma.js'

const arg = (nombre, pordefecto) => {
  const i = process.argv.indexOf(`--${nombre}`)
  return i > -1 ? Number(process.argv[i + 1]) || pordefecto : pordefecto
}

const horas = arg('horas', 24)
const limite = arg('limite', 50)

console.log(`Sincronizando cuentas con más de ${horas} h sin actualizar (máx. ${limite})…\n`)

const resultados = await sincronizarPendientes({ horas, limite })

if (!resultados.length) {
  console.log('No había ninguna pendiente.')
} else {
  for (const r of resultados) {
    console.log(`  ${r.ok ? 'OK  ' : 'FALLO'} ${r.platform} @${r.handle}${r.error ? ` — ${r.error}` : ''}`)
  }
  const fallos = resultados.filter((r) => !r.ok).length
  console.log(`\n${resultados.length - fallos} correctas, ${fallos} fallidas`)
}

await prisma.$disconnect()
// Un fallo de sincronizacion no es un fallo del proceso: una cuenta cuyo
// permiso ha caducado es un caso normal que ya queda anotado en syncError.
process.exit(0)
