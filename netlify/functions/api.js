/**
 * El API de Mikro como funcion de Netlify.
 *
 * El mismo Express que corre en local se envuelve con serverless-http, de modo
 * que no hay dos implementaciones del backend que mantener.
 *
 * Sobre la base de datos: el sistema de ficheros de una funcion es de solo
 * lectura salvo /tmp, asi que en el primer arranque se copia alli la base
 * SQLite ya sembrada que se genera durante el build. Las escrituras funcionan
 * mientras viva la instancia y se reinician con ella: es una demo publica, no
 * un entorno con persistencia. El paso a Postgres solo cambia el datasource.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import serverless from 'serverless-http'

const TMP_DB = path.join(os.tmpdir(), 'mikro.db')
const DB_RELATIVE = path.join('backend', 'prisma', 'dev.db')

/** Raices donde puede haber quedado el paquete de la funcion. */
function candidateRoots() {
  const roots = [process.cwd(), process.env.LAMBDA_TASK_ROOT, '/var/task']

  // La ruta de este modulo, si el empaquetado la conserva.
  try {
    if (typeof import.meta.url === 'string') {
      const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
      roots.push(path.resolve(here, '..', '..'), here)
    }
  } catch {
    // Sin import.meta.url utilizable se usan las demas raices.
  }

  return [...new Set(roots.filter(Boolean))]
}

/** Deja la base en /tmp y devuelve su ruta. */
function prepareDatabase() {
  if (fs.existsSync(TMP_DB)) return TMP_DB

  const tried = []
  for (const root of candidateRoots()) {
    for (const relative of [DB_RELATIVE, path.join('prisma', 'dev.db'), 'dev.db']) {
      const candidate = path.join(root, relative)
      tried.push(candidate)
      try {
        if (fs.existsSync(candidate)) {
          fs.copyFileSync(candidate, TMP_DB)
          return TMP_DB
        }
      } catch {
        // Ruta inaccesible: se prueba la siguiente.
      }
    }
  }

  // El detalle ahorra un despliegue a ciegas si cambia el empaquetado.
  let listing = ''
  try {
    listing = fs.readdirSync(process.cwd()).join(', ')
  } catch {
    listing = '(no legible)'
  }
  throw new Error(`Base de datos no encontrada. Probado: ${tried.join(' | ')}. Contenido de ${process.cwd()}: ${listing}`)
}

let cached = null

/** Prepara la base y arranca Express una sola vez por instancia. */
async function bootstrap() {
  const dbPath = prepareDatabase()
  // Debe quedar fijado antes de que se cargue el cliente de Prisma.
  process.env.DATABASE_URL = `file:${dbPath}`
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'mikro-demo-secret'

  const { createApp } = await import('../../backend/src/app.js')
  return serverless(createApp())
}

const FUNCTION_PREFIX = '/.netlify/functions/api'

/**
 * Netlify entrega la ruta con el prefijo de la funcion, pero Express tiene sus
 * rutas registradas bajo /api. Aqui se traduce una en la otra.
 */
function normalizePath(event) {
  const original = event.path || event.rawPath || '/'
  if (!original.startsWith(FUNCTION_PREFIX)) return event

  const rest = original.slice(FUNCTION_PREFIX.length)
  const next = `/api${rest === '/' ? '' : rest}` || '/api'

  event.path = next
  if (event.rawPath) event.rawPath = next
  if (event.rawUrl) event.rawUrl = event.rawUrl.replace(FUNCTION_PREFIX, '/api')
  return event
}

export const handler = async (event, context) => {
  // Sin esto, la conexion abierta de Prisma mantiene viva la invocacion.
  context.callbackWaitsForEmptyEventLoop = false

  if (!cached) cached = bootstrap()
  try {
    const app = await cached
    return app(normalizePath(event), context)
  } catch (error) {
    cached = null
    console.error('[api] fallo al arrancar', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'El API no ha podido arrancar', detail: String(error?.message || error) }),
    }
  }
}
