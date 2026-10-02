/**
 * El API de Mikro como funcion de Netlify.
 *
 * Es el mismo Express que corre en local, envuelto con serverless-http: no hay
 * dos implementaciones del backend que mantener. Los datos viven en el Postgres
 * gestionado del proyecto, asi que lo que se crea desde la web persiste entre
 * invocaciones y despliegues.
 */
import serverless from 'serverless-http'

let cached = null

async function bootstrap() {
  // Netlify expone la conexion como NETLIFY_DATABASE_URL; el backend espera
  // DATABASE_URL. La normalizacion vive en lib/prisma.js.
  const { resolveDatabaseUrls } = await import('../../backend/src/lib/prisma.js')
  const { pooled } = resolveDatabaseUrls()
  if (!pooled) throw new Error('Falta la cadena de conexion a la base de datos')

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
  // Sin esto, el pool abierto de Prisma mantiene viva la invocacion.
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
