/** Vocabulario compartido por buscador, filtros y semillas. */

export const CATEGORIES = [
  'Fitness',
  'Moda',
  'Gastronomia',
  'Viajes',
  'Gaming',
  'Tecnologia',
  'Lifestyle',
  'Belleza',
  'Humor',
  'Musica',
  'Hogar',
  'Mascotas',
  'Familia',
  'Finanzas',
]

export const PLATFORMS = ['instagram', 'tiktok', 'youtube']

export const CITIES = [
  'Madrid',
  'Barcelona',
  'Valencia',
  'Sevilla',
  'Bilbao',
  'Malaga',
  'Zaragoza',
  'Murcia',
  'Palma',
  'Las Palmas',
  'Alicante',
  'Valladolid',
  'Vigo',
  'Granada',
  'San Sebastian',
  'Santander',
]

export const FOLLOWER_TIERS = [
  { id: 'nano', label: 'Nano (1K - 10K)', min: 1000, max: 10000 },
  { id: 'micro', label: 'Micro (10K - 50K)', min: 10000, max: 50000 },
  { id: 'mid', label: 'Medio (50K - 250K)', min: 50000, max: 250000 },
  { id: 'macro', label: 'Macro (250K - 1M)', min: 250000, max: 1000000 },
  { id: 'mega', label: 'Mega (+1M)', min: 1000000, max: 100000000 },
]

/** Sinonimos y terminos sueltos que apuntan a una categoria. */
export const CATEGORY_SYNONYMS = {
  Fitness: ['fitness', 'deporte', 'deportivo', 'gimnasio', 'gym', 'entrenamiento', 'running', 'crossfit', 'yoga', 'pilates', 'salud'],
  Moda: ['moda', 'fashion', 'ropa', 'estilo', 'outfit', 'streetwear', 'tendencias'],
  Gastronomia: ['gastronomia', 'gastro', 'comida', 'cocina', 'food', 'foodie', 'restaurante', 'restaurantes', 'receta', 'recetas', 'reposteria', 'bar'],
  Viajes: ['viajes', 'viaje', 'travel', 'turismo', 'escapada', 'escapadas', 'hotel', 'hoteles', 'aventura'],
  Gaming: ['gaming', 'gamer', 'videojuegos', 'juegos', 'esports', 'streamer', 'twitch'],
  Tecnologia: ['tecnologia', 'tech', 'gadgets', 'moviles', 'informatica', 'apps', 'inteligencia artificial', 'ia'],
  Lifestyle: ['lifestyle', 'estilo de vida', 'dia a dia', 'vlog', 'bienestar', 'productividad'],
  Belleza: ['belleza', 'beauty', 'maquillaje', 'makeup', 'skincare', 'cosmetica', 'peluqueria', 'uñas'],
  Humor: ['humor', 'comedia', 'gracioso', 'sketch', 'memes', 'entretenimiento'],
  Musica: ['musica', 'music', 'cantante', 'dj', 'conciertos', 'banda'],
  Hogar: ['hogar', 'decoracion', 'interiorismo', 'diy', 'muebles', 'reformas', 'jardin'],
  Mascotas: ['mascotas', 'perros', 'perro', 'gatos', 'gato', 'animales', 'veterinaria'],
  Familia: ['familia', 'maternidad', 'paternidad', 'bebes', 'niños', 'crianza'],
  Finanzas: ['finanzas', 'inversion', 'bolsa', 'ahorro', 'economia', 'emprendimiento', 'negocios'],
}

/** Quita acentos y pasa a minusculas para comparar texto libre. */
export function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/** Devuelve la categoria canonica a partir de cualquier sinonimo. */
export function resolveCategory(term) {
  const t = normalize(term)
  if (!t) return null
  for (const [category, words] of Object.entries(CATEGORY_SYNONYMS)) {
    if (normalize(category) === t) return category
    if (words.some((w) => normalize(w) === t)) return category
  }
  return null
}

/** Busca la ciudad canonica dentro de un texto libre. */
export function findCity(text) {
  const t = normalize(text)
  return CITIES.find((city) => t.includes(normalize(city))) || null
}
