/**
 * Mecanica de la escena de la landing.
 *
 * Toda la animacion se reduce a un numero: el progreso del scroll dentro de la
 * escena, de 0 a 1. A partir de el se derivan los tramos y las posiciones de
 * cada tarjeta. Aqui no hay nada de React a proposito: son funciones puras que
 * el bucle de animacion llama en cada fotograma.
 */

/** Tramos de la escena, en progreso de scroll. */
export const PHASES = {
  heroOut: [0.2, 0.34], // el hero se desvanece
  absorb: [0.28, 0.5], // la orbita se recoge en el ranking
  rankIn: [0.44, 0.57], // el panel del ranking aparece
  flip: [0.7, 0.92], // el panel gira sobre su eje
}

/**
 * Puntos de reposo y zonas muertas.
 *
 * Entre dos secciones no hay nada que mirar: la pieza esta a medio recoger o
 * el panel de canto. Si el usuario suelta el scroll ahi, la escena se lleva
 * sola al estado estable mas cercano en vez de quedarse a medias.
 */
export const RESTS = { hero: 0.06, rank: 0.63, brands: 0.99 }
export const DEAD_ZONES = [
  [0.2, 0.58, RESTS.hero, RESTS.rank],
  [0.71, 0.96, RESTS.rank, RESTS.brands],
]

/** Destino al que llevar la escena, o null si ya esta en reposo. */
export function snapTarget(p) {
  for (const [from, to, before, after] of DEAD_ZONES) {
    if (p > from && p < to) return p < (from + to) / 2 ? before : after
  }
  return null
}

export const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v))

/** Progreso de 0 a 1 dentro de un tramo [a, b]. */
export const between = (p, [a, b]) => clamp((p - a) / (b - a))

/** Suavizado: arranca y para despacio. Evita el efecto de tiron. */
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** Suavizado de salida: util para entradas que deben frenar al final. */
export const easeOut = (t) => 1 - (1 - t) ** 3

export const lerp = (a, b, t) => a + (b - a) * t

/**
 * Posicion de una tarjeta en el cilindro.
 *
 * Las tarjetas se reparten en angulos iguales y se colocan tangentes a un
 * cilindro: rotateY(angulo) + translateZ(radio). La que queda de frente recibe
 * mas escala y opacidad, de modo que la mirada va sola al centro sin tener que
 * oscurecer las demas.
 */
export function orbitSlot(index, total, spinDeg, radius, time = 0) {
  const step = 360 / total
  const angle = (index * step + spinDeg) % 360
  const rad = (angle * Math.PI) / 180

  // Cada tarjeta flota con su propia fase: un carrusel perfectamente rigido se
  // percibe como un mecanismo, no como algo vivo.
  const bob = Math.sin(time * 0.6 + index * 1.7) * 9 + Math.sin(time * 0.37 + index) * 4
  const tilt = Math.sin(time * 0.45 + index * 2.1) * 1.4

  // -1 detras del todo, 1 justo delante.
  const front = Math.cos(rad - Math.PI / 2)
  const depth = Math.sin(rad - Math.PI / 2)

  return {
    x: Math.cos(rad - Math.PI / 2) * 0, // el desplazamiento lo da el propio rotateY
    y: bob,
    tilt,
    z: 0,
    angle,
    radius,
    scale: lerp(0.68, 1, (front + 1) / 2),
    opacity: lerp(0.28, 1, (front + 1) / 2),
    front,
    depth,
  }
}

/**
 * Mezcla la posicion orbital con la de destino.
 *
 * No se interpola entre dos sistemas de coordenadas distintos (daria tirones):
 * ambos estados se resuelven a pixeles respecto al centro del escenario y se
 * interpolan numero a numero.
 *
 * @param slot      posicion en el cilindro
 * @param target    {x, y, w, h} del hueco de destino, relativo al centro
 * @param cardSize  {w, h} de la tarjeta en la orbita
 * @param t         0 = orbita pura, 1 = destino puro
 */
export function blendTransform(slot, target, cardSize, t, delay = 0) {
  // Escalonado: las tarjetas no se recogen todas a la vez, sino uno detras de
  // otra. Es lo que convierte un encogimiento en una succion.
  const staggered = clamp((t - delay) / (1 - delay || 1))
  const eased = easeInOut(staggered)

  // Posicion orbital en pixeles: el cilindro se proyecta a mano para poder
  // mezclarlo con una posicion plana.
  const rad = (slot.angle * Math.PI) / 180
  const orbitX = Math.sin(rad) * slot.radius
  const orbitZ = Math.cos(rad) * slot.radius - slot.radius
  const orbitRotY = slot.angle

  // El radio se encoge mientras se recoge: eso es lo que da la sensacion de
  // absorcion, mas que el propio desplazamiento.
  const shrink = 1 - eased
  const x = lerp(orbitX * shrink, target ? target.x : 0, eased)
  const y = lerp(slot.y, target ? target.y : 0, eased)
  const z = lerp(orbitZ * shrink, 0, eased)
  const rotateY = lerp(orbitRotY, 0, Math.min(1, eased * 1.4))
  const rotateZ = lerp(slot.tilt || 0, 0, eased)

  // Al llegar, la tarjeta mide lo que su hueco. Manda la altura: una fila del
  // ranking es ancha y baja, y escalar por el ancho dejaria la tarjeta enorme.
  const targetScale = target ? clamp(target.h / cardSize.h, 0.08, 1) : 0.12
  // La escala corre por delante de la posicion: asi las tarjetas se encogen
  // mientras viajan y no se amontonan al llegar.
  const scale = lerp(slot.scale, targetScale, easeOut(staggered))

  // Se apaga bastante antes de aterrizar: para cuando el ranking es legible, la
  // tarjeta ya no esta encima tapandolo.
  const fade = staggered > 0.5 ? 1 - between(staggered, [0.5, 0.88]) : 1
  const opacity = lerp(slot.opacity, 1, eased) * fade

  return { x, y, z, rotateY, rotateZ, scale, opacity }
}

/** Convierte un estado en la cadena de transform, en el orden correcto. */
export function toTransform({ x, y, z, rotateY, rotateZ = 0, scale }) {
  return `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateY(${rotateY.toFixed(2)}deg) rotateZ(${rotateZ.toFixed(2)}deg) scale(${scale.toFixed(3)})`
}

/** Tamano de la escena segun el ancho disponible. */
export function sceneMetrics(width) {
  if (width >= 1536) return { radius: 460, card: { w: 236, h: 332 } }
  if (width >= 1280) return { radius: 400, card: { w: 212, h: 300 } }
  return { radius: 330, card: { w: 184, h: 260 } }
}

/** La escena completa solo se sirve cuando hay sitio y el usuario la admite. */
export function prefersStatic() {
  if (typeof window === 'undefined') return true
  const narrow = window.innerWidth < 1024
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return narrow || reduced
}
