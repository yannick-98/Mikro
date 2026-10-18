/**
 * A donde se puede ir a mirar y a donde no.
 *
 * Esta herramienta descarga una direccion que escribe un desconocido desde un
 * formulario publico. Eso es, literalmente, dejar que un extrano haga
 * peticiones HTTP desde dentro de nuestra infraestructura. Sin este fichero,
 * alguien escribe `http://169.254.169.254/latest/meta-data/` y nuestro propio
 * servidor le trae las credenciales de la nube; o `http://localhost:5432` y
 * usa el analizador como escaner de puertos de nuestra red interna.
 *
 * Por eso aqui se valida dos veces y de dos maneras distintas:
 *
 *  1. **La forma**: solo http y https, solo los puertos de siempre, nada de
 *     usuario:clave@ en la URL, nada de nombres sin punto.
 *  2. **El destino de verdad**: se resuelve el DNS y se mira cada IP. Un
 *     dominio publico puede apuntar a 127.0.0.1, y eso es precisamente el
 *     truco. La comprobacion va sobre las IPs, no sobre el nombre.
 *
 * Y se repite en cada redireccion, porque una web puede contestar 302 hacia
 * `http://10.0.0.1/`. Validar solo la primera URL no sirve de nada.
 */
import dns from 'node:dns/promises'
import net from 'node:net'

/** Lo unico que vamos a descargar. */
const ESQUEMAS = new Set(['http:', 'https:'])
const PUERTOS = new Set(['', '80', '443'])

/** Nombres que nunca salen a internet. */
const SUFIJOS_INTERNOS = ['.local', '.internal', '.localhost', '.home', '.lan', '.test', '.invalid']

export class WebInvalida extends Error {
  constructor(mensaje) {
    super(mensaje)
    this.name = 'WebInvalida'
  }
}

/**
 * Acepta lo que escribe una persona y devuelve una URL.
 *
 * Nadie teclea "https://". Pedir la direccion completa es pedirle al usuario
 * que haga el trabajo del programa, asi que "panaderia.es" vale.
 */
export function normalizar(entrada) {
  const limpia = String(entrada || '').trim()
  if (!limpia) throw new WebInvalida('Escribe la dirección de tu web')
  if (limpia.length > 300) throw new WebInvalida('Esa dirección es demasiado larga')

  const conEsquema = /^[a-z][a-z0-9+.-]*:/i.test(limpia) ? limpia : `https://${limpia}`

  let url
  try {
    url = new URL(conEsquema)
  } catch {
    throw new WebInvalida('Eso no parece una dirección de web')
  }

  if (!ESQUEMAS.has(url.protocol)) throw new WebInvalida('Solo podemos mirar direcciones http y https')
  // usuario:clave@host es la forma clasica de disfrazar un destino: lo que
  // lee una persona antes de la arroba no es a donde va la peticion.
  if (url.username || url.password) throw new WebInvalida('Quita el usuario y la contraseña de la dirección')
  if (!PUERTOS.has(url.port)) throw new WebInvalida('Solo podemos mirar los puertos 80 y 443')

  const host = url.hostname.toLowerCase()
  if (!host) throw new WebInvalida('Falta el dominio')
  // Sin punto no hay dominio publico posible: es "localhost", el nombre de
  // una maquina de la red interna o un error de tecleo.
  if (!host.includes('.') && !net.isIP(host)) throw new WebInvalida('Falta el dominio (por ejemplo, tutienda.es)')
  if (SUFIJOS_INTERNOS.some((s) => host.endsWith(s))) throw new WebInvalida('Esa dirección no es pública')

  url.hash = ''
  return url
}

/** Las IPs que no son de internet: si el DNS lleva a una de estas, no vamos. */
export function esPrivada(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true // metadatos de la nube
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 192 && b === 0) return true
    if (a === 198 && (b === 18 || b === 19)) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a >= 224) return true // multicast y reservadas
    return false
  }

  if (net.isIPv6(ip)) {
    const v6 = ip.toLowerCase()
    // Una IPv4 escrita como IPv6 (::ffff:127.0.0.1) es la misma IPv4.
    const mapeada = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapeada) return esPrivada(mapeada[1])
    if (v6 === '::' || v6 === '::1') return true
    if (/^f[cd]/.test(v6)) return true // unicas locales
    if (/^fe[89ab]/.test(v6)) return true // enlace local
    if (/^ff/.test(v6)) return true // multicast
    return false
  }

  return true // si no sabemos que es, no vamos
}

/**
 * Comprueba que el nombre resuelve a internet de verdad.
 *
 * Se exige que **todas** las IPs sean publicas, no que alguna lo sea: un
 * atacante controla su propio DNS y puede devolver dos respuestas.
 */
export async function destinoPublico(host) {
  if (net.isIP(host)) {
    if (esPrivada(host)) throw new WebInvalida('Esa dirección no es pública')
    return [host]
  }

  let direcciones
  try {
    direcciones = await dns.lookup(host, { all: true, verbatim: true })
  } catch {
    throw new WebInvalida(`No existe el dominio ${host}`)
  }

  if (!direcciones.length) throw new WebInvalida(`No existe el dominio ${host}`)
  if (direcciones.some((d) => esPrivada(d.address))) throw new WebInvalida('Esa dirección no es pública')
  return direcciones.map((d) => d.address)
}

/** Las dos comprobaciones juntas: la forma y el destino. */
export async function comprobarDestino(url) {
  const u = url instanceof URL ? url : normalizar(url)
  if (!ESQUEMAS.has(u.protocol)) throw new WebInvalida('Solo podemos mirar direcciones http y https')
  if (!PUERTOS.has(u.port)) throw new WebInvalida('Solo podemos mirar los puertos 80 y 443')
  if (SUFIJOS_INTERNOS.some((s) => u.hostname.toLowerCase().endsWith(s))) {
    throw new WebInvalida('Esa dirección no es pública')
  }
  await destinoPublico(u.hostname)
  return u
}

export default { normalizar, esPrivada, destinoPublico, comprobarDestino, WebInvalida }
