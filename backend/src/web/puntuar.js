/**
 * Convertir 46 comprobaciones en un numero sin mentir por el camino.
 *
 * Toda nota sobre cien es una simplificacion, asi que lo unico que se le
 * puede exigir es que la simplificacion sea defendible y que se pueda
 * reconstruir mirando el informe. Las tres reglas:
 *
 *  1. **Lo que no se ha podido mirar no puntua.** Ni a favor ni en contra:
 *     sale del denominador. Un analizador que te quita puntos por algo que no
 *     ha sabido medir esta inventando una nota, no midiendola.
 *  2. **Un aviso vale la mitad.** No es lo mismo no tener WhatsApp que no
 *     tener HTTPS, y tampoco es lo mismo "mejorable" que "roto".
 *  3. **La nota global pondera las areas, no las comprobaciones.** Si no, el
 *     area con mas comprobaciones mandaria sobre las demas sin que nadie lo
 *     haya decidido. Los pesos de area estan escritos en cada fichero y suman
 *     100.
 *
 * El orden de las prioridades no es el de la nota: es `peso x peso del area`,
 * que es lo que de verdad se gana arreglando una cosa concreta. Por eso lo
 * primero de la lista casi nunca es lo del area peor puntuada.
 */
import { pasar } from './comprobacion.js'
import campanas from './areas/campanas.js'
import confianza from './areas/confianza.js'
import conversion from './areas/conversion.js'
import encontrar from './areas/encontrar.js'
import movil from './areas/movil.js'
import velocidad from './areas/velocidad.js'

/** El orden es el del informe: de lo que mas decide a lo que menos. */
export const AREAS = [conversion, confianza, velocidad, movil, campanas, encontrar]

/** Lo que suma cada estado. */
const VALOR = { ok: 1, aviso: 0.5, fallo: 0 }
const PUNTUA = (c) => c.estado in VALOR

export const LETRAS = [
  { desde: 88, letra: 'A', veredicto: 'Tu web está lista. Lo que queda son detalles.' },
  { desde: 74, letra: 'B', veredicto: 'Tu web funciona, pero deja dinero por el camino.' },
  { desde: 58, letra: 'C', veredicto: 'Tu web se sostiene y poco más: hay fallos que te están costando clientes.' },
  { desde: 40, letra: 'D', veredicto: 'Tu web tiene problemas serios. Traerle visitas ahora sería tirar el dinero.' },
  { desde: 0, letra: 'E', veredicto: 'Tu web no está en condiciones de recibir a nadie todavía.' },
]

export const letraDe = (nota) => LETRAS.find((l) => nota >= l.desde) || LETRAS.at(-1)

/** La nota de un conjunto de comprobaciones, o null si no se pudo medir nada. */
export function notaDe(comprobaciones) {
  const cuentan = comprobaciones.filter(PUNTUA)
  const posible = cuentan.reduce((s, c) => s + c.peso, 0)
  if (!posible) return null
  const logrado = cuentan.reduce((s, c) => s + c.peso * VALOR[c.estado], 0)
  return Math.round((logrado / posible) * 100)
}

/**
 * Pasa todas las areas y devuelve la nota con su desglose.
 *
 * La global se reparte solo entre las areas que han podido puntuar: si una
 * web no tiene formularios ni tienda y media area se queda sin medir, el peso
 * de esa area se reparte entre las demas en lugar de hundir la nota.
 */
export function puntuar(pagina) {
  const areas = AREAS.map((area) => {
    const comprobaciones = pasar(area, pagina)
    const nota = notaDe(comprobaciones)
    return {
      id: area.id,
      nombre: area.nombre,
      descripcion: area.descripcion,
      peso: area.peso,
      nota,
      comprobaciones,
      fallos: comprobaciones.filter((c) => c.estado === 'fallo').length,
      avisos: comprobaciones.filter((c) => c.estado === 'aviso').length,
      correctas: comprobaciones.filter((c) => c.estado === 'ok').length,
      sinMirar: comprobaciones.filter((c) => c.estado === 'no-comprobado' || c.estado === 'no-aplica').length,
    }
  })

  const medidas = areas.filter((a) => a.nota !== null)
  const pesoTotal = medidas.reduce((s, a) => s + a.peso, 0)
  const total = pesoTotal ? Math.round(medidas.reduce((s, a) => s + a.nota * a.peso, 0) / pesoTotal) : null
  const { letra, veredicto } = total === null ? { letra: null, veredicto: null } : letraDe(total)

  return { total, letra, veredicto, areas }
}

/**
 * Lo primero que habria que arreglar.
 *
 * `impacto` es lo que esa comprobacion vale sobre la nota global: su peso
 * dentro del area, por el peso del area, por lo que falta para tenerla bien.
 * Asi un fallo de peso 3 en «Si convierte» (22) adelanta a un fallo de peso 5
 * en «Que te encuentren» (12), que es exactamente el orden en el que le
 * conviene gastar la tarde a quien lee esto.
 */
export function prioridades(areas, { cuantas = 8 } = {}) {
  const lista = []
  for (const area of areas) {
    const posible = area.comprobaciones.filter((c) => c.estado === 'ok' || c.estado === 'aviso' || c.estado === 'fallo').reduce((s, c) => s + c.peso, 0) || 1
    for (const c of area.comprobaciones) {
      if (c.estado !== 'fallo' && c.estado !== 'aviso') continue
      const margen = c.estado === 'fallo' ? 1 : 0.5
      lista.push({
        ...c,
        area: area.id,
        areaNombre: area.nombre,
        // Puntos de la nota global que se recuperan arreglando esto.
        impacto: Math.round(((c.peso * margen) / posible) * area.peso * 10) / 10,
      })
    }
  }
  return lista
    .sort((a, b) => b.impacto - a.impacto || (a.estado === 'fallo' ? -1 : 1) - (b.estado === 'fallo' ? -1 : 1))
    .slice(0, cuantas)
}

/** Lo que ya esta bien y conviene no tocar; tambien es informacion. */
export function bienHecho(areas, { cuantas = 6 } = {}) {
  return areas
    .flatMap((a) => a.comprobaciones.filter((c) => c.estado === 'ok').map((c) => ({ ...c, areaNombre: a.nombre })))
    .sort((a, b) => b.peso - a.peso)
    .slice(0, cuantas)
}

export default { puntuar, prioridades, bienHecho, notaDe, letraDe, AREAS, LETRAS }
