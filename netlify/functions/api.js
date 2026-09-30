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

/** Deja la base en /tmp y devuelve su ruta. */
function prepareDatabase() {
  if (fs.existsSync(TMP_DB)) return TMP_DB

  // La ruta cambia segun como empaquete Netlify la funcion, asi que se prueban
  // las ubicaciones posibles en vez de fijar una.
  const candidates = [
    path.resolve(process.cwd(), 'backend/prisma/dev.db'),
    path.resolve(process.cwd(), 'prisma/dev.db'),
    new URL('../../backend/prisma/dev.db', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  ]

  const source = candidates.find((c) => {
    try {
      return fs.existsSync(c)
    } catch {
      return false
    }
  })

  if (!source) {
    throw new Error(`No se encuentra la base de datos sembrada. Buscado en: ${candidates.join(', ')}`)
  }

  fs.copyFileSync(source, TMP_DB)
  return TMP_DB
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
