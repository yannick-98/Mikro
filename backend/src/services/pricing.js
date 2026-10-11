/**
 * Precio de referencia de una colaboracion.
 *
 * Es el bloqueo numero uno de los dos lados del mercado: la pyme no sabe si
 * 300 EUR es caro y el creador no sabe que pedir. La respuesta no la tiene
 * nadie salvo quien ve lo que se paga de verdad, y eso es precisamente lo que
 * Mikro acumula en cada colaboracion cerrada.
 *
 * La regla que gobierna todo este modulo: **cuando no hay datos suficientes,
 * se dice**. Un rango inventado con tres muestras es peor que no dar ninguno,
 * porque la gente lo va a usar para negociar y nosotros habremos puesto el
 * ancla. Por eso cada respuesta lleva su tamano de muestra y su nivel, y hay
 * un escalon final de tarifas orientativas que se declara como tal.
 */
import { prisma } from '../lib/prisma.js'

/** A partir de aqui un rango se considera dato y no corazonada. */
export const MUESTRA_MINIMA = 8
/** Y a partir de aqui, ademas, se puede afinar por tramo de seguidores. */
export const MUESTRA_BUENA = 25

/**
 * Tramos de seguidores. Un perfil de 8.000 y uno de 80.000 no estan en el
 * mismo mercado aunque los dos sean "micro".
 */
export const TRAMOS = [
  { id: '1k-10k', min: 1000, max: 10000, etiqueta: '1K–10K' },
  { id: '10k-30k', min: 10000, max: 30000, etiqueta: '10K–30K' },
  { id: '30k-60k', min: 30000, max: 60000, etiqueta: '30K–60K' },
  { id: '60k-150k', min: 60000, max: 150000, etiqueta: '60K–150K' },
  { id: '150k+', min: 150000, max: Number.MAX_SAFE_INTEGER, etiqueta: 'más de 150K' },
]

export const tramoDe = (followers) =>
  TRAMOS.find((t) => followers >= t.min && followers < t.max) || TRAMOS[0]

/**
 * Tarifa orientativa cuando todavia no hay historico.
 *
 * Sale de una regla sencilla y declarada: en torno a 10 EUR por cada mil
 * seguidores para un reel, con suelo de 60 EUR, corregida por engagement. No
 * es un dato de mercado y la interfaz nunca debe presentarlo como tal.
 */
export function tarifaOrientativa({ followers = 0, engagement = 0 } = {}) {
  const base = Math.max(60, Math.round((followers / 1000) * 10))
  // El engagement corrige hasta un 50% arriba o un 30% abajo. Un 3% es la
  // referencia del sector para micro.
  const factor = engagement > 0 ? Math.min(1.5, Math.max(0.7, engagement / 3)) : 1
  const centro = Math.round((base * factor) / 10) * 10
  return { min: Math.round(centro * 0.7), max: Math.round(centro * 1.4), centro }
}

const percentil = (ordenados, p) => {
  if (!ordenados.length) return null
  const i = (ordenados.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return Math.round(lo === hi ? ordenados[lo] : ordenados[lo] + (ordenados[hi] - ordenados[lo]) * (i - lo))
}

/** Estadisticos de una lista de importes. */
function resumir(importes) {
  const orden = [...importes].sort((a, b) => a - b)
  return {
    muestra: orden.length,
    min: percentil(orden, 0.25),
    mediana: percentil(orden, 0.5),
    max: percentil(orden, 0.75),
    // Los extremos reales, utiles para que nadie piense que el rango es un tope.
    minimoVisto: orden[0] ?? null,
    maximoVisto: orden[orden.length - 1] ?? null,
  }
}

/**
 * Colaboraciones cerradas que sirven de referencia.
 *
 * Solo las que llegaron a buen puerto: una colaboracion cancelada no dice a
 * que precio se cierra el mercado, dice que esa no se cerro.
 */
const ESTADOS_VALIDOS = ['APPROVED', 'PAID', 'SUBMITTED', 'IN_PROGRESS', 'FUNDED']

/**
 * Precio de referencia para unos criterios.
 *
 * Va bajando de precision hasta encontrar muestra: sector y ciudad y tramo ->
 * sector y tramo -> tramo -> todo. El nivel alcanzado viaja en la respuesta
 * para que la interfaz pueda decir "en tu sector y tu ciudad" o solo "en
 * general", que no es lo mismo y el usuario lo nota.
 */
export async function precioDeReferencia({ sector, city, followers, engagement } = {}) {
  const tramo = followers ? tramoDe(followers) : null

  const base = {
    where: { status: { in: ESTADOS_VALIDOS }, fee: { gt: 0 } },
  }

  const deals = await prisma.deal.findMany({
    ...base,
    select: {
      fee: true,
      createdAt: true,
      brand: { select: { sector: true, city: true } },
      creator: { select: { totalFollowers: true, city: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  })

  const enTramo = (d) =>
    !tramo ||
    (d.creator?.totalFollowers >= tramo.min && d.creator?.totalFollowers < tramo.max)
  const mismoSector = (d) =>
    !sector || (d.brand?.sector || '').toLowerCase() === String(sector).toLowerCase()
  const mismaCiudad = (d) =>
    !city ||
    (d.brand?.city || '').toLowerCase() === String(city).toLowerCase() ||
    (d.creator?.city || '').toLowerCase() === String(city).toLowerCase()

  const niveles = [
    { nivel: 'sector-ciudad-tramo', filtro: (d) => mismoSector(d) && mismaCiudad(d) && enTramo(d) },
    { nivel: 'sector-tramo', filtro: (d) => mismoSector(d) && enTramo(d) },
    { nivel: 'tramo', filtro: enTramo },
    { nivel: 'general', filtro: () => true },
  ]

  for (const { nivel, filtro } of niveles) {
    const importes = deals.filter(filtro).map((d) => d.fee)
    if (importes.length >= MUESTRA_MINIMA) {
      return {
        origen: 'mercado',
        nivel,
        fiabilidad: importes.length >= MUESTRA_BUENA ? 'alta' : 'orientativa',
        tramo: tramo?.etiqueta || null,
        sector: nivel.startsWith('sector') ? sector : null,
        ciudad: nivel === 'sector-ciudad-tramo' ? city : null,
        ...resumir(importes),
      }
    }
  }

  // Sin historico suficiente: se dice y se da una tarifa orientativa, marcada
  // como lo que es.
  const orientativa = tarifaOrientativa({ followers, engagement })
  return {
    origen: 'estimacion',
    nivel: 'sin-datos',
    fiabilidad: 'baja',
    tramo: tramo?.etiqueta || null,
    muestra: deals.length,
    min: orientativa.min,
    mediana: orientativa.centro,
    max: orientativa.max,
    minimoVisto: null,
    maximoVisto: null,
    nota: 'Todavía no tenemos suficientes colaboraciones cerradas con este perfil. Esto es una estimación a partir del tamaño y el engagement, no un dato de mercado.',
  }
}

/**
 * Frase lista para pintar.
 *
 * La interfaz podria componerla, pero entonces cada pantalla diria una cosa
 * distinta y alguna acabaria presentando una estimacion como si fuera un dato.
 */
export function explicar(ref) {
  if (ref.origen === 'estimacion') {
    return `Estimación orientativa: entre ${ref.min} y ${ref.max} €. ${ref.nota}`
  }
  const donde = {
    'sector-ciudad-tramo': `en tu sector y tu ciudad`,
    'sector-tramo': `en tu sector`,
    tramo: `para perfiles de ${ref.tramo}`,
    general: `en Mikro`,
  }[ref.nivel]
  return `La mitad de las colaboraciones ${donde} se cerraron entre ${ref.min} y ${ref.max} €, con ${ref.mediana} € de mediana. Sobre ${ref.muestra} colaboraciones.`
}

export default { precioDeReferencia, tarifaOrientativa, explicar, tramoDe, TRAMOS, MUESTRA_MINIMA }
