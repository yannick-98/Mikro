/**
 * El diagnostico contra una web de verdad, desde la terminal.
 *
 *   npm run web:analizar -- panaderialaespiga.es
 *   npm run web:analizar -- https://tutienda.es --json
 *
 * Sale a internet: no es una prueba, es la herramienta. Sirve para dos cosas
 * que valen mas que cualquier test unitario: comprobar que lo que decimos de
 * una web se sostiene al abrirla, y tener a mano el informe de un cliente
 * real sin levantar el servidor.
 */
import { analizarWeb, informeEnTexto } from '../src/web/index.js'

const args = process.argv.slice(2)
const entrada = args.find((a) => !a.startsWith('--'))
const comoJson = args.includes('--json')

if (!entrada) {
  console.error('Uso: npm run web:analizar -- tudominio.es [--json]')
  process.exit(1)
}

const empieza = Date.now()
let informe
try {
  informe = await analizarWeb(entrada)
} catch (e) {
  console.error(`\n  No hemos podido analizarla: ${e.message}\n`)
  process.exit(1)
}

if (comoJson) {
  console.log(JSON.stringify(informe, null, 2))
  process.exit(0)
}

console.log(`\n${informeEnTexto(informe)}`)
console.log(`\n(analizado en ${((Date.now() - empieza) / 1000).toFixed(1)} s)\n`)
process.exit(informe.nota.total === null ? 1 : 0)
