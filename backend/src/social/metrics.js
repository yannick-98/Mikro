/**
 * Las cifras de un perfil, calculadas por nosotros.
 *
 * Todo lo de aqui es puro: entra una lista de publicaciones, sale un numero.
 * Asi se puede probar sin red y sin base de datos, que es justo lo que hace
 * falta cuando lo que esta en juego es el orden del ranking.
 *
 * La decision de fondo: Mikro no se cree el engagement que le dicen. Lo
 * recalcula desde las publicaciones reales, con una ventana explicita y un
 * minimo de muestra, y cuando no tiene datos suficientes lo dice en vez de
 * devolver un cero que parece un dato.
 */

/** Publicaciones que se miran. Mas atras el perfil ya no es el mismo. */
export const VENTANA_DIAS = 90
export const MAX_POSTS = 12
export const MIN_POSTS = 3

/**
 * Las ultimas horas no cuentan.
 *
 * Una publicacion de hace dos horas todavia esta recogiendo likes. Meterla en
 * la media hunde el engagement de quien acaba de publicar, que es
 * precisamente el creador activo que queremos premiar.
 */
const GRACIA_HORAS = 24

const dias = (ms) => ms / 86400000
const redondea = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d

/**
 * Selecciona las publicaciones que entran en el calculo.
 * Devuelve las mas recientes dentro de la ventana, ya maduras.
 */
export function seleccionarPosts(posts, ahora = new Date()) {
  const limite = ahora.getTime() - VENTANA_DIAS * 86400000
  const maduras = ahora.getTime() - GRACIA_HORAS * 3600000

  return (posts || [])
    .filter((p) => p?.publishedAt)
    .map((p) => ({ ...p, publishedAt: new Date(p.publishedAt) }))
    .filter((p) => p.publishedAt.getTime() >= limite && p.publishedAt.getTime() <= maduras)
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, MAX_POSTS)
}

/**
 * Engagement medio sobre seguidores, en porcentaje.
 *
 * Interacciones entre seguidores es la convencion del sector y es la cifra con
 * la que una marca compara dos perfiles. Se calcula como la media de las
 * razones por publicacion, no como el total de interacciones entre el total de
 * seguidores: asi un unico video viral no disfraza una cuenta que normalmente
 * no mueve a nadie.
 */
export function engagementRate(posts, followers) {
  if (!followers || followers <= 0 || !posts?.length) return null
  const ratios = posts.map((p) => ((p.likes || 0) + (p.comments || 0)) / followers)
  const media = ratios.reduce((a, b) => a + b, 0) / ratios.length
  return redondea(media * 100, 2)
}

/**
 * Engagement sobre visualizaciones, para plataformas de video.
 *
 * En TikTok o en reels el alcance no depende de los seguidores, asi que el
 * engagement por seguidores puede salir absurdo en los dos sentidos. Esta
 * cifra dice otra cosa: de los que lo vieron, cuantos reaccionaron.
 */
export function engagementByViews(posts) {
  const conVistas = (posts || []).filter((p) => (p.views || 0) > 0)
  if (!conVistas.length) return null
  const ratios = conVistas.map(
    (p) => ((p.likes || 0) + (p.comments || 0) + (p.shares || 0)) / p.views,
  )
  return redondea((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100, 2)
}

/**
 * Publicaciones por semana.
 *
 * Sobre el tiempo que realmente abarcan las publicaciones miradas, no sobre la
 * ventana entera: si alguien publico cinco veces en la ultima semana y nada
 * antes, su frecuencia actual es cinco, no cinco entre doce.
 */
export function postsPerWeek(posts, ahora = new Date()) {
  if (!posts?.length) return 0
  const masAntigua = posts[posts.length - 1].publishedAt
  const span = Math.max(dias(ahora.getTime() - new Date(masAntigua).getTime()), 1)
  return redondea((posts.length / span) * 7, 2)
}

/** Media simple de un campo. */
const mediaDe = (posts, campo) =>
  posts.length ? Math.round(posts.reduce((a, p) => a + (p[campo] || 0), 0) / posts.length) : 0

/**
 * Senales de que las cifras no se sostienen.
 *
 * No acusan a nadie: describen lo que se ve y dejan que lo juzgue una persona.
 * Un perfil con avisos no se esconde ni se penaliza en el ranking de forma
 * automatica; se marca, porque equivocarse aqui le cuesta el sustento a
 * alguien.
 */
export function anomalias({ posts, followers, snapshots = [] }) {
  const avisos = []

  // Likes sin conversacion. En una cuenta real, de cada 100 likes hay del
  // orden de uno o dos comentarios. Muy por debajo es la firma de los likes
  // comprados, que vienen sin nadie detras que escriba nada.
  const likes = posts.reduce((a, p) => a + (p.likes || 0), 0)
  const comentarios = posts.reduce((a, p) => a + (p.comments || 0), 0)
  if (likes > 500 && comentarios / likes < 0.002) {
    avisos.push({
      codigo: 'POCOS_COMENTARIOS',
      texto: 'Muchos likes y casi ningún comentario. Conviene mirarlo con calma.',
    })
  }

  // Saltos de seguidores que ninguna publicacion explica.
  const orden = [...snapshots].sort((a, b) => new Date(a.takenAt) - new Date(b.takenAt))
  for (let i = 1; i < orden.length; i += 1) {
    const antes = orden[i - 1]
    const ahora = orden[i]
    const hueco = dias(new Date(ahora.takenAt) - new Date(antes.takenAt))
    if (hueco > 7 || antes.followers < 500) continue
    const salto = (ahora.followers - antes.followers) / antes.followers
    if (salto > 0.25) {
      avisos.push({
        codigo: 'SALTO_SEGUIDORES',
        texto: `Subió un ${Math.round(salto * 100)}% de seguidores en ${Math.max(
          1,
          Math.round(hueco),
        )} día(s).`,
      })
      break
    }
  }

  // Un engagement imposible tambien es una senal, al reves que el bajo: por
  // encima del 20% sostenido casi siempre significa cuenta pequena con grupo
  // de intercambio, o cifras infladas a mano.
  const er = engagementRate(posts, followers)
  if (er != null && er > 20 && followers > 2000) {
    avisos.push({
      codigo: 'ENGAGEMENT_IMPROBABLE',
      texto: `Un ${er}% de engagement sostenido es muy poco habitual a este tamaño.`,
    })
  }

  return avisos
}

/**
 * Todo junto: lo que se guarda de una cuenta tras sincronizarla.
 *
 * suficiente dice si hay muestra para fiarse. Cuando es false, las cifras se
 * devuelven igual pero quien las pinta sabe que tiene que decir "todavia no
 * hay datos suficientes" en lugar de ensenar un numero con aplomo.
 */
export function resumirCuenta({ posts, followers, snapshots = [], ahora = new Date() }) {
  const muestra = seleccionarPosts(posts, ahora)
  const suficiente = muestra.length >= MIN_POSTS && followers > 0

  return {
    postsAnalyzed: muestra.length,
    suficiente,
    engagement: engagementRate(muestra, followers) ?? 0,
    engagementByViews: engagementByViews(muestra),
    postsPerWeek: postsPerWeek(muestra, ahora),
    avgLikes: mediaDe(muestra, 'likes'),
    avgComments: mediaDe(muestra, 'comments'),
    avgViews: mediaDe(muestra, 'views'),
    lastPostAt: muestra[0]?.publishedAt || null,
    anomalias: suficiente ? anomalias({ posts: muestra, followers, snapshots }) : [],
  }
}

export default {
  seleccionarPosts,
  engagementRate,
  engagementByViews,
  postsPerWeek,
  anomalias,
  resumirCuenta,
  VENTANA_DIAS,
  MAX_POSTS,
  MIN_POSTS,
}
