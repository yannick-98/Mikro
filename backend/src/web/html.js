/**
 * Un lector de HTML del tamano justo.
 *
 * No hay aqui un arbol DOM ni falta que hace. Lo que el informe necesita son
 * las etiquetas de la cabeza, los enlaces, las imagenes, los scripts y el
 * texto que se lee; nada de eso pide un analizador completo, y meter una
 * dependencia de HTML en el paquete que se despliega como funcion serverless
 * cuesta megas de arranque en frio a cambio de cero precision extra para lo
 * que medimos.
 *
 * Lo que si hace falta es que esto no se equivoque con HTML del mundo real,
 * que viene sin comillas, con atributos repetidos, con mayusculas mezcladas y
 * con comentarios en medio. Cada funcion de este fichero es pura y esta
 * cubierta por `backend/scripts/web-test.js`.
 */

/** Las entidades que de verdad aparecen en una web espanola. */
const ENTIDADES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', laquo: '«', raquo: '»', euro: '€', copy: '©', reg: '®', deg: '°', middot: '·',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
}

export function decodificar(texto = '') {
  return String(texto).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (todo, cuerpo) => {
    if (cuerpo[0] === '#') {
      const codigo = cuerpo[1] === 'x' || cuerpo[1] === 'X'
        ? parseInt(cuerpo.slice(2), 16)
        : parseInt(cuerpo.slice(1), 10)
      return Number.isFinite(codigo) && codigo > 0 && codigo < 0x110000 ? String.fromCodePoint(codigo) : todo
    }
    return ENTIDADES[cuerpo] ?? todo
  })
}

const ATRIBUTO = /([a-zA-Z_:@][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g

/** Los atributos de una etiqueta, en minusculas y ya decodificados. */
export function atributos(cadena = '') {
  const out = {}
  let m
  ATRIBUTO.lastIndex = 0
  while ((m = ATRIBUTO.exec(cadena))) {
    const nombre = m[1].toLowerCase()
    // El primero gana, como en los navegadores.
    if (nombre in out) continue
    const valor = m[2] ?? m[3] ?? m[4]
    out[nombre] = valor === undefined ? '' : decodificar(valor)
  }
  return out
}

/** Quita comentarios (y lo que esconden: scripts comentados, texto viejo). */
export const sinComentarios = (html = '') => String(html).replace(/<!--[\s\S]*?-->/g, ' ')

/** Quita el contenido de las etiquetas que no son texto para el lector. */
export function sinCodigo(html = '') {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, ' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template\s*>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi, ' ')
}

/**
 * Todas las etiquetas con ese nombre.
 *
 * Devuelve los atributos y, para las que cierran, lo que llevan dentro en
 * crudo. `indice` es la posicion en el documento, que usamos para saber si
 * algo esta arriba del todo o enterrado al final.
 */
export function etiquetas(html = '', nombre) {
  const abre = new RegExp(`<${nombre}\\b([^>]*)>`, 'gi')
  const fuente = String(html)
  const out = []
  let m
  while ((m = abre.exec(fuente))) {
    const attrs = atributos(m[1] || '')
    const desde = m.index + m[0].length
    let interior
    if (!/\/\s*$/.test(m[1] || '')) {
      const cierra = new RegExp(`</${nombre}\\s*>`, 'i')
      const resto = fuente.slice(desde)
      const fin = resto.search(cierra)
      interior = fin === -1 ? undefined : resto.slice(0, fin)
    }
    out.push({ attrs, interior, indice: m.index })
  }
  return out
}

/** La primera etiqueta con ese nombre, o null. */
export const etiqueta = (html, nombre) => etiquetas(html, nombre)[0] || null

/** El texto que una persona leeria, sin etiquetas y con los espacios juntos. */
export function textoVisible(html = '') {
  return decodificar(
    sinCodigo(sinComentarios(html))
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

/** La cabeza y el cuerpo, si se distinguen; si no, el documento entero. */
export function cabeza(html = '') {
  const m = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(html)
  if (m) return m[1]
  // Sin </head> explicito: hasta el <body>, que es donde termina de facto.
  const b = /<body\b/i.exec(html)
  return b ? html.slice(0, b.index) : html.slice(0, 8000)
}

export function cuerpo(html = '') {
  const m = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(html)
  if (m) return m[1]
  const b = /<body\b[^>]*>/i.exec(html)
  return b ? html.slice(b.index + b[0].length) : html
}

/** Convierte un href relativo en absoluto; devuelve null si no se puede. */
export function absoluta(href, base) {
  if (!href) return null
  const limpio = String(href).trim()
  if (!limpio || limpio.startsWith('#')) return null
  try {
    return new URL(limpio, base).href
  } catch {
    return null
  }
}

/** Los `<meta>` indexados por name/property/http-equiv. */
export function metas(html = '') {
  const out = {}
  for (const { attrs } of etiquetas(html, 'meta')) {
    const clave = (attrs.name || attrs.property || attrs.itemprop || attrs['http-equiv'] || '').toLowerCase()
    if (!clave) continue
    if (!(clave in out)) out[clave] = attrs.content ?? ''
  }
  return out
}

/** Los `<link>` agrupados por rel (un link puede traer varios rel). */
export function enlacesDeCabeza(html = '', base) {
  const out = []
  for (const { attrs } of etiquetas(html, 'link')) {
    const rels = (attrs.rel || '').toLowerCase().split(/\s+/).filter(Boolean)
    out.push({ rels, href: attrs.href || '', url: absoluta(attrs.href, base), attrs })
  }
  return out
}

/** Los enlaces del documento con su texto. */
export function enlaces(html = '', base) {
  return etiquetas(html, 'a').map(({ attrs, interior, indice }) => ({
    href: attrs.href || '',
    url: absoluta(attrs.href, base),
    texto: textoVisible(interior || '').slice(0, 120),
    rel: (attrs.rel || '').toLowerCase(),
    indice,
    attrs,
  }))
}

/** Los bloques JSON-LD ya interpretados y aplanados. */
export function jsonLd(html = '') {
  const out = []
  for (const { attrs, interior } of etiquetas(html, 'script')) {
    if (!/ld\+json/i.test(attrs.type || '') || !interior) continue
    try {
      const dato = JSON.parse(interior.trim())
      const cola = Array.isArray(dato) ? [...dato] : [dato]
      while (cola.length) {
        const nodo = cola.shift()
        if (!nodo || typeof nodo !== 'object') continue
        if (Array.isArray(nodo['@graph'])) cola.push(...nodo['@graph'])
        if (nodo['@type']) out.push(nodo)
      }
    } catch {
      // Un JSON-LD roto es un dato del informe, no un error: lo apuntamos.
      out.push({ '@type': null, roto: true })
    }
  }
  return out
}

/** ¿Hay algun bloque de datos estructurados de este tipo? */
export const tieneTipo = (bloques, ...tipos) =>
  bloques.some((b) => {
    const t = Array.isArray(b['@type']) ? b['@type'] : [b['@type']]
    return t.some((x) => typeof x === 'string' && tipos.some((y) => x.toLowerCase() === y.toLowerCase()))
  })

/** El dominio registrable, para distinguir lo propio de lo de terceros. */
export function dominio(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    const partes = host.split('.')
    if (partes.length <= 2) return host
    // Dominios de segundo nivel espanoles y britanicos habituales.
    const dobles = ['com', 'co', 'org', 'net', 'gob', 'edu', 'ac']
    if (partes.length >= 3 && dobles.includes(partes[partes.length - 2]) && partes[partes.length - 1].length === 2) {
      return partes.slice(-3).join('.')
    }
    return partes.slice(-2).join('.')
  } catch {
    return null
  }
}

/** ¿Este recurso lo sirve la propia web o un tercero? */
export const esPropio = (url, base) => {
  const a = dominio(url)
  const b = dominio(base)
  return Boolean(a && b && a === b)
}

export default {
  decodificar, atributos, sinComentarios, sinCodigo, etiquetas, etiqueta, textoVisible,
  cabeza, cuerpo, absoluta, metas, enlacesDeCabeza, enlaces, jsonLd, tieneTipo, dominio, esPropio,
}
