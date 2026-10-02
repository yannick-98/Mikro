/**
 * Datos de demostracion de Mikro.
 *
 * Genera un marketplace creible: creadores con metricas coherentes entre si,
 * pymes con campanas abiertas y colaboraciones en todos los estados del flujo,
 * para poder recorrer el producto entero sin tener que crear nada a mano.
 *
 *   node prisma/seed.js
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// El seed hace miles de escrituras seguidas: el pooler en modo transaccion no
// mantiene la sesion y corta a mitad, asi que se usa la conexion directa.
const seedUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL

const prisma = new PrismaClient(seedUrl ? { datasources: { db: { url: seedUrl } } } : {})

/**
 * El seed borra TODO antes de sembrar. Contra una base remota eso destruiria
 * los datos de la demo publica, asi que hay que pedirlo de forma explicita.
 */
function assertSafeTarget() {
  const url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || ''
  const isLocal = /localhost|127\.0\.0\.1|file:/.test(url)
  const allowed = process.env.SEED_ALLOW_REMOTE === '1' || process.argv.includes('--force')

  if (!url) {
    console.error('No hay DATABASE_URL configurada.')
    process.exit(1)
  }
  if (!isLocal && !allowed) {
    const host = url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@').split('@')[1] || '(desconocido)'
    console.error(`\nEsta base NO es local (${host}) y el seed borra todos los datos.`)
    console.error('Si de verdad quieres reiniciarla, ejecuta: npm run seed -- --force\n')
    process.exit(1)
  }
}

assertSafeTarget()

// --- utilidades deterministas ------------------------------------------------
let seedState = 20260929

/** PRNG reproducible: cada ejecucion del seed genera los mismos datos. */
function rnd() {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296
  return seedState / 4294967296
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const between = (min, max) => Math.floor(min + rnd() * (max - min + 1))
const decimal = (min, max, places = 1) => Number((min + rnd() * (max - min)).toFixed(places))
const chance = (p) => rnd() < p

const PALETTES = [
  ['#2563eb', '#1e3a8a'], ['#0ea5e9', '#0369a1'], ['#8b5cf6', '#5b21b6'],
  ['#ec4899', '#9d174d'], ['#f59e0b', '#b45309'], ['#10b981', '#065f46'],
  ['#ef4444', '#991b1b'], ['#14b8a6', '#115e59'],
]

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) { h = (h << 5) - h + str.charCodeAt(i); h |= 0 }
  return Math.abs(h)
}

function avatarFor(name) {
  const [from, to] = PALETTES[hashString(name) % PALETTES.length]
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient></defs><rect width="240" height="240" fill="url(#g)"/><text x="50%" y="52%" dy=".35em" text-anchor="middle" font-family="Inter,Segoe UI,sans-serif" font-size="96" font-weight="700" fill="#ffffff" fill-opacity="0.92">${initials}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const photo = (seed) => `https://i.pravatar.cc/400?u=mikro-${seed}`
const shot = (seed) => `https://picsum.photos/seed/mikro-${seed}/400/400`

// --- catalogos ---------------------------------------------------------------
const CATEGORY_DATA = {
  Fitness: {
    headlines: ['Salud, deporte y una vida mas feliz.', 'Entrena conmigo desde casa.', 'Rutinas reales para gente ocupada.', 'Fuerza, constancia y buena comida.'],
    subs: ['gimnasio', 'running', 'nutricion', 'crossfit', 'yoga'],
    captions: ['Rutina de 20 minutos', 'Mi desayuno post entreno', 'Test de zapatillas', 'Reto 30 dias'],
  },
  Moda: {
    headlines: ['Belleza real para un mundo real.', 'Looks de diario sin gastar de mas.', 'Moda sostenible y de proximidad.', 'Tu armario capsula, paso a paso.'],
    subs: ['streetwear', 'sostenible', 'low cost', 'accesorios'],
    captions: ['Look de oficina', 'Haul de temporada', 'Tres formas de llevarlo', 'Mi armario capsula'],
  },
  Gastronomia: {
    headlines: ['Buena comida, mejores historias.', 'Recetas de 15 minutos.', 'Los mejores bares de la ciudad.', 'Cocina de mercado para todos.'],
    subs: ['recetas', 'restaurantes', 'reposteria', 'vinos', 'vegano'],
    captions: ['Receta de la semana', 'Probando el nuevo local', 'Mi despensa basica', 'Brunch del domingo'],
  },
  Viajes: {
    headlines: ['Explorando el mundo, un destino a la vez.', 'Escapadas de fin de semana.', 'Viajar barato tambien es posible.', 'Rincones que no salen en las guias.'],
    subs: ['escapadas', 'hoteles', 'aventura', 'roadtrip'],
    captions: ['48 horas en la costa', 'Hotel con encanto', 'Mi mochila de viaje', 'Ruta en coche'],
  },
  Gaming: {
    headlines: ['Videojuegos, comunidad y buen rollo.', 'Directos cada tarde.', 'Analisis sin postureo.', 'Retro y novedades a partes iguales.'],
    subs: ['directos', 'analisis', 'esports', 'retro'],
    captions: ['Primeras impresiones', 'Setup actualizado', 'Partida con la comunidad', 'Top 5 del mes'],
  },
  Tecnologia: {
    headlines: ['Tecnologia para una vida mas simple.', 'Gadgets probados de verdad.', 'IA explicada sin humo.', 'Trucos para tu movil.'],
    subs: ['gadgets', 'moviles', 'apps', 'inteligencia artificial'],
    captions: ['Analisis en 60 segundos', 'Mi setup de trabajo', 'Comparativa de moviles', 'Apps que si uso'],
  },
  Lifestyle: {
    headlines: ['El dia a dia, sin filtros.', 'Vida sencilla y organizada.', 'Rutinas que funcionan.', 'Bienestar sin postureo.'],
    subs: ['productividad', 'bienestar', 'organizacion', 'vlog'],
    captions: ['Mi rutina de manana', 'Domingo de reset', 'Lo que uso cada dia', 'Un dia conmigo'],
  },
  Belleza: {
    headlines: ['Skincare sin milagros.', 'Maquillaje facil de verdad.', 'Cuida tu piel, cuida tu tiempo.', 'Cosmetica que si funciona.'],
    subs: ['skincare', 'maquillaje', 'peluqueria', 'cosmetica natural'],
    captions: ['Mi rutina de noche', 'Probando producto nuevo', 'Maquillaje en 5 minutos', 'Antes y despues'],
  },
  Humor: {
    headlines: ['Reirse de uno mismo es gratis.', 'Sketches del dia a dia.', 'Humor cotidiano y cercano.', 'La vida en clave de broma.'],
    subs: ['sketches', 'parodia', 'improvisacion'],
    captions: ['Cuando tu jefe dice...', 'Sketch del lunes', 'Colaboracion sorpresa', 'Detras de camaras'],
  },
  Musica: {
    headlines: ['Musica hecha en casa.', 'Versiones y directos.', 'Descubre artistas nuevos.', 'De la maqueta al escenario.'],
    subs: ['versiones', 'produccion', 'conciertos', 'dj'],
    captions: ['Version acustica', 'Nuevo single', 'Ensayo con la banda', 'Backstage'],
  },
  Hogar: {
    headlines: ['Tu casa, tu refugio.', 'Decorar sin arruinarse.', 'DIY facil para principiantes.', 'Orden que dura.'],
    subs: ['decoracion', 'diy', 'organizacion', 'plantas'],
    captions: ['Antes y despues del salon', 'DIY de estanteria', 'Mis plantas favoritas', 'Truco de orden'],
  },
  Mascotas: {
    headlines: ['La vida con perro es mejor.', 'Adiestramiento en positivo.', 'Cuidados que importan.', 'Dos gatos y mucho caos.'],
    subs: ['perros', 'gatos', 'adiestramiento', 'adopcion'],
    captions: ['Paseo de la manana', 'Truco de adiestramiento', 'Probando snacks', 'Dia de veterinario'],
  },
  Familia: {
    headlines: ['Criar sin manual, pero con humor.', 'Planes con ninos en la ciudad.', 'Maternidad real.', 'Trucos de familia numerosa.'],
    subs: ['maternidad', 'planes con ninos', 'crianza', 'bebes'],
    captions: ['Plan de finde', 'Meriendas faciles', 'Vuelta al cole', 'Nuestro dia a dia'],
  },
  Finanzas: {
    headlines: ['Tus finanzas, en cristiano.', 'Ahorrar sin dejar de vivir.', 'Emprender desde cero.', 'Invertir con cabeza.'],
    subs: ['ahorro', 'inversion', 'emprendimiento', 'autonomos'],
    captions: ['Presupuesto mensual', 'Error que me costo caro', 'Tres apps de ahorro', 'Explicado en 1 minuto'],
  },
}

const CITIES = [
  ['Madrid', 'Madrid'], ['Barcelona', 'Barcelona'], ['Valencia', 'Valencia'], ['Sevilla', 'Sevilla'],
  ['Bilbao', 'Vizcaya'], ['Malaga', 'Malaga'], ['Zaragoza', 'Zaragoza'], ['Murcia', 'Murcia'],
  ['Palma', 'Baleares'], ['Las Palmas', 'Las Palmas'], ['Alicante', 'Alicante'], ['Valladolid', 'Valladolid'],
  ['Vigo', 'Pontevedra'], ['Granada', 'Granada'], ['San Sebastian', 'Guipuzcoa'], ['Santander', 'Cantabria'],
]

const FIRST = ['Marta', 'Alex', 'Lucia', 'Carlos', 'Laura', 'Javi', 'Elena', 'Sergio', 'Nerea', 'Pablo', 'Ana', 'Ruben', 'Claudia', 'Diego', 'Irene', 'Hugo', 'Sara', 'Marcos', 'Paula', 'Adrian', 'Rocio', 'Victor', 'Alba', 'Ivan', 'Carmen', 'Jorge', 'Noelia', 'Raul', 'Cristina', 'Dani', 'Miriam', 'Alvaro', 'Silvia', 'Guillermo', 'Patricia', 'Oscar', 'Andrea', 'Nacho', 'Beatriz', 'Toni']
const LAST = ['Garcia', 'Lopez', 'Martinez', 'Sanchez', 'Perez', 'Gomez', 'Fernandez', 'Ruiz', 'Diaz', 'Moreno', 'Alvarez', 'Romero', 'Navarro', 'Torres', 'Dominguez', 'Vazquez', 'Ramos', 'Gil', 'Serrano', 'Blanco', 'Molina', 'Castro', 'Ortega', 'Rubio', 'Marin', 'Iglesias', 'Medina', 'Cortes', 'Santos', 'Herrera']

// Perfiles del diseno: encabezan el ranking y fijan el aspecto de la portada.
const HERO_CREATORS = [
  { name: 'Marta Garcia', handle: 'martagarcia', category: 'Fitness', city: 'Madrid', province: 'Madrid', headline: 'Salud, deporte y una vida mas feliz.', ig: [1200000, 6.9], tt: [2100000, 7.1], yt: [320000, 5.4], delta: 2, featured: true, verified: true },
  { name: 'Alex Nomada', handle: 'alexnomada', category: 'Viajes', city: 'Barcelona', province: 'Barcelona', headline: 'Explorando el mundo, un destino a la vez.', ig: [892000, 5.4], tt: [1400000, 5.3], yt: [410000, 4.6], delta: 4, featured: true, verified: true },
  { name: 'Lucia Style', handle: 'luciastyle', category: 'Moda', city: 'Valencia', province: 'Valencia', headline: 'Belleza real para un mundo real.', ig: [650000, 4.3], tt: [980000, 4.2], yt: [210000, 3.5], delta: -1, verified: true },
  { name: 'CarlosPlay', handle: 'carlosplay', category: 'Gaming', city: 'Sevilla', province: 'Sevilla', headline: 'Videojuegos, comunidad y buen rollo.', ig: [520000, 5.8], tt: [1800000, 6.8], yt: [660000, 6.1], delta: 6, verified: true },
  { name: 'Laura Jimenez', handle: 'laurajimenez', category: 'Gastronomia', city: 'Valencia', province: 'Valencia', headline: 'Buena comida, mejores historias.', ig: [480000, 6.1], tt: [720000, 5.9], yt: [180000, 4.8], delta: 1, verified: true },
  { name: 'Javi Tech', handle: 'javitech', category: 'Tecnologia', city: 'Madrid', province: 'Madrid', headline: 'Tecnologia para una vida mas simple.', ig: [430000, 4.6], tt: [620000, 5.1], yt: [310000, 4.9], delta: -3, verified: true },
  { name: 'Elena Live', handle: 'elenalive', category: 'Musica', city: 'Bilbao', province: 'Vizcaya', headline: 'Musica hecha en casa.', ig: [310000, 6.2], tt: [540000, 6.6], yt: [220000, 5.2], delta: 5, verified: true },
]

const BRANDS = [
  { company: 'Panaderia La Espiga', sector: 'Alimentacion', city: 'Valencia', email: 'hola@laespiga.es', size: '6-20', budget: 900, desc: 'Obrador artesano con tres tiendas en Valencia. Masa madre y producto local.' },
  { company: 'Gimnasios Impulso', sector: 'Deporte y fitness', city: 'Madrid', email: 'marketing@impulso.es', size: '21-50', budget: 2500, desc: 'Cadena de gimnasios de barrio con clases dirigidas y entrenamiento personal.' },
  { company: 'Nordic Home', sector: 'Decoracion', city: 'Barcelona', email: 'hola@nordichome.es', size: '6-20', budget: 1800, desc: 'Muebles y decoracion de estilo nordico fabricados en Cataluna.' },
  { company: 'Cosmetica Aloe', sector: 'Belleza', city: 'Malaga', email: 'info@cosmeticaaloe.es', size: '1-5', budget: 700, desc: 'Cosmetica natural con aloe cultivado en Andalucia. Venta online.' },
  { company: 'TechnoPiso', sector: 'Tecnologia', city: 'Madrid', email: 'contacto@technopiso.es', size: '6-20', budget: 1500, desc: 'Tienda de gadgets y domotica para el hogar con servicio de instalacion.' },
  { company: 'Restaurante Marea', sector: 'Restauracion', city: 'San Sebastian', email: 'reservas@marea.eus', size: '21-50', budget: 1100, desc: 'Cocina de producto con vistas a la bahia. Menu de temporada.' },
  { company: 'PetGourmet', sector: 'Mascotas', city: 'Zaragoza', email: 'hola@petgourmet.es', size: '1-5', budget: 600, desc: 'Comida natural para perros y gatos elaborada en Aragon.' },
  { company: 'Viajes Altamar', sector: 'Turismo', city: 'Palma', email: 'grupos@altamar.es', size: '6-20', budget: 2000, desc: 'Agencia de escapadas y experiencias en las islas.' },
  { company: 'Moda Circular', sector: 'Moda', city: 'Bilbao', email: 'hola@modacircular.es', size: '1-5', budget: 800, desc: 'Ropa de segunda mano seleccionada y upcycling.' },
  { company: 'Cafe Sonoro', sector: 'Restauracion', city: 'Sevilla', email: 'hola@cafesonoro.es', size: '6-20', budget: 650, desc: 'Cafeteria de especialidad con conciertos acusticos los jueves.' },
  { company: 'Academia Ruta', sector: 'Educacion', city: 'Murcia', email: 'info@academiaruta.es', size: '6-20', budget: 1200, desc: 'Formacion online en oficios digitales para jovenes.' },
  { company: 'Bodegas Peralta', sector: 'Alimentacion', city: 'Valladolid', email: 'ventas@peralta.es', size: '21-50', budget: 2200, desc: 'Bodega familiar de Ribera con visitas y catas.' },
]

const CAMPAIGN_TEMPLATES = [
  { title: 'Lanzamiento de nuestra masa madre', category: 'Gastronomia', deliverables: '1 reel, 3 stories', brief: 'Buscamos creadores de gastronomia de Valencia que visiten el obrador, prueben la nueva hogaza de masa madre y cuenten el proceso artesanal. Queremos contenido natural, nada de guion rigido. Invitamos a desayuno para dos personas.' },
  { title: 'Reto 21 dias en Impulso', category: 'Fitness', deliverables: '2 reels, 5 stories, 1 post', brief: 'Campana de captacion para septiembre. Necesitamos perfiles de fitness de Madrid que entrenen en nuestros centros durante tres semanas y compartan su progreso. Incluye cuota gratuita y sesiones con entrenador personal.' },
  { title: 'Renueva tu salon con Nordic Home', category: 'Hogar', deliverables: '1 reel, 1 post, 4 stories', brief: 'Enviamos una seleccion de piezas valorada en 600 euros para que renueves un rincon de tu casa y muestres el antes y el despues. Buscamos estilo nordico y luz natural.' },
  { title: 'Rutina de piel sensible', category: 'Belleza', deliverables: '1 reel, 3 stories', brief: 'Queremos ensenar la rutina completa con nuestra linea de aloe en pieles sensibles. Valoramos creadores con audiencia femenina de 25 a 40 anos y honestidad en las opiniones.' },
  { title: 'Domotiza tu casa en un fin de semana', category: 'Tecnologia', deliverables: '1 video largo, 2 stories', brief: 'Buscamos perfiles tech que instalen nuestro kit de domotica y expliquen paso a paso la configuracion. Se entrega el kit completo y se paga por el video.' },
  { title: 'Menu de temporada en Marea', category: 'Gastronomia', deliverables: '1 reel, 4 stories', brief: 'Invitamos a comer para dos personas a cambio de contenido sobre el nuevo menu de otono. Preferimos creadores del Pais Vasco con buena fotografia de producto.' },
  { title: 'Snacks naturales para tu perro', category: 'Mascotas', deliverables: '2 reels, 3 stories', brief: 'Campana de muestra de producto. Enviamos un pack mensual y buscamos contenido real con la mascota probando los snacks. Importante mostrar los ingredientes.' },
  { title: 'Escapada de otono a las islas', category: 'Viajes', deliverables: '1 reel, 1 post, 6 stories', brief: 'Escapada de tres noches con alojamiento y actividades cubiertas. Buscamos creadores de viajes que sepan contar historias y tengan buena audiencia nacional.' },
  { title: 'Segunda mano, primera eleccion', category: 'Moda', deliverables: '1 reel, 2 stories', brief: 'Queremos normalizar la ropa de segunda mano. Buscamos creadores de moda que monten dos looks completos con prendas de nuestra tienda y cuenten su impacto.' },
  { title: 'Jueves de directo en Cafe Sonoro', category: 'Musica', deliverables: '1 reel, 4 stories', brief: 'Cobertura de nuestros conciertos acusticos de los jueves. Buscamos perfiles locales de Sevilla vinculados a la musica y el ocio cultural.' },
  { title: 'Aprende un oficio digital', category: 'Finanzas', deliverables: '1 video largo, 2 posts', brief: 'Campana de matriculacion. Buscamos creadores que hablen de empleo, emprendimiento o finanzas personales y puedan explicar el valor de la formacion tecnica.' },
  { title: 'Visita a la bodega y cata', category: 'Gastronomia', deliverables: '1 reel, 1 post, 3 stories', brief: 'Experiencia completa de visita, cata y comida para dos personas. Buscamos creadores gastronomicos con audiencia adulta y mensaje de consumo responsable.' },
]

const REVIEW_COMMENTS = [
  'Trabajo impecable y entrega puntual. Repetiremos seguro.',
  'Muy buena comunicacion y contenido que encaja con nuestra marca.',
  'Superó lo acordado: nos entregó material extra para redes.',
  'Profesional y cercano. El engagement fue mejor de lo esperado.',
  'Contenido cuidado y datos de alcance muy transparentes.',
  'Buena experiencia, aunque tardó unos dias en entregar.',
]

const MESSAGES = [
  'Hola, encantada de trabajar con vosotros. Os paso propuesta de guion esta semana.',
  'Perfecto, nos encaja. Cuando podrias grabar?',
  'Tengo hueco el jueves por la manana. Os va bien?',
  'Genial, os enviamos el producto hoy mismo por mensajeria.',
  'Recibido todo, muchas gracias. Empiezo a preparar el contenido.',
]

// --- generacion --------------------------------------------------------------

// Combinaciones categoria x ciudad que deben existir si o si: son las que se
// buscan en la demo y en un marketplace real son las de mayor demanda.
const PRIORITY_MIX = []
for (const city of ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Malaga']) {
  for (const category of ['Gastronomia', 'Fitness', 'Moda', 'Belleza', 'Lifestyle', 'Tecnologia']) {
    PRIORITY_MIX.push([category, city])
  }
}

function buildCreator(index) {
  const hero = HERO_CREATORS[index]

  // Tras los perfiles del diseno se cubre la malla prioritaria; el resto es libre.
  const slot = hero ? null : PRIORITY_MIX[index - HERO_CREATORS.length]
  const category = hero?.category || slot?.[0] || pick(Object.keys(CATEGORY_DATA))
  const data = CATEGORY_DATA[category]
  const [city, province] = hero
    ? [hero.city, hero.province]
    : slot
      ? [slot[1], CITIES.find((c) => c[0] === slot[1])[1]]
      : pick(CITIES)
  const name = hero?.name || `${pick(FIRST)} ${pick(LAST)}`
  const handle =
    hero?.handle ||
    `${name.toLowerCase().replace(/[^a-z ]/g, '').split(' ').join('')}${between(1, 99)}`

  // Los micro-influencers son el nucleo del catalogo: 3K-90K seguidores.
  const base = hero ? null : between(3000, 90000)
  const igFollowers = hero ? hero.ig[0] : Math.round(base * decimal(0.8, 1.2, 2))
  const hasTiktok = hero ? true : chance(0.72)
  const hasYoutube = hero ? true : chance(0.38)

  // El engagement baja con el tamano de la cuenta: refleja el dato real del sector.
  const sizeFactor = Math.max(0.5, 1.6 - Math.log10(igFollowers) / 4)
  const igEngagement = hero ? hero.ig[1] : Number((decimal(2.4, 8.2) * sizeFactor).toFixed(1))

  const accounts = [
    { platform: 'instagram', handle: `@${handle}`, followers: igFollowers, engagement: Math.min(igEngagement, 12), avgViews: Math.round(igFollowers * decimal(0.3, 0.9, 2)), url: `https://instagram.com/${handle}` },
  ]
  if (hasTiktok) {
    const f = hero ? hero.tt[0] : Math.round(igFollowers * decimal(0.6, 2.4, 2))
    accounts.push({ platform: 'tiktok', handle: `@${handle}`, followers: f, engagement: hero ? hero.tt[1] : Math.min(Number((igEngagement * decimal(0.9, 1.4)).toFixed(1)), 14), avgViews: Math.round(f * decimal(0.5, 1.8, 2)), url: `https://tiktok.com/@${handle}` })
  }
  if (hasYoutube) {
    const f = hero ? hero.yt[0] : Math.round(igFollowers * decimal(0.15, 0.7, 2))
    accounts.push({ platform: 'youtube', handle: handle, followers: f, engagement: hero ? hero.yt[1] : Math.min(Number((igEngagement * decimal(0.6, 1.0)).toFixed(1)), 9), avgViews: Math.round(f * decimal(0.2, 0.8, 2)), url: `https://youtube.com/@${handle}` })
  }

  const totalFollowers = accounts.reduce((s, a) => s + a.followers, 0)
  // Tarifa orientativa con curva sublineal: el precio por seguidor baja segun
  // crece la cuenta, como en el mercado real. Un micro de 20K ronda los 120 EUR
  // y una cuenta de 1M no se dispara a cifras inventadas.
  const ratePost = Math.max(
    60,
    Math.round((Math.pow(totalFollowers, 0.85) * decimal(0.02, 0.03, 4)) / 10) * 10,
  )

  return {
    hero,
    creator: {
      handle,
      displayName: name,
      headline: hero?.headline || pick(data.headlines),
      bio: `${pick(data.headlines)} Creo contenido sobre ${pick(data.subs)} y ${pick(data.subs)} desde ${city}. Colaboro con marcas que cuido como si fueran mias: nada de publicidad forzada.`,
      avatarUrl: photo(handle),
      coverUrl: shot(`cover-${handle}`),
      category,
      subcategories: [...new Set([pick(data.subs), pick(data.subs)])].join(', '),
      city,
      province,
      country: 'Espana',
      languages: chance(0.25) ? 'Espanol, Ingles' : 'Espanol',
      verified: hero ? hero.verified : chance(0.35),
      featured: hero ? !!hero.featured : chance(0.06),
      available: hero ? true : chance(0.93),
      totalFollowers,
      engagementRate: Number((accounts.reduce((s, a) => s + a.engagement * a.followers, 0) / totalFollowers).toFixed(2)),
      rankDelta: hero ? hero.delta : between(-6, 6),
      responseHours: between(2, 48),
      audienceCountry: chance(0.85) ? 'Espana' : pick(['Latinoamerica', 'Europa', 'Global']),
      audienceFemalePct: between(25, 82),
      audienceAgeRange: pick(['18-24', '25-34', '25-34', '35-44', '45-54']),
      ratePost,
      rateReel: Math.round(ratePost * decimal(1.3, 1.8) / 10) * 10,
      rateStory: Math.round(ratePost * decimal(0.3, 0.5) / 10) * 10,
      rateUgc: Math.round(ratePost * decimal(0.8, 1.2) / 10) * 10,
    },
    accounts,
    portfolio: Array.from({ length: 4 }, (_, i) => ({
      imageUrl: shot(`${handle}-${i}`),
      caption: pick(CATEGORY_DATA[category].captions),
      platform: pick(['instagram', 'tiktok']),
      likes: Math.round(totalFollowers * decimal(0.02, 0.12, 3)),
      position: i,
    })),
  }
}

async function main() {
  console.log('Limpiando base de datos...')
  await prisma.payment.deleteMany()
  await prisma.review.deleteMany()
  await prisma.message.deleteMany()
  await prisma.deal.deleteMany()
  await prisma.application.deleteMany()
  await prisma.campaign.deleteMany()
  await prisma.savedCreator.deleteMany()
  await prisma.rankSnapshot.deleteMany()
  await prisma.portfolioItem.deleteMany()
  await prisma.socialAccount.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.creator.deleteMany()
  await prisma.brand.deleteMany()
  await prisma.user.deleteMany()

  const password = await bcrypt.hash('mikro1234', 10)

  console.log('Creando administrador...')
  await prisma.user.create({
    data: { email: 'admin@mikro.es', passwordHash: password, role: 'ADMIN', name: 'Equipo Mikro', avatarUrl: avatarFor('Equipo Mikro') },
  })

  console.log('Creando creadores...')
  const TOTAL_CREATORS = 68
  const creators = []
  for (let i = 0; i < TOTAL_CREATORS; i += 1) {
    const built = buildCreator(i)
    const email = `${built.creator.handle}@creador.mikro.es`
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: password,
        role: 'CREATOR',
        name: built.creator.displayName,
        avatarUrl: built.creator.avatarUrl,
        creator: {
          create: {
            ...built.creator,
            socialAccounts: { create: built.accounts },
            portfolio: { create: built.portfolio },
          },
        },
      },
      include: { creator: true },
    })
    creators.push(user.creator)
  }
  console.log(`  ${creators.length} creadores`)

  console.log('Creando empresas...')
  const brands = []
  for (const b of BRANDS) {
    const user = await prisma.user.create({
      data: {
        email: b.email,
        passwordHash: password,
        role: 'BRAND',
        name: b.company,
        avatarUrl: avatarFor(b.company),
        brand: {
          create: {
            companyName: b.company,
            sector: b.sector,
            city: b.city,
            website: `https://www.${b.company.toLowerCase().replace(/[^a-z]/g, '')}.es`,
            logoUrl: avatarFor(b.company),
            description: b.desc,
            teamSize: b.size,
            monthlyBudget: b.budget,
            verified: chance(0.7),
          },
        },
      },
      include: { brand: true },
    })
    brands.push(user.brand)
  }
  console.log(`  ${brands.length} empresas`)

  console.log('Creando campanas...')
  const campaigns = []
  for (let i = 0; i < CAMPAIGN_TEMPLATES.length; i += 1) {
    const t = CAMPAIGN_TEMPLATES[i]
    const brand = brands[i % brands.length]
    const budgetMin = between(120, 420)
    const platforms = ['instagram']
    if (chance(0.6)) platforms.push('tiktok')
    if (chance(0.25)) platforms.push('youtube')

    const campaign = await prisma.campaign.create({
      data: {
        brandId: brand.id,
        title: t.title,
        brief: t.brief,
        category: t.category,
        deliverables: t.deliverables,
        budgetMin,
        budgetMax: budgetMin + between(100, 700),
        targetCity: chance(0.6) ? brand.city : null,
        minFollowers: between(3000, 12000),
        maxFollowers: between(60000, 200000),
        platforms: platforms.join(','),
        status: i < 9 ? 'OPEN' : pick(['OPEN', 'CLOSED', 'COMPLETED']),
        productValue: chance(0.5) ? between(50, 600) : 0,
        startDate: new Date(Date.now() + between(2, 20) * 86400000),
        endDate: new Date(Date.now() + between(25, 70) * 86400000),
      },
    })
    campaigns.push(campaign)
  }
  console.log(`  ${campaigns.length} campanas`)

  console.log('Creando candidaturas y colaboraciones...')
  const feePct = Number(process.env.PLATFORM_FEE_PCT || 12)
  let deals = 0
  let applications = 0

  for (const campaign of campaigns) {
    // Candidatos afines: misma categoria, con algo de ruido para que sea creible.
    const pool = creators
      .filter((c) => c.category === campaign.category || chance(0.12))
      .slice(0, 40)
    const candidates = []
    const n = between(3, 8)
    for (let i = 0; i < n && pool.length; i += 1) {
      const c = pool[Math.floor(rnd() * pool.length)]
      if (!candidates.find((x) => x.id === c.id)) candidates.push(c)
    }

    for (const creator of candidates) {
      const proposedFee = between(campaign.budgetMin, campaign.budgetMax)
      const app = await prisma.application.create({
        data: {
          campaignId: campaign.id,
          creatorId: creator.id,
          message: `Hola! Me encaja mucho esta campana: trabajo contenido de ${creator.category.toLowerCase()} en ${creator.city} y mi audiencia es justo la que buscais. Os propongo ${proposedFee} EUR por los entregables indicados.`,
          proposedFee,
          status: 'PENDING',
          source: chance(0.2) ? 'BRAND' : 'CREATOR',
        },
      })
      applications += 1

      // Una parte de las candidaturas avanza a colaboracion.
      if (chance(0.38)) {
        await prisma.application.update({ where: { id: app.id }, data: { status: 'ACCEPTED' } })
        const fee = proposedFee
        const feePlatform = Math.round((fee * feePct) / 100)
        const status = pick(['ACCEPTED', 'FUNDED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'PAID', 'PAID'])

        const deal = await prisma.deal.create({
          data: {
            campaignId: campaign.id,
            brandId: campaign.brandId,
            creatorId: creator.id,
            fee,
            feePlatform,
            status,
            contentUrl: ['SUBMITTED', 'APPROVED', 'PAID'].includes(status)
              ? `https://instagram.com/p/${Math.random().toString(36).slice(2, 12)}`
              : null,
          },
        })
        deals += 1

        // Movimientos de dinero coherentes con el estado.
        if (['FUNDED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'PAID'].includes(status)) {
          await prisma.payment.create({
            data: { dealId: deal.id, amount: fee, fee: feePlatform, kind: 'ESCROW_IN', reference: `ESC-${deal.id.slice(-6).toUpperCase()}` },
          })
        }
        if (status === 'PAID') {
          await prisma.payment.create({
            data: { dealId: deal.id, amount: fee - feePlatform, fee: feePlatform, kind: 'PAYOUT', reference: `PAY-${deal.id.slice(-6).toUpperCase()}` },
          })
        }

        // Conversacion de ejemplo
        const brandUser = await prisma.brand.findUnique({ where: { id: campaign.brandId }, select: { userId: true } })
        const creatorUser = await prisma.creator.findUnique({ where: { id: creator.id }, select: { userId: true } })
        const howMany = between(2, 5)
        for (let m = 0; m < howMany; m += 1) {
          await prisma.message.create({
            data: {
              dealId: deal.id,
              senderId: m % 2 === 0 ? creatorUser.userId : brandUser.userId,
              body: MESSAGES[m % MESSAGES.length],
              createdAt: new Date(Date.now() - (howMany - m) * 3600000),
            },
          })
        }

        // Valoracion cuando la colaboracion esta cerrada
        if (['APPROVED', 'PAID'].includes(status) && chance(0.8)) {
          await prisma.review.create({
            data: {
              dealId: deal.id,
              authorId: brandUser.userId,
              creatorId: creator.id,
              rating: chance(0.75) ? 5 : chance(0.7) ? 4 : 3,
              comment: pick(REVIEW_COMMENTS),
            },
          })
        }
      }
    }
  }
  console.log(`  ${applications} candidaturas, ${deals} colaboraciones`)

  console.log('Guardando creadores favoritos...')
  for (const brand of brands) {
    const picks = new Set()
    const n = between(2, 6)
    for (let i = 0; i < n; i += 1) picks.add(creators[Math.floor(rnd() * creators.length)].id)
    for (const creatorId of picks) {
      await prisma.savedCreator.create({ data: { brandId: brand.id, creatorId } })
    }
  }

  console.log('Recalculando metricas y ranking...')
  const { recomputeCreator, recomputeRanking } = await import('../src/services/creatorStats.js')
  for (const c of creators) await recomputeCreator(c.id)

  // Los perfiles del diseno deben encabezar el ranking: se fija su posicion y
  // se conserva el movimiento definido en HERO_CREATORS.
  const ordered = await prisma.creator.findMany({
    orderBy: [{ score: 'desc' }, { totalFollowers: 'desc' }],
    select: { id: true, handle: true },
  })
  const heroHandles = HERO_CREATORS.map((h) => h.handle)
  const heroFirst = [
    ...heroHandles.map((h) => ordered.find((o) => o.handle === h)).filter(Boolean),
    ...ordered.filter((o) => !heroHandles.includes(o.handle)),
  ]
  for (let i = 0; i < heroFirst.length; i += 1) {
    const hero = HERO_CREATORS.find((h) => h.handle === heroFirst[i].handle)
    await prisma.creator.update({
      where: { id: heroFirst[i].id },
      data: { rankPosition: i + 1, rankDelta: hero ? hero.delta : between(-6, 6) },
    })
    await prisma.rankSnapshot.create({ data: { creatorId: heroFirst[i].id, position: i + 1, score: 0 } })
  }

  console.log('Creando notificaciones de bienvenida...')
  const allUsers = await prisma.user.findMany({ select: { id: true, role: true } })
  for (const u of allUsers) {
    await prisma.notification.create({
      data: {
        userId: u.id,
        kind: 'WELCOME',
        title: 'Bienvenido a Mikro',
        body:
          u.role === 'BRAND'
            ? 'Publica tu primera campana y recibe candidaturas en menos de 24 horas.'
            : 'Completa tu perfil para aparecer antes en las busquedas de las marcas.',
        link: u.role === 'BRAND' ? '/empresa' : '/creador',
      },
    })
  }

  console.log('\nListo. Cuentas de prueba (contrasena: mikro1234)')
  console.log('  Empresa : hola@laespiga.es')
  console.log('  Empresa : marketing@impulso.es')
  console.log('  Creador : martagarcia@creador.mikro.es')
  console.log('  Creador : laurajimenez@creador.mikro.es')
  console.log('  Admin   : admin@mikro.es\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
