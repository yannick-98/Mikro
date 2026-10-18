/**
 * Cuando lo que nos contestan no es la web.
 *
 * Esto aparecio probando contra webs reales, y dos veces seguidas:
 *
 *  - una tienda grande devolvio un 200 de siete kilobytes, sin titulo, con
 *    `noindex` y un script: era el muro de un antibots;
 *  - otra direccion conocida devolvio una pagina de «this domain is for
 *    sale»: el dominio estaba aparcado y nadie se habia enterado.
 *
 * En los dos casos el analizador midio tan contento y emitio un informe
 * demoledor sobre una pagina que no era la web de nadie. Ese informe es peor
 * que no dar ninguno: es falso y encima suena creible.
 *
 * La regla, que es la de todo el informe: **si no lo hemos visto, no lo
 * juzgamos**. Se dice que no hemos visto la web, se dice que habia en su
 * lugar, y ya esta. Nota, ninguna.
 *
 * Y el reves importa igual: media internet esta detras de Cloudflare y sirve
 * su web perfectamente. Por eso nunca basta con la huella del sistema: hace
 * falta ademas que lo que ha llegado no tenga pinta de web.
 */

/** Sistemas que ponen una pagina de verificacion delante. */
const MUROS = [
  { id: 'cloudflare', nombre: 'Cloudflare', patron: /just a moment|cf_chl_|__cf_chl|challenge-platform|cf-browser-verification|attention required.{0,30}cloudflare/i },
  { id: 'datadome', nombre: 'DataDome', patron: /datadome|dd_cookie|geo\.captcha-delivery\.com/i },
  { id: 'akamai', nombre: 'Akamai', patron: /_abck|ak_bmsc|akamai.{0,20}(bot|protect)|reference\s*#\d+\.\w+/i },
  { id: 'perimeterx', nombre: 'PerimeterX / HUMAN', patron: /perimeterx|_px[A-Za-z]*\d|press\s*&?\s*hold/i },
  { id: 'imperva', nombre: 'Imperva Incapsula', patron: /_incapsula_resource|incap_ses|imperva/i },
  { id: 'sucuri', nombre: 'Sucuri', patron: /sucuri|cloudproxy/i },
  { id: 'awswaf', nombre: 'AWS WAF', patron: /awswaf|aws-waf-token/i },
  { id: 'captcha', nombre: 'un captcha', patron: /recaptcha\/api\.js|hcaptcha\.com|turnstile/i },
]

/** Lo que dicen esas paginas y no dice ninguna web de una empresa. */
const FRASES = /checking your browser|verifying you are human|enable javascript and cookies|acceso denegado|access denied|request blocked|unusual traffic|comprueba que eres humano/i

/** Paginas que ocupan el sitio de una web sin serlo. */
const SUSTITUTAS = [
  {
    clase: 'aparcado',
    nombre: 'una página de dominio en venta',
    patron: /domain is for sale|buy this domain|dominio (está )?en venta|este dominio se vende|sedoparking|bodis\.com|afternic|dan\.com|parkingcrew|domain parking/i,
  },
  {
    clase: 'construccion',
    nombre: 'una página de «en construcción»',
    patron: /en construcci[oó]n|under construction|coming soon|pr[oó]ximamente|volveremos pronto|sitio web en preparaci[oó]n|maintenance mode|estamos de obras/i,
  },
  {
    clase: 'defecto',
    nombre: 'la página por defecto del servidor',
    patron: /welcome to nginx|apache2? (ubuntu |debian )?default page|iis windows server|it works!|index of \/|future home of something|default web site page/i,
  },
]

/** Lo poco que hay aqui no parece la web de una empresa. */
const pareceVacia = (pagina, html) =>
  pagina.palabras < 150 &&
  pagina.enlaces.length <= 3 &&
  (!pagina.titulo || html.length < 40_000) &&
  html.length < 60_000

/** ¿Nos ha parado un sistema de proteccion? */
export function detectarMuro({ html = '', cabeceras = {}, estado = 200, pagina }) {
  const texto = `${html}\n${Object.entries(cabeceras).map(([k, v]) => `${k}: ${v}`).join('\n')}`
  const huella = MUROS.find((m) => m.patron.test(texto))
  const frase = FRASES.test(html)
  const sospechosa = pareceVacia(pagina, html)
  const bloqueada = estado === 403 || estado === 429 || estado === 503

  if (huella && (sospechosa || frase || bloqueada)) {
    return { clase: 'bloqueo', tipo: huella.id, nombre: huella.nombre, estado }
  }
  if ((frase || bloqueada) && sospechosa) {
    return { clase: 'bloqueo', tipo: 'desconocido', nombre: 'un sistema de protección', estado }
  }
  return null
}

/** ¿Lo que hay en esa direccion es un sustituto de web? */
export function detectarSustituta({ html = '', estado = 200, pagina }) {
  if (!pareceVacia(pagina, html)) return null
  const visible = `${pagina.titulo || ''} ${pagina.texto}`
  const encontrada = SUSTITUTAS.find((s) => s.patron.test(visible) || s.patron.test(html))
  return encontrada ? { clase: encontrada.clase, tipo: encontrada.clase, nombre: encontrada.nombre, estado } : null
}

/** Las dos preguntas de una vez: lo que hemos descargado, ¿es su web? */
export const queNosHanDado = (datos) => detectarMuro(datos) || detectarSustituta(datos)

/** Lo que se le cuenta a quien esperaba un informe y no lo va a tener. */
const TEXTOS = {
  bloqueo: (m) => ({
    titular: `No hemos podido ver tu web: ${m.nombre} nos ha parado antes.`,
    texto:
      'Tu web está detrás de un sistema antibots y lo que nos ha contestado es su página de verificación, no la tuya. No vamos a puntuar lo que no hemos visto. ' +
      'Merece la pena que lo compruebes igualmente: lo que nos bloquea a nosotros bloquea también a muchas herramientas de análisis y, mal configurado, a veces al propio Google. ' +
      'En Search Console, «Inspección de URLs» te dice en un minuto si a Google le pasa lo mismo.',
    arreglo: 'Pide a quien lleve la web que permita el paso al agente «MikroBot», o vuelve a intentarlo desde otra conexión.',
  }),
  aparcado: () => ({
    titular: 'En esa dirección no hay una web: hay una página de dominio en venta.',
    texto:
      'El dominio existe, pero quien lo tiene lo está vendiendo o lo tiene aparcado en un servicio de parking. Quien escriba tu dirección, o pulse un enlace tuyo antiguo, verá eso. ' +
      'Si es tu dominio, es lo primero que hay que resolver hoy: no hay campaña que arregle una dirección que no lleva a ninguna parte.',
    arreglo: 'Comprueba en tu proveedor si el dominio sigue siendo tuyo y a dónde apunta. Si lo has perdido por una renovación, hay un plazo de recuperación.',
  }),
  construccion: () => ({
    titular: 'En esa dirección hay una página de «en construcción».',
    texto:
      'No hay nada que analizar todavía: lo que se sirve es un aviso de que la web está por llegar. Es lo que ve ahora mismo cualquiera que busque tu nombre.',
    arreglo: 'Mientras la web se termina, deja al menos una página con qué haces, dónde estás, un teléfono pulsable y un enlace a tus redes. Una tarde de trabajo que ya vende.',
  }),
  defecto: () => ({
    titular: 'En esa dirección contesta el servidor, pero no hay web.',
    texto:
      'Lo que sale es la página por defecto del servidor, la que viene de fábrica. O el dominio apunta a un sitio equivocado, o la web nunca llegó a subirse ahí.',
    arreglo: 'Revisa a dónde apunta el dominio y si los archivos de la web están en esa carpeta. Suele ser un DNS que quedó a medias.',
  }),
}

/**
 * El informe cuando no hemos visto la web.
 *
 * No lleva nota. Poner un numero aqui seria calificar la pagina de otro.
 */
export function informeSinWeb({ url, muro, redirecciones = [] }) {
  const { titular, texto, arreglo } = (TEXTOS[muro.clase] || TEXTOS.bloqueo)(muro)
  return {
    analizadaEl: new Date().toISOString(),
    ficha: { url, estado: muro.estado ?? null, saltos: redirecciones.length, plataforma: muro.nombre },
    nota: { total: null, letra: null, veredicto: null },
    muro,
    campana: { semaforo: muro.clase === 'bloqueo' ? 'reparos' : 'no', titular, texto, bloqueos: [] },
    prioridades: [],
    bienHecho: [],
    areas: [],
    sinMirar: [],
    advertencias: [`Lo que hemos descargado es ${muro.nombre}, no tu web.`, arreglo],
    resumen: { fallos: 0, avisos: 0, correctas: 0, sinMirar: 0 },
  }
}

export default { detectarMuro, detectarSustituta, queNosHanDado, informeSinWeb }
