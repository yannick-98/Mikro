/**
 * Una sola pasada de red, y a partir de ahi todo es aritmetica.
 *
 * Aqui se separan las dos mitades de la herramienta, y es la decision de
 * diseno que sostiene todo lo demas:
 *
 *  - `leer()` es **pura**: recibe un HTML y devuelve la radiografia. Sin red,
 *    sin reloj, sin base de datos. Por eso las 46 comprobaciones se pueden
 *    probar con un HTML escrito a mano en `backend/scripts/web-test.js`, que
 *    corre en medio segundo y no depende de que la web de nadie siga viva.
 *  - `recoger()` es la parte sucia: pide la pagina y, como mucho, cinco
 *    cosas mas. Ni una peticion de regalo. Cada una esta aqui porque hay una
 *    comprobacion que sin ella tendria que decir "no lo sabemos", y decir
 *    "no lo sabemos" cuesta mas que una peticion de 200 ms.
 *
 * Las peticiones extra van en paralelo y todas pueden fallar sin tumbar el
 * informe: lo que no se pudo mirar se marca y se cuenta aparte.
 */
import {
  absoluta, cabeza, cuerpo, enlaces as leerEnlaces, enlacesDeCabeza, esPropio,
  etiquetas, jsonLd, metas, textoVisible, dominio,
} from './html.js'
import { reconocer } from './huellas.js'
import { AGENTES_PREVIA, queNosHanDado } from './muro.js'
import { normalizar } from './seguridad.js'
import { traer } from './traer.js'

/** Los parametros con los que un creador va a traer visitas. */
export const SONDA_UTM = 'utm_source=mikro&utm_medium=creador&utm_campaign=prueba'

/**
 * Convierte un HTML en la radiografia sobre la que trabajan las
 * comprobaciones. Funcion pura: el mismo HTML da siempre el mismo resultado.
 */
export function leer({
  entrada,
  url,
  html = '',
  cabeceras = {},
  estado = 200,
  bytes = 0,
  cortado = false,
  redirecciones = [],
  ms = {},
  extras = {},
} = {}) {
  const base = url || entrada || 'https://example.com/'
  const head = cabeza(html)
  const body = cuerpo(html)
  const texto = textoVisible(body)
  const finDeCabeza = (() => {
    const m = /<body\b/i.exec(html)
    return m ? m.index : head.length
  })()

  const scripts = etiquetas(html, 'script').map(({ attrs, interior, indice }) => ({
    src: attrs.src || null,
    url: absoluta(attrs.src, base),
    async: 'async' in attrs,
    defer: 'defer' in attrs,
    modulo: (attrs.type || '').toLowerCase() === 'module',
    tipo: attrs.type || '',
    enCabeza: indice < finDeCabeza,
    propio: attrs.src ? esPropio(absoluta(attrs.src, base), base) : true,
    linea: interior ? interior.length : 0,
  }))

  const hojas = enlacesDeCabeza(html, base)
    .filter((l) => l.rels.includes('stylesheet'))
    .map((l) => ({
      url: l.url,
      media: (l.attrs.media || '').toLowerCase(),
      propio: esPropio(l.url, base),
      // Una hoja marcada como "print" o cargada con media falso no bloquea.
      bloquea: !l.attrs.media || /all|screen/i.test(l.attrs.media),
    }))

  const imagenes = etiquetas(body, 'img').map(({ attrs, indice }) => ({
    src: attrs.src || attrs['data-src'] || null,
    url: absoluta(attrs.src || attrs['data-src'], base),
    alt: attrs.alt,
    tieneAlt: 'alt' in attrs,
    ancho: attrs.width || null,
    alto: attrs.height || null,
    carga: (attrs.loading || '').toLowerCase(),
    srcset: attrs.srcset || attrs['data-srcset'] || null,
    indice,
  }))

  const formularios = etiquetas(body, 'form').map(({ attrs, interior = '' }) => {
    const campos = etiquetas(interior, 'input').map((i) => ({
      tipo: (i.attrs.type || 'text').toLowerCase(),
      nombre: (i.attrs.name || '').toLowerCase(),
    }))
    return {
      action: attrs.action || '',
      url: absoluta(attrs.action, base),
      metodo: (attrs.method || 'get').toLowerCase(),
      campos,
      areas: etiquetas(interior, 'textarea').length,
      texto: textoVisible(interior).slice(0, 300),
    }
  })

  const tituloEt = etiquetas(head, 'title')[0]
  const bloques = jsonLd(html)
  const huellas = reconocer(html, cabeceras)
  const estilos = etiquetas(html, 'style').map((s) => s.interior || '').join('\n')
  const palabras = texto ? texto.split(/\s+/).filter((p) => p.length > 1).length : 0

  // Una web que se monta en el navegador deja el cuerpo practicamente vacio y
  // un div donde engancharse. Saberlo cambia como hay que leer el informe
  // entero, asi que se detecta y se avisa en lugar de dar por bueno un
  // "no tienes textos" que en realidad significa "no podemos verlos".
  //
  // El listón es alto a proposito. Dar esto por bueno a la ligera convierte
  // comprobaciones que si podiamos hacer en "no comprobado", y entonces el
  // informe deja de senalar fallos reales de una web pequena que
  // simplemente tiene poco texto y dos scripts. Hace falta el punto de
  // anclaje de un armazon conocido, o un cuerpo literalmente vacio.
  const anclaje = /<div[^>]+(id=["'](root|app|__next|__nuxt|q-app|ember-app)["']|data-reactroot|ng-app)/i.test(html)
  const elementos = (body.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1\s*>/gi, '').match(/<[a-z][a-z0-9]*\b/gi) || []).length
  const renderizadoEnCliente = palabras < 120 && (anclaje || (palabras < 15 && elementos <= 3))

  return {
    entrada: entrada || base,
    url: base,
    dominio: dominio(base),
    seguro: base.startsWith('https://'),
    estado,
    cabeceras,
    redirecciones,
    bytes,
    cortado,
    ms: { cabeceras: ms.cabeceras ?? null, total: ms.total ?? null },

    html,
    head,
    body,
    texto,
    palabras,
    renderizadoEnCliente,

    titulo: tituloEt ? textoVisible(tituloEt.interior || '') : null,
    metas: metas(head),
    enlacesCabeza: enlacesDeCabeza(head, base),
    enlaces: leerEnlaces(body, base),
    h1: etiquetas(body, 'h1').map((h) => textoVisible(h.interior || '')).filter(Boolean),
    h2: etiquetas(body, 'h2').map((h) => textoVisible(h.interior || '')).filter(Boolean),
    scripts,
    hojas,
    imagenes,
    formularios,
    iframes: etiquetas(body, 'iframe').map((f) => ({ url: absoluta(f.attrs.src, base), attrs: f.attrs })),
    estilos,
    jsonLd: bloques,
    huellas,

    extras,
  }
}

/** Pide algo y devuelve el resultado o null; nunca lanza. */
const intento = async (url, opciones) => {
  try {
    return await traer(url, opciones)
  } catch {
    return null
  }
}

/**
 * Descarga la web y lo poco mas que hace falta.
 *
 * Devuelve `{ pagina }` o `{ fallo }`. Un fallo aqui no es una excepcion: es
 * el primer dato del informe, y seguramente el mas importante que esa empresa
 * va a leer hoy.
 */
/** Lo que pide esperar una web que contesta 429, si lo dice en segundos. */
const esperaPedida = (respuesta) => {
  if (respuesta?.estado !== 429 && respuesta?.estado !== 503) return null
  const c = String(respuesta.cabeceras?.['retry-after'] || '').trim()
  return /^\d+$/.test(c) ? Number(c) : null
}

export async function recoger(entrada) {
  const url = normalizar(entrada)
  let principal = await traer(url)

  // Si la web pide esperar poco, se espera y se vuelve a intentar una vez.
  // Un «vuelve en dos segundos» no merece devolverle a nadie un informe
  // vacio; tres segundos es lo maximo que cabe en el presupuesto de tiempo
  // de la funcion, y mas de un reintento ya seria insistir donde nos han
  // dicho que no.
  const espera = esperaPedida(principal)
  if (espera !== null && espera <= 3) {
    await new Promise((listo) => setTimeout(listo, espera * 1000 + 250))
    principal = await traer(url)
  }

  if (principal.fallo) {
    return { fallo: principal.fallo, url: url.href, redirecciones: principal.redirecciones }
  }

  // Antes de juzgar nada: comprobar que lo que nos han dado es la web y no
  // otra cosa en su lugar (el muro de un antibots, un dominio aparcado, una
  // pagina de «en construccion»). Va primero incluso que el estado, porque
  // esos sustitutos contestan 200 tan tranquilos y, en todos los casos, lo
  // unico cierto es que no hemos visto la web.
  const asomada = leer({ entrada: url.href, url: principal.url, html: principal.texto, cabeceras: principal.cabeceras })
  const muro = queNosHanDado({
    html: principal.texto,
    cabeceras: principal.cabeceras,
    estado: principal.estado,
    pagina: asomada,
  })
  if (muro) {
    // No tenemos informe, pero todavia podemos averiguar lo que mas le
    // importa a quien va a trabajar con creadores: si lo que nos rechaza a
    // nosotros rechaza tambien al robot que dibuja la tarjeta del enlace.
    const previsualizadores = await Promise.all(
      AGENTES_PREVIA.map(async (a) => {
        const r = await intento(principal.url, { metodo: 'GET', agente: a.agente, ms: 5000, bytes: 50_000 })
        return { id: a.id, nombre: a.nombre, ok: Boolean(r && !r.fallo && r.ok), estado: r?.estado ?? null }
      }),
    )
    return { muro, url: principal.url, redirecciones: principal.redirecciones, previsualizadores }
  }

  if (!principal.ok) {
    return {
      fallo: {
        tipo: 'estado',
        mensaje:
          principal.estado === 404
            ? 'Esa dirección devuelve un 404: la página no existe'
            : principal.estado === 403
              ? 'El servidor nos ha denegado el acceso (403). Puede que bloquee a los robots'
              : `Tu web contesta con un error ${principal.estado}`,
      },
      url: principal.url,
      estado: principal.estado,
      redirecciones: principal.redirecciones,
    }
  }

  const final = new URL(principal.url)
  const origen = final.origin
  const previa = asomada

  // La primera hoja de estilo propia: es donde se mira si la web es
  // adaptable de verdad. Una sola, la primera: es la que lleva el armazon.
  const hojaPrincipal = previa.hojas.find((h) => h.propio && h.url && h.bloquea) || null
  const ogImagen = previa.metas['og:image'] ? absoluta(previa.metas['og:image'], principal.url) : null

  const [robots, sitemap, css, utm, http, imagen] = await Promise.all([
    intento(`${origen}/robots.txt`, { ms: 4000, bytes: 100_000 }),
    intento(`${origen}/sitemap.xml`, { metodo: 'HEAD', ms: 4000 }),
    hojaPrincipal ? intento(hojaPrincipal.url, { ms: 5000, bytes: 500_000 }) : null,
    // La prueba que no hace nadie: ¿sobrevive tu web a los parametros con los
    // que llega el trafico de una campana?
    intento(`${principal.url}${principal.url.includes('?') ? '&' : '?'}${SONDA_UTM}`, { ms: 6000, bytes: 300_000 }),
    final.protocol === 'https:' ? intento(`http://${final.host}/`, { ms: 4000, bytes: 10_000 }) : null,
    ogImagen ? intento(ogImagen, { metodo: 'HEAD', ms: 4000 }) : null,
  ])

  return {
    pagina: leer({
      entrada: url.href,
      url: principal.url,
      html: principal.texto,
      cabeceras: principal.cabeceras,
      estado: principal.estado,
      bytes: principal.bytes,
      cortado: principal.cortado,
      redirecciones: principal.redirecciones,
      ms: { cabeceras: principal.msCabeceras, total: principal.msTotal },
      extras: {
        robots: robots && !robots.fallo ? { ok: robots.ok, estado: robots.estado, texto: robots.texto } : null,
        sitemap: sitemap && !sitemap.fallo ? { ok: sitemap.ok, estado: sitemap.estado } : null,
        css: css && !css.fallo ? { ok: css.ok, texto: css.texto, bytes: css.bytes, url: hojaPrincipal?.url } : null,
        utm:
          utm && !utm.fallo
            ? {
                ok: utm.ok,
                estado: utm.estado,
                // Si acaba en una URL sin los parametros, alguien los esta
                // tirando por el camino y la atribucion se pierde entera.
                conserva: utm.url.includes('utm_source=mikro'),
                destino: utm.url,
                saltos: utm.redirecciones.length,
              }
            : null,
        http: http && !http.fallo ? { ok: http.ok, estado: http.estado, destino: http.url, saltos: http.redirecciones } : null,
        ogImagen:
          imagen && !imagen.fallo
            ? { ok: imagen.ok, estado: imagen.estado, tipo: imagen.cabeceras?.['content-type'] || null, bytes: imagen.bytes, url: ogImagen }
            : ogImagen
              ? { ok: false, url: ogImagen }
              : null,
      },
    }),
  }
}

export default { recoger, leer, SONDA_UTM }
