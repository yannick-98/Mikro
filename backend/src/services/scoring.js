/**
 * Ranking y afinidad.
 *
 * - computeScore: puntuacion 0-100 que ordena el ranking publico.
 * - matchScore: porcentaje de encaje entre un creador y unos criterios.
 *
 * Ambas funciones son puras para poder probarlas sin base de datos.
 */
import { normalize } from './taxonomy.js'

const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

/** Escala logaritmica: 1K -> ~0, 1M -> 100. Evita que solo ganen los grandes. */
function followersPoints(followers) {
  if (followers <= 0) return 0
  const v = (Math.log10(followers) - 3) / 3 // 1e3..1e6 -> 0..1
  return clamp(v, 0, 1) * 100
}

/** El engagement util satura en 8%: mas alto suele ser senal de compra. */
function engagementPoints(rate) {
  return clamp(rate / 8, 0, 1) * 100
}

/**
 * Puntuacion global del creador (0-100).
 * Prima el engagement sobre el tamano: es la tesis de producto de Mikro.
 */
export function computeScore(creator) {
  const alcance = followersPoints(creator.totalFollowers || 0)
  const engagement = engagementPoints(creator.engagementRate || 0)
  const reputacion = creator.ratingCount > 0 ? (creator.ratingAvg / 5) * 100 : 55
  const actividad = clamp((creator.completedDeals || 0) / 12, 0, 1) * 100
  const respuesta = clamp(1 - (creator.responseHours || 24) / 72, 0, 1) * 100
  const confianza = (creator.verified ? 100 : 40) * 1

  const score =
    alcance * 0.2 +
    engagement * 0.34 +
    reputacion * 0.18 +
    actividad * 0.12 +
    respuesta * 0.08 +
    confianza * 0.08

  return Math.round(score * 10) / 10
}

/**
 * Afinidad entre creador y criterios de busqueda (0-100).
 * Cada bloque aporta puntos solo si el criterio se ha especificado, de forma
 * que una busqueda vacia devuelve una afinidad basada en calidad del perfil.
 */
export function matchScore(creator, criteria = {}) {
  const {
    categories = [],
    cities = [],
    platforms = [],
    minFollowers,
    maxFollowers,
    maxBudget,
    minEngagement,
    audienceGender,
    keywords = [],
    language,
  } = criteria

  let total = 0
  let weight = 0

  const add = (w, value) => {
    weight += w
    total += w * clamp(value, 0, 1)
  }

  let categoryMiss = false
  if (categories.length) {
    const subs = normalize(creator.subcategories || '')
    const hit = categories.some((c) => normalize(c) === normalize(creator.category))
    const partial = categories.some((c) => subs.includes(normalize(c)))
    categoryMiss = !hit && !partial
    add(30, hit ? 1 : partial ? 0.6 : 0)
  }

  if (cities.length) {
    const hit = cities.some((c) => normalize(c) === normalize(creator.city))
    const sameProvince = cities.some((c) => normalize(c) === normalize(creator.province || ''))
    add(18, hit ? 1 : sameProvince ? 0.7 : 0.15)
  }

  if (platforms.length) {
    const owned = (creator.socialAccounts || []).map((a) => a.platform)
    const matched = platforms.filter((p) => owned.includes(p)).length
    add(14, platforms.length ? matched / platforms.length : 0)
  }

  if (minFollowers != null || maxFollowers != null) {
    const f = creator.totalFollowers || 0
    const lo = minFollowers ?? 0
    const hi = maxFollowers ?? Number.MAX_SAFE_INTEGER
    let v
    if (f >= lo && f <= hi) v = 1
    else if (f < lo) v = clamp(f / Math.max(lo, 1), 0, 1) * 0.7
    else v = clamp(hi / Math.max(f, 1), 0, 1) * 0.7
    add(18, v)
  }

  if (minEngagement != null) {
    const e = creator.engagementRate || 0
    add(12, e >= minEngagement ? 1 : clamp(e / Math.max(minEngagement, 0.1), 0, 1) * 0.8)
  }

  if (maxBudget != null) {
    const price = creator.ratePost || creator.rateReel || 0
    if (price > 0) add(12, price <= maxBudget ? 1 : clamp(maxBudget / price, 0, 1) * 0.6)
  }

  if (audienceGender) {
    const female = creator.audienceFemalePct ?? 50
    const v = audienceGender === 'female' ? female / 100 : (100 - female) / 100
    add(8, clamp((v - 0.4) / 0.4, 0, 1))
  }

  if (language) {
    const langs = normalize(creator.languages || '')
    add(6, langs.includes(normalize(language)) ? 1 : 0.2)
  }

  if (keywords.length) {
    const haystack = normalize(
      [creator.displayName, creator.headline, creator.bio, creator.category, creator.subcategories, creator.city].join(' '),
    )
    const matched = keywords.filter((k) => haystack.includes(normalize(k))).length
    add(10, matched / keywords.length)
  }

  // Calidad intrinseca: siempre pesa un poco para desempatar.
  const quality = computeScore(creator) / 100
  add(14, quality)

  let pct = weight > 0 ? (total / weight) * 100 : quality * 100

  // Estar en otra categoria es un desencaje de fondo: sin esta penalizacion, un
  // buen perfil de la ciudad correcta sale con un match enganosamente alto.
  if (categoryMiss) pct *= 0.7
  // Curva que expande la parte alta: un encaje casi perfecto roza el 99 y un
  // perfil mediocre no baja del 45, para que la lista sea legible de un vistazo.
  const curved = Math.pow(clamp(pct, 0, 100) / 100, 0.45)
  return Math.round(clamp(45 + 54 * curved, 45, 99))
}

export default { computeScore, matchScore }
