/**
 * El enlace que el creador pone en su bio.
 *
 * El codigo sigue siendo la fuente de verdad de la atribucion. Este enlace es
 * su apoyo, y hace dos cosas que un codigo dicho en voz alta no puede:
 *
 *  - lo aplica solo. La ruta /discount/CODIGO de Shopify mete el descuento en
 *    la sesion y lleva al seguidor donde digamos, asi que no hay que confiar
 *    en que lo teclee bien al pagar. El pedido llega con su discount_codes
 *    igualmente, de modo que la medicion no cambia: mejora la conversion sin
 *    debilitar la atribucion.
 *  - trae utm_*, que es lo unico que entiende la analitica de la propia
 *    tienda. Asi la empresa ve el trafico del creador en su Shopify, no solo
 *    en el panel de Mikro.
 *
 * Lo que este modulo no hace, a proposito: redirigir fuera de la tienda. El
 * destino se valida contra los dominios de la tienda y lo que se guarda es una
 * ruta. Aceptar cualquier URL convertiria nuestro enlace en un salto comodo
 * para una pagina de phishing con la credibilidad del creador detras.
 */

/** Trozo de texto apto para un utm_: minusculas, guiones y nada mas. */
export function slug(value, max = 40) {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max)
    .replace(/-$/, '')
}

/**
 * Convierte lo que la tienda haya escrito en una ruta de su propia tienda.
 *
 * Admite una ruta suelta o una URL completa de cualquiera de sus dominios (el
 * de myshopify y el publico). Devuelve null si no hay destino, y lanza si el
 * destino es de otro sitio.
 */
export function toStorePath(value, hosts = []) {
  const bruto = (value || '').trim()
  if (!bruto) return null

  const permitidos = hosts.filter(Boolean).map((h) => h.toLowerCase().replace(/^www\./, ''))

  let url
  if (/^https?:\/\//i.test(bruto)) {
    try {
      url = new URL(bruto)
    } catch {
      throw new Error('Ese enlace no es una direccion valida')
    }
    const host = url.host.toLowerCase().replace(/^www\./, '')
    if (!permitidos.includes(host)) {
      throw new Error('El enlace tiene que apuntar a una pagina de tu propia tienda')
    }
  } else if (bruto.startsWith('//')) {
    // "//otrositio.com/x" es una URL con el esquema heredado, no una ruta.
    throw new Error('El enlace tiene que apuntar a una pagina de tu propia tienda')
  } else {
    url = new URL(bruto.startsWith('/') ? bruto : `/${bruto}`, 'https://tienda.invalid')
  }

  const ruta = `${url.pathname}${url.search}`
  return ruta === '/' ? null : ruta.slice(0, 300)
}

/**
 * El enlace listo para compartir.
 *
 * Sin host no hay enlace: antes de que la tienda abra la app no sabemos su
 * dominio, y preferimos no ensenar ninguno que ensenar uno inventado.
 */
export function shareLink({ host, code, campaignTitle, creatorHandle, landingPath }) {
  if (!host || !code) return null

  // Los utm_ van DENTRO del redirect, no al final del enlace.
  //
  // Shopify los acepta en los dos sitios, pero el salto de /discount a la
  // tienda no siempre arrastra los parametros de arriba, y la analitica de la
  // tienda lee la direccion de la pagina en la que aterriza el visitante. Si
  // viajan dentro del destino, el navegador acaba en una URL que los lleva
  // escritos y no hay nada que confiar.
  const destino = new URL(landingPath || '/', 'https://tienda.invalid')
  destino.searchParams.set('utm_source', 'mikro')
  destino.searchParams.set('utm_medium', 'influencer')
  const campana = slug(campaignTitle)
  if (campana) destino.searchParams.set('utm_campaign', campana)
  destino.searchParams.set('utm_content', slug(creatorHandle) || code.toLowerCase())

  // redirect siempre, aunque el destino sea la portada: asi el enlace tiene
  // una sola forma y los utm_ viajan igual en los dos casos.
  const url = new URL(`https://${host}/discount/${encodeURIComponent(code)}`)
  url.searchParams.set('redirect', `${destino.pathname}${destino.search}`)
  return url.toString()
}

export default { shareLink, toStorePath, slug }
