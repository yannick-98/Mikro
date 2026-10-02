import { PrismaClient } from '@prisma/client'

/**
 * Resuelve la cadena de conexion.
 *
 * Netlify inyecta NETLIFY_DATABASE_URL (agrupada por el pooler) y
 * NETLIFY_DATABASE_URL_UNPOOLED (directa). En local se usa DATABASE_URL del
 * .env. Se normaliza aqui para que el resto del codigo solo conozca
 * DATABASE_URL y DIRECT_DATABASE_URL.
 */
export function resolveDatabaseUrls() {
  const pooled = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL
  const direct =
    process.env.DIRECT_DATABASE_URL || process.env.NETLIFY_DATABASE_URL_UNPOOLED || pooled

  if (pooled) process.env.DATABASE_URL = pooled
  if (direct) process.env.DIRECT_DATABASE_URL = direct

  return { pooled, direct }
}

resolveDatabaseUrls()

/**
 * Una funcion serverless arranca muchas instancias a la vez, y cada
 * PrismaClient abre su propio pool: sin el limite, Postgres agota conexiones.
 */
function connectionUrl() {
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  const extra = []
  // Un pooler en modo transaccion no conserva los prepared statements que
  // Prisma crea por defecto: sin este parametro, las consultas fallan.
  if (/pooler\.|pgbouncer/.test(url) && !url.includes('pgbouncer=')) extra.push('pgbouncer=true')
  if ((process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) && !url.includes('connection_limit=')) {
    extra.push('connection_limit=1')
  }
  if (!extra.length) return url
  return `${url}${url.includes('?') ? '&' : '?'}${extra.join('&')}`
}

function createClient() {
  const url = connectionUrl()
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
    ...(url ? { datasources: { db: { url } } } : {}),
  })
}

// En desarrollo, nodemon recarga el modulo en cada cambio; sin reutilizar la
// instancia se acumularian clientes y conexiones abiertas.
const globalForPrisma = globalThis

export const prisma = globalForPrisma.__mikroPrisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.__mikroPrisma = prisma

export default prisma
