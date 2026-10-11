/**
 * Comprueba que la clave de YouTube funciona, contra la API de verdad.
 *
 *   node backend/scripts/youtube-check.js [@canal]
 *
 * Existe porque una clave mal configurada no falla al guardarla: falla
 * despues, cuando un creador intenta conectar su canal y recibe un error que
 * no entiende. Mejor enterarse ahora y con un mensaje que diga que hacer.
 *
 * Los tres fallos habituales, en orden de frecuencia:
 *  - la API no esta activada en el proyecto de Google Cloud;
 *  - la clave esta restringida a otra API, o a unas IP que no son las
 *    nuestras;
 *  - se ha agotado la cuota del dia.
 */
import 'dotenv/config'
import { disponible } from '../src/social/config.js'
import youtube from '../src/social/providers/youtube.js'
import { resumirCuenta } from '../src/social/metrics.js'

const canal = process.argv[2] || '@Google'

if (!disponible('youtube')) {
  console.error('\n  Falta YOUTUBE_API_KEY.\n')
  console.error('  Google Cloud Console -> crea un proyecto -> activa "YouTube Data API v3"')
  console.error('  -> Credenciales -> Crear -> Clave de API -> restringela a esa API.\n')
  console.error('  Luego ponla en el .env de aqui y en las variables de Netlify.\n')
  process.exit(1)
}

console.log(`\nProbando con ${canal}…\n`)

try {
  const perfil = await youtube.fetchProfile(null, canal)
  console.log(`  canal        ${perfil.handle}`)
  console.log(`  id           ${perfil.externalId}`)
  console.log(`  suscriptores ${perfil.followers.toLocaleString('es-ES')}`)

  const posts = await youtube.fetchPosts(null, perfil, 10)
  console.log(`  videos       ${posts.length} traidos`)

  const resumen = resumirCuenta({ posts, followers: perfil.followers })
  console.log(`\n  Lo que calcularia Mikro con esto:`)
  console.log(`    engagement       ${resumen.engagement}%`)
  console.log(`    publicaciones    ${resumen.postsPerWeek} por semana`)
  console.log(`    media de vistas  ${resumen.avgViews.toLocaleString('es-ES')}`)
  console.log(`    muestra          ${resumen.postsAnalyzed} videos${resumen.suficiente ? '' : ' (insuficiente)'}`)
  if (resumen.anomalias.length) {
    console.log(`\n  Avisos:`)
    for (const a of resumen.anomalias) console.log(`    - ${a.texto}`)
  }
  console.log('\n  La clave funciona.\n')
} catch (e) {
  console.error(`\n  No ha funcionado: ${e.message}\n`)
  const m = String(e.message)
  if (m.includes('has not been used') || m.includes('disabled')) {
    console.error('  Parece que la API no esta activada en ese proyecto de Google Cloud.\n')
  } else if (m.includes('referer') || m.includes('blocked') || m.includes('API_KEY')) {
    console.error('  Parece una restriccion de la clave. Revisa que permita "YouTube Data API v3"')
    console.error('  y que no este limitada por IP o por dominio: esto se llama desde el servidor.\n')
  } else if (m.includes('quota')) {
    console.error('  Cuota agotada por hoy. La cuota gratuita se renueva cada dia.\n')
  }
  process.exit(1)
}
