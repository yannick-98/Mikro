/**
 * Traductor de lenguaje natural a filtros de busqueda.
 *
 * Es la "busqueda con IA" del MVP: un parser deterministico en espanol que no
 * depende de ningun proveedor externo, asi que funciona sin clave de API y sin
 * coste por consulta. La interfaz de servicio ya esta aislada aqui, de modo que
 * sustituirlo por un LLM mas adelante solo afecta a este fichero.
 */
import { CATEGORY_SYNONYMS, CITIES, PLATFORMS, normalize } from './taxonomy.js'

const NUMBER_WORDS = {
  mil: 1000,
  k: 1000,
  m: 1000000,
  millon: 1000000,
  millones: 1000000,
}

/** "20k" -> 20000 | "1,5m" -> 1500000 | "20.000" -> 20000 */
function parseCount(raw) {
  if (raw == null) return null
  let s = normalize(String(raw)).replace(/\s/g, '')
  const suffix = s.match(/(k|m|mil|millon|millones)$/)
  if (suffix) {
    s = s.slice(0, s.length - suffix[1].length)
    const base = parseFloat(s.replace(/\./g, '').replace(',', '.'))
    if (Number.isNaN(base)) return null
    return Math.round(base * NUMBER_WORDS[suffix[1]])
  }
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
  return Number.isNaN(n) ? null : Math.round(n)
}

const NUM = '\\d+(?:[.,]\\d+)?\\s*(?:k|m|mil|millones|millon)?'

function extractFollowers(text) {
  const t = normalize(text)

  // "entre 20k y 100k seguidores" / "de 20k a 100k"
  let m = t.match(new RegExp(`(?:entre|de)\\s+(${NUM})\\s*(?:y|a|-)\\s*(${NUM})`, 'i'))
  if (m) return { min: parseCount(m[1]), max: parseCount(m[2]) }

  // "20k-100k seguidores"
  m = t.match(new RegExp(`(${NUM})\\s*[-/]\\s*(${NUM})\\s*(?:seguidores|followers|fans)?`, 'i'))
  if (m && /seguidor|follower|fan|k\b|mil/.test(t)) {
    return { min: parseCount(m[1]), max: parseCount(m[2]) }
  }

  // "mas de 50k seguidores"
  m = t.match(new RegExp(`(?:mas de|minimo|a partir de|\\+)\\s*(${NUM})\\s*(?:seguidores|followers|fans)?`, 'i'))
  if (m) return { min: parseCount(m[1]), max: null }

  // "menos de 100k seguidores" / "hasta 100k seguidores"
  m = t.match(new RegExp(`(?:menos de|hasta|maximo)\\s*(${NUM})\\s*(?:seguidores|followers|fans)`, 'i'))
  if (m) return { min: null, max: parseCount(m[1]) }

  // "con 50k seguidores"
  m = t.match(new RegExp(`(${NUM})\\s*(?:seguidores|followers|fans)`, 'i'))
  if (m) {
    const n = parseCount(m[1])
    if (n) return { min: Math.round(n * 0.6), max: Math.round(n * 1.6) }
  }

  // Tramos por nombre
  if (/\bnano\b/.test(t)) return { min: 1000, max: 10000 }
  if (/\bmicro\b/.test(t)) return { min: 10000, max: 50000 }
  if (/\bmacro\b/.test(t)) return { min: 250000, max: 1000000 }
  return { min: null, max: null }
}

function extractBudget(text) {
  const t = normalize(text)
  const m = t.match(
    new RegExp(`(?:presupuesto|pagar|invertir|gastar|hasta|maximo|por)\\s*(?:de|:)?\\s*(${NUM})\\s*(?:euros|eur|€|e)\\b`, 'i'),
  )
  if (m) return parseCount(m[1])
  const m2 = t.match(new RegExp(`(${NUM})\\s*(?:euros|eur|€)`, 'i'))
  return m2 ? parseCount(m2[1]) : null
}

function extractEngagement(text) {
  const t = normalize(text)
  const m = t.match(/(?:engagement|interaccion|er)\D{0,15}?(\d+(?:[.,]\d+)?)\s*%?/i)
  if (m) return parseFloat(m[1].replace(',', '.'))
  const m2 = t.match(/\+\s*(\d+(?:[.,]\d+)?)\s*%/)
  if (m2) return parseFloat(m2[1].replace(',', '.'))
  if (/engagement (muy )?alto|mucha interaccion|muy comprometid/.test(t)) return 5
  return null
}

function extractCategories(text) {
  const t = normalize(text)
  const found = []
  for (const [category, words] of Object.entries(CATEGORY_SYNONYMS)) {
    const hit = words.some((w) => new RegExp(`\\b${normalize(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t))
    if (hit) found.push(category)
  }
  return found
}

function extractPlatforms(text) {
  const t = normalize(text)
  const found = new Set()
  if (/instagram|\big\b|insta|reels?/.test(t)) found.add('instagram')
  if (/tiktok|tik tok|tiktoker/.test(t)) found.add('tiktok')
  if (/youtube|yt\b|youtuber/.test(t)) found.add('youtube')
  return [...found].filter((p) => PLATFORMS.includes(p))
}

function extractCities(text) {
  const t = normalize(text)
  return CITIES.filter((c) => new RegExp(`\\b${normalize(c)}\\b`).test(t))
}

function extractAudience(text) {
  const t = normalize(text)
  if (/publico femenino|audiencia femenina|mujeres|chicas/.test(t)) return 'female'
  if (/publico masculino|audiencia masculina|hombres|chicos/.test(t)) return 'male'
  return null
}

const STOPWORDS = new Set(
  'de del la el los las un una unos unas y o con sin para por en que quiero busco buscar necesito me mi mis su sus creador creadores creadora creadoras influencer influencers micro perfil perfiles gente persona personas seguidores followers engagement marca producto servicio campana campanas promocionar promocion publicidad anuncio anuncios es son tiene tengan ser mas menos entre hasta entre entre euros eur entre muy'.split(
    ' ',
  ),
)

function extractKeywords(text) {
  return normalize(text)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .slice(0, 8)
}

/**
 * Convierte una consulta libre en filtros estructurados.
 * @returns {{filters: object, interpretation: string[], query: string}}
 */
export function parseQuery(query) {
  const text = String(query || '')
  const categories = extractCategories(text)
  const cities = extractCities(text)
  const platforms = extractPlatforms(text)
  const followers = extractFollowers(text)
  const budget = extractBudget(text)
  const engagement = extractEngagement(text)
  const audience = extractAudience(text)
  const keywords = extractKeywords(text)

  const filters = {
    categories,
    cities,
    platforms,
    minFollowers: followers.min ?? undefined,
    maxFollowers: followers.max ?? undefined,
    maxBudget: budget ?? undefined,
    minEngagement: engagement ?? undefined,
    audienceGender: audience ?? undefined,
    keywords,
  }

  const interpretation = []
  if (categories.length) interpretation.push(`Categoria: ${categories.join(', ')}`)
  if (cities.length) interpretation.push(`Ciudad: ${cities.join(', ')}`)
  if (platforms.length) interpretation.push(`Plataforma: ${platforms.join(', ')}`)
  if (followers.min || followers.max) {
    const fmt = (n) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(n))
    interpretation.push(
      `Seguidores: ${followers.min ? fmt(followers.min) : '0'} - ${followers.max ? fmt(followers.max) : 'sin limite'}`,
    )
  }
  if (budget) interpretation.push(`Presupuesto: hasta ${budget} EUR`)
  if (engagement) interpretation.push(`Engagement minimo: ${engagement}%`)
  if (audience) interpretation.push(`Audiencia: ${audience === 'female' ? 'mayoritariamente femenina' : 'mayoritariamente masculina'}`)
  if (!interpretation.length && keywords.length) interpretation.push(`Palabras clave: ${keywords.join(', ')}`)

  return { filters, interpretation, query: text }
}

export default parseQuery
