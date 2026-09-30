/**
 * Imagenes del MVP.
 *
 * Los avatares generados son SVG en data-URI: no dependen de red ni de un
 * servicio externo, asi que la app se ve igual sin conexion. Para las semillas
 * usamos ademas fotos remotas; el frontend cae al avatar generado si fallan.
 */

const PALETTES = [
  ['#2563eb', '#1e3a8a'],
  ['#0ea5e9', '#0369a1'],
  ['#8b5cf6', '#5b21b6'],
  ['#ec4899', '#9d174d'],
  ['#f59e0b', '#b45309'],
  ['#10b981', '#065f46'],
  ['#ef4444', '#991b1b'],
  ['#14b8a6', '#115e59'],
]

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
}

/** Avatar SVG determinista a partir del nombre. */
export function avatarFor(name = 'Mikro') {
  const [from, to] = PALETTES[hashString(name) % PALETTES.length]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient></defs><rect width="240" height="240" fill="url(#g)"/><text x="50%" y="52%" dy=".35em" text-anchor="middle" font-family="Inter,Segoe UI,sans-serif" font-size="96" font-weight="700" fill="#ffffff" fill-opacity="0.92">${initials(name)}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** Foto de perfil remota reproducible (con fallback en el cliente). */
export function photoFor(seed, size = 400) {
  return `https://i.pravatar.cc/${size}?u=${encodeURIComponent(seed)}`
}

/** Imagen de contenido reproducible para el portfolio. */
export function contentImage(seed, w = 400, h = 400) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`
}

export default { avatarFor, photoFor, contentImage }
