/**
 * Conecta el proyecto a un Postgres gestionado, de una sola pasada.
 *
 *   node scripts/setup-db.js "<DATABASE_URL>" ["<DIRECT_DATABASE_URL>"]
 *
 * Escribe el .env local, aplica el esquema, siembra si la base esta vacia y
 * deja las variables listas para subirlas a Netlify. Nunca imprime la
 * contrasena: solo una version enmascarada.
 *
 * Si no se pasa la conexion directa, se deduce de la agrupada (en Supabase es
 * el mismo host en el puerto 5432, y en Neon es el host sin "-pooler").
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const schema = path.join(root, 'backend', 'prisma', 'schema.prisma')

const mask = (url) => String(url).replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@')

const pooled = (process.argv[2] || process.env.DATABASE_URL || '').trim()
if (!pooled) {
  console.error('Uso: node scripts/setup-db.js "postgresql://..." ["postgresql://... (directa)"]')
  process.exit(1)
}

/** Deduce la conexion directa cuando no se indica. */
function guessDirect(url) {
  try {
    const u = new URL(url)
    if (u.hostname.includes('pooler.supabase.com')) {
      u.port = '5432'
      u.searchParams.delete('pgbouncer')
      return u.toString()
    }
    if (u.hostname.includes('-pooler.')) {
      u.hostname = u.hostname.replace('-pooler.', '.')
      return u.toString()
    }
    return url
  } catch {
    return url
  }
}

const direct = (process.argv[3] || process.env.DIRECT_DATABASE_URL || guessDirect(pooled)).trim()

console.log('Conexion agrupada:', mask(pooled))
console.log('Conexion directa :', mask(direct))

// --- .env local -------------------------------------------------------------
const envPath = path.join(root, '.env')
const previous = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
const keep = previous
  .split('\n')
  .filter((line) => line.trim() && !/^\s*(DATABASE_URL|DIRECT_DATABASE_URL)=/.test(line) && !line.startsWith('#'))
  .join('\n')

fs.writeFileSync(
  envPath,
  ['# Postgres gestionado. Generado por scripts/setup-db.js', `DATABASE_URL="${pooled}"`, `DIRECT_DATABASE_URL="${direct}"`, keep, '']
    .filter(Boolean)
    .join('\n'),
)
console.log('\n.env actualizado')

// --- esquema y datos --------------------------------------------------------
const env = { ...process.env, DATABASE_URL: pooled, DIRECT_DATABASE_URL: direct }
const run = (cmd, args, extra = {}) =>
  execFileSync(cmd, args, { cwd: root, env: { ...env, ...extra }, stdio: 'inherit', shell: process.platform === 'win32' })

console.log('\nGenerando el cliente de Prisma...')
run('npx', ['prisma', 'generate', `--schema=${schema}`])

console.log('\nAplicando el esquema...')
run('npx', ['prisma', 'db', 'push', `--schema=${schema}`, '--accept-data-loss', '--skip-generate'])

const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient({ datasources: { db: { url: direct } } })

try {
  const users = await prisma.user.count()
  if (users > 0) {
    console.log(`\nLa base ya tiene ${users} usuarios: no se siembra.`)
  } else {
    console.log('\nBase vacia: sembrando datos de demostracion...')
    await prisma.$disconnect()
    run('node', [path.join(root, 'backend', 'prisma', 'seed.js')], { SEED_ALLOW_REMOTE: '1' })
  }
} finally {
  await prisma.$disconnect().catch(() => {})
}

console.log('\nListo. Para que el despliegue use esta base:')
console.log('  netlify env:set DATABASE_URL "<la cadena agrupada>"')
console.log('  netlify env:set DIRECT_DATABASE_URL "<la cadena directa>"')
