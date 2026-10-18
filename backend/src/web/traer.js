/**
 * Descargar una web ajena sin que nos cueste caro.
 *
 * Tres cosas que, si no se hacen aqui, se pagan en produccion:
 *
 *  - **Un limite de bytes.** Alguien pone la direccion de un ISO de 4 GB y la
 *    funcion se queda sin memoria. Se lee por trozos y se corta.
 *  - **Un limite de tiempo.** Una web que no contesta bloquea la peticion
 *    hasta el tiempo maximo de la funcion serverless (10 s en Netlify) y el
 *    usuario ve un error en blanco. Mejor cortar nosotros y contarlo.
 *  - **Las redirecciones a mano.** Seguirlas automaticamente significa
 *    confiar en el destino; aqui cada salto se valida igual que la primera
 *    URL. Ademas la cadena de redirecciones es, en si misma, un dato del
 *    informe: tres saltos antes de pintar nada son medio segundo regalado.
 *
 * Lo que se mide se mide de verdad: `msCabeceras` es el tiempo hasta la
 * primera respuesta del servidor y `msTotal` hasta el ultimo byte del HTML.
 * No son la metrica de un navegador y el informe lo dice; son el unico trozo
 * de la velocidad que depende solo del servidor de la empresa.
 */
import { WebInvalida, comprobarDestino } from './seguridad.js'

/**
 * Nos presentamos. Un bot que miente sobre quien es no puede quejarse de que
 * lo bloqueen, y la direccion deja a cualquier administrador una forma de
 * saber quienes somos sin escribirnos.
 */
export const AGENTE =
  'Mozilla/5.0 (compatible; MikroBot/1.0; +https://mikro.es/bot) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'

export const LIMITES = {
  bytes: 2_000_000, // 2 MB de HTML es ya una barbaridad; mas, no nos hace falta
  ms: 8000,
  redirecciones: 5,
}

/** Convierte las cabeceras en un objeto plano y en minusculas. */
const aObjeto = (headers) => {
  const out = {}
  headers.forEach((v, k) => {
    out[k.toLowerCase()] = v
  })
  return out
}

/** El juego de caracteres declarado, con el del HTML como segunda opcion. */
function juegoDeCaracteres(contentType, primeros) {
  const enCabecera = /charset=["']?([\w-]+)/i.exec(contentType || '')
  if (enCabecera) return enCabecera[1].toLowerCase()
  const enHtml =
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(primeros) ||
    /<meta[^>]+content=["'][^"']*charset=([\w-]+)/i.exec(primeros)
  return enHtml ? enHtml[1].toLowerCase() : 'utf-8'
}

/** Lee el cuerpo hasta el limite y devuelve los bytes leidos. */
async function leerConTope(respuesta, tope) {
  if (!respuesta.body) return { bytes: new Uint8Array(0), cortado: false }

  const lector = respuesta.body.getReader()
  const trozos = []
  let total = 0
  let cortado = false

  while (total < tope) {
    const { done, value } = await lector.read()
    if (done) break
    trozos.push(value)
    total += value.length
    if (total >= tope) {
      cortado = true
      break
    }
  }
  // Soltamos la conexion sin esperar al resto: ya tenemos lo que nos hacia falta.
  lector.cancel().catch(() => {})

  const bytes = new Uint8Array(total)
  let pos = 0
  for (const t of trozos) {
    bytes.set(t.subarray(0, Math.min(t.length, total - pos)), pos)
    pos += t.length
    if (pos >= total) break
  }
  return { bytes, cortado }
}

/**
 * Trae una direccion. Nunca lanza por un fallo de la web ajena: un servidor
 * caido, un certificado vencido o un tiempo agotado son **resultados** del
 * analisis, no errores del programa. Solo lanza si el destino no se puede
 * tocar (eso si es cosa nuestra y no se negocia).
 */
export async function traer(entrada, { metodo = 'GET', ms = LIMITES.ms, bytes = LIMITES.bytes, agente = AGENTE } = {}) {
  const redirecciones = []
  let url = await comprobarDestino(entrada)
  const empiezaTodo = Date.now()

  for (let salto = 0; salto <= LIMITES.redirecciones; salto += 1) {
    const empieza = Date.now()
    let respuesta
    try {
      respuesta = await fetch(url, {
        method: metodo,
        redirect: 'manual',
        signal: AbortSignal.timeout(ms),
        headers: {
          'User-Agent': agente,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      })
    } catch (e) {
      return {
        ok: false,
        url: url.href,
        redirecciones,
        fallo: clasificarFallo(e),
        msTotal: Date.now() - empiezaTodo,
      }
    }

    const msCabeceras = Date.now() - empieza
    const cabeceras = aObjeto(respuesta.headers)

    // 3xx con destino: se valida el salto y se sigue a mano.
    if (respuesta.status >= 300 && respuesta.status < 400 && cabeceras.location) {
      respuesta.body?.cancel().catch(() => {})
      let siguiente
      try {
        siguiente = new URL(cabeceras.location, url)
        await comprobarDestino(siguiente)
      } catch (e) {
        return {
          ok: false,
          url: url.href,
          redirecciones,
          fallo: {
            tipo: 'redireccion',
            mensaje:
              e instanceof WebInvalida
                ? `Te redirige a un sitio que no podemos mirar (${e.message.toLowerCase()})`
                : 'Te redirige a una dirección que no entendemos',
          },
          msTotal: Date.now() - empiezaTodo,
        }
      }
      redirecciones.push({ de: url.href, a: siguiente.href, estado: respuesta.status })
      url = siguiente
      continue
    }

    if (metodo === 'HEAD' || !respuesta.body) {
      return {
        ok: respuesta.ok,
        estado: respuesta.status,
        url: url.href,
        cabeceras,
        redirecciones,
        texto: '',
        bytes: Number(cabeceras['content-length']) || 0,
        cortado: false,
        msCabeceras,
        msTotal: Date.now() - empiezaTodo,
      }
    }

    const leido = await leerConTope(respuesta, bytes)
    const cabecera8 = new TextDecoder('utf-8').decode(leido.bytes.subarray(0, 2048))
    const juego = juegoDeCaracteres(cabeceras['content-type'], cabecera8)
    let texto
    try {
      texto = new TextDecoder(juego).decode(leido.bytes)
    } catch {
      texto = new TextDecoder('utf-8').decode(leido.bytes)
    }

    return {
      ok: respuesta.ok,
      estado: respuesta.status,
      url: url.href,
      cabeceras,
      redirecciones,
      texto,
      bytes: leido.bytes.length,
      cortado: leido.cortado,
      juego,
      msCabeceras,
      msTotal: Date.now() - empiezaTodo,
    }
  }

  return {
    ok: false,
    url: url.href,
    redirecciones,
    fallo: { tipo: 'bucle', mensaje: 'Tu web encadena demasiadas redirecciones y nunca llega a cargar' },
    msTotal: Date.now() - empiezaTodo,
  }
}

/**
 * Traduce el fallo tecnico a algo que signifique algo para quien lo lee.
 *
 * Un "ERR_TLS_CERT_ALTNAME_INVALID" no le dice nada a la duena de una
 * panaderia; "el certificado esta emitido para otro dominio" si, y ademas es
 * exactamente lo que tiene que contarle a quien le hizo la web.
 */
export function clasificarFallo(e) {
  const codigo = e?.cause?.code || e?.code || ''
  const nombre = e?.name || ''

  if (nombre === 'TimeoutError' || codigo === 'UND_ERR_CONNECT_TIMEOUT' || codigo === 'ETIMEDOUT') {
    return { tipo: 'lenta', mensaje: 'Tu web ha tardado más de 8 segundos en contestar' }
  }
  if (codigo === 'ENOTFOUND' || codigo === 'EAI_AGAIN') {
    return { tipo: 'dns', mensaje: 'Ese dominio no resuelve: nadie puede llegar a tu web' }
  }
  if (codigo === 'ECONNREFUSED' || codigo === 'ECONNRESET') {
    return { tipo: 'caida', mensaje: 'El servidor ha rechazado la conexión' }
  }
  if (codigo === 'CERT_HAS_EXPIRED') {
    return { tipo: 'certificado', mensaje: 'El certificado de seguridad ha caducado: el navegador avisa de web no segura' }
  }
  if (codigo === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    return { tipo: 'certificado', mensaje: 'El certificado está emitido para otro dominio' }
  }
  if (codigo === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || codigo === 'SELF_SIGNED_CERT_IN_CHAIN' || codigo === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
    return { tipo: 'certificado', mensaje: 'El certificado no está firmado por una autoridad reconocida' }
  }
  if (String(codigo).startsWith('ERR_SSL') || String(codigo).includes('CERT')) {
    return { tipo: 'certificado', mensaje: 'Hay un problema con el certificado de seguridad' }
  }
  return { tipo: 'desconocido', mensaje: 'No hemos podido conectar con tu web' }
}

export default { traer, clasificarFallo, LIMITES, AGENTE }
