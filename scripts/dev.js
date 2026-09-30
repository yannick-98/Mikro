/**
 * Levanta API y web a la vez, sin dependencias externas.
 *
 *   npm run dev
 *
 * Prefija la salida de cada proceso y, si uno muere, cierra el otro para no
 * dejar puertos ocupados.
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const COLORS = { api: '\x1b[36m', web: '\x1b[35m', reset: '\x1b[0m', dim: '\x1b[2m' }

const services = [
  { name: 'api', cwd: path.join(root, 'backend'), args: ['run', 'dev'] },
  { name: 'web', cwd: path.join(root, 'frontend'), args: ['run', 'dev'] },
]

const children = []
let shuttingDown = false

function prefix(name, chunk) {
  const color = COLORS[name] || ''
  return String(chunk)
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => `${color}[${name}]${COLORS.reset} ${line}`)
    .join('\n')
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill()
  }
  process.exit(code)
}

for (const service of services) {
  const child = spawn(npm, service.args, { cwd: service.cwd, shell: process.platform === 'win32' })
  children.push(child)

  child.stdout.on('data', (d) => console.log(prefix(service.name, d)))
  child.stderr.on('data', (d) => console.error(prefix(service.name, d)))
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`\n${COLORS.dim}[${service.name}] se ha detenido (codigo ${code}). Cerrando el resto.${COLORS.reset}`)
      shutdown(code ?? 1)
    }
  })
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

console.log(`
  Mikro en marcha
    API : http://localhost:4000/api/health
    Web : http://localhost:5173

  Cuentas de prueba (contrasena mikro1234):
    Empresa  hola@laespiga.es
    Creadora martagarcia@creador.mikro.es
    Admin    admin@mikro.es

  Ctrl+C para parar los dos procesos.
`)
