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
const bin = (name) => path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name)

const COLORS = { api: '\x1b[36m', web: '\x1b[35m', reset: '\x1b[0m', dim: '\x1b[2m' }

// El puerto del API se fija aqui y no se hereda: hay entornos que exportan
// PORT para la web (los previews, por ejemplo) y el API acababa intentando
// escuchar donde ya esta Vite, con lo que el proxy caia con ECONNREFUSED.
const API_PORT = process.env.API_PORT || '4000'

const services = [
  {
    name: 'api',
    command: bin('nodemon'),
    args: ['backend/src/server.js'],
    env: { PORT: API_PORT },
  },
  { name: 'web', command: bin('vite'), args: ['--config', 'frontend/vite.config.js'] },
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
  const child = spawn(service.command, service.args, {
    cwd: root,
    shell: process.platform === 'win32',
    env: { ...process.env, ...service.env },
  })
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
    API : http://localhost:${API_PORT}/api/health
    Web : http://localhost:5173

  Cuentas de prueba (contrasena mikro1234):
    Empresa  hola@laespiga.es
    Creadora martagarcia@creador.mikro.es
    Admin    admin@mikro.es

  Ctrl+C para parar los dos procesos.
`)
