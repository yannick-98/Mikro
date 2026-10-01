/**
 * Prepara la base de datos durante el despliegue.
 *
 *   node scripts/db-deploy.js
 *
 * Aplica el esquema y siembra SOLO si la base esta vacia. Un seed en cada
 * build borraria los datos que la gente haya creado en la demo, que es
 * justamente lo que se quiere evitar al pasar a Postgres.
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const schema = path.join(root, 'backend', 'prisma', 'schema.prisma')

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
}

const pooled = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL
const direct = process.env.DIRECT_DATABASE_URL || process.env.NETLIFY_DATABASE_URL_UNPOOLED || pooled

if (!pooled) {
  // Ocurre en el primer despliegue: Netlify provisiona la base durante el
  // deploy, asi que todavia no hay conexion. El siguiente build ya la vera.
  console.warn('\n[db] Sin cadena de conexion: se omite la migracion.')
  console.warn('[db] Si es el primer despliegue, vuelve a desplegar cuando la base este provisionada.\n')
  process.exit(0)
}

process.env.DATABASE_URL = pooled
process.env.DIRECT_DATABASE_URL = direct

console.log('[db] Generando el cliente de Prisma...')
run('npx', ['prisma', 'generate', `--schema=${schema}`])

console.log('[db] Aplicando el esquema...')
run('npx', ['prisma', 'db', 'push', `--schema=${schema}`, '--accept-data-loss', '--skip-generate'])

const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient({ datasources: { db: { url: direct } } })

try {
  const users = await prisma.user.count()
  if (users > 0) {
    console.log(`[db] La base ya tiene ${users} usuarios: no se siembra.`)
  } else {
    console.log('[db] Base vacia: sembrando datos de demostracion...')
    await prisma.$disconnect()
    process.env.SEED_ALLOW_REMOTE = '1'
    run('node', [path.join(root, 'backend', 'prisma', 'seed.js')])
  }
} finally {
  await prisma.$disconnect().catch(() => {})
}
