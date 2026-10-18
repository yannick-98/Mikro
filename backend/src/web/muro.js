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
  // Para decir «hay un antibots» hace falta la huella o la frase. Un codigo
  // de error a secas no lo demuestra: un 429 es casi siempre una web
  // ocupada, y un 403 puede ser una carpeta mal configurada. Antes bastaba
  // el codigo, y el resultado fue acusar de tener un muro a una tienda que
  // solo estaba pidiendo que esperaramos un minuto.
  if (frase && sospechosa) {
    return { clase: 'bloqueo', tipo: 'desconocido', nombre: 'un sistema de protección', estado }
  }
  return null
}

/**
 * ¿Nos esta pidiendo que volvamos luego?
 *
 * Un 429 (o un 503 con `Retry-After`) no es un fallo de la web ni una
 * defensa contra robots: es «ahora no puedo, vuelve en un minuto». Lo
 * honrado es decir eso y no puntuar, porque muy probablemente en el
 * siguiente intento salga un informe normal.
 */
export function detectarOcupada({ cabeceras = {}, estado = 200 }) {
  if (estado !== 429 && estado !== 503) return null
  const cabecera = cabeceras['retry-after']
  const espera = /^\d+$/.test(String(cabecera || '').trim()) ? Number(cabecera) : null
  return { clase: 'ocupada', tipo: String(estado), nombre: 'una página de «demasiadas peticiones»', estado, espera }
}

/** ¿Lo que hay en esa direccion es un sustituto de web? */
export function detectarSustituta({ html = '', estado = 200, pagina }) {
  if (!pareceVacia(pagina, html)) return null
  const visible = `${pagina.titulo || ''} ${pagina.texto}`
  const encontrada = SUSTITUTAS.find((s) => s.patron.test(visible) || s.patron.test(html))
  return encontrada ? { clase: encontrada.clase, tipo: encontrada.clase, nombre: encontrada.nombre, estado } : null
}

/**
 * Los robots que generan la tarjeta de un enlace compartido.
 *
 * Esto nacio de una tienda real que nos contestaba 429 y a Chrome 200. En vez
 * de dejarlo en «no hemos podido verla», se le pregunta lo mismo con la cara
 * de los robots que de verdad le importan: resulto que el de Meta —el que
 * dibuja la vista previa en Instagram y en Facebook— se comia el mismo
 * rechazo. Para una tienda que va a trabajar con creadores, eso no es un
 * detalle tecnico: es que el enlace que publique el creador puede salir sin
 * imagen, sin titulo y sin nada en lo que pulsar.
 *
 * Se consultan solo cuando ya nos han bloqueado: son dos peticiones de mas
 * en el unico caso en el que, si no, no tendriamos nada que contar.
 */
export const AGENTES_PREVIA = [
  {
    id: 'meta',
    nombre: 'Instagram y Facebook',
    agente: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  },
  { id: 'whatsapp', nombre: 'WhatsApp', agente: 'WhatsApp/2.23.20.0 A' },
]

/** Las tres preguntas de una vez: lo que hemos descargado, ¿es su web? */
export const queNosHanDado = (datos) => detectarMuro(datos) || detectarOcupada(datos) || detectarSustituta(datos)

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
  ocupada: (m) => ({
    titular: 'Tu web nos ha pedido que esperemos.',
    texto:
      `Ha contestado con un ${m.estado}: «demasiadas peticiones». No es un fallo tuyo ni un informe malo, es que en este momento no nos atiende` +
      `${m.espera ? `, y nos pide ${m.espera} segundos` : ''}. Vuelve a intentarlo dentro de un rato y lo más probable es que salga el informe entero. ` +
      'Si te pasa siempre, entonces sí importa: lo que nos frena a nosotros frena también a Google cuando pasa a rastrearte.',
    arreglo: 'Si se repite, pregunta a tu hosting si tienes un límite de peticiones demasiado estrecho.',
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
export function informeSinWeb({ url, muro, redirecciones = [], previsualizadores = [] }) {
  const { titular, texto, arreglo } = (TEXTOS[muro.clase] || TEXTOS.bloqueo)(muro)
  const rechazados = previsualizadores.filter((p) => !p.ok)
  const admitidos = previsualizadores.filter((p) => p.ok)

  // Lo unico accionable que podemos sacar de aqui, y vale mas que el resto
  // del informe que no hemos podido hacer: si lo que nos rechaza rechaza
  // tambien al robot que dibuja la tarjeta de un enlace compartido, el
  // trabajo del creador sale en gris.
  const aviso = rechazados.length
    ? `Hemos vuelto a preguntar con la cara de los robots que dibujan la vista previa de un enlace compartido, y en este intento la de ${rechazados
        .map((p) => p.nombre)
        .join(' y la de ')} ha recibido el mismo rechazo${
        admitidos.length ? `, mientras que la de ${admitidos.map((p) => p.nombre).join(' y la de ')} ha pasado` : ''
      }. Si se repite, cuando un creador comparta tu enlace ahí saldrá un rectángulo gris sin imagen ni título: justo el soporte por el que habrías pagado. Compruébalo tú con el depurador de enlaces de Meta, que te lo dice en un minuto y sin ambigüedad.`
    : null

  return {
    analizadaEl: new Date().toISOString(),
    // Sin `plataforma`: lo que hemos visto es la pagina de otro, y la ficha
    // solo lleva lo que sabemos de la web de quien pregunta. El titular ya
    // dice con qué nos hemos topado.
    ficha: { url, estado: muro.estado ?? null, saltos: redirecciones.length },
    nota: { total: null, letra: null, veredicto: null },
    muro,
    previsualizadores,
    // Ni el muro ni el «vuelve luego» dicen nada de la web: no son un «no»,
    // son un «no lo sabemos». Un dominio aparcado si es un no rotundo.
    //
    // Que un previsualizador se lleve un rechazo no sube el semaforo a rojo,
    // y eso es deliberado: lo hemos visto **una vez**. Probandolo contra una
    // tienda real, el mismo robot recibio un 429 en un intento y un 200 dos
    // minutos despues. Una observacion no es un veredicto; se cuenta lo
    // observado y se manda a comprobarlo donde se comprueba de verdad.
    campana: {
      semaforo: muro.clase === 'bloqueo' || muro.clase === 'ocupada' ? 'reparos' : 'no',
      titular,
      texto: aviso ? `${texto}\n\n${aviso}` : texto,
      bloqueos: rechazados.map((p) => ({ id: `previa-${p.id}`, titulo: `Vista previa en ${p.nombre}` })),
    },
    prioridades: [],
    bienHecho: [],
    areas: [],
    sinMirar: [],
    advertencias: [
      `Lo que hemos descargado es ${muro.nombre}, no tu web.`,
      ...(rechazados.length
        ? ['Quien lleve la web tiene que dejar pasar a los robots de vista previa (facebookexternalhit, WhatsApp, Twitterbot). No son rastreadores que te cuesten dinero: son los que enseñan tu tarjeta cuando alguien te comparte.']
        : []),
      arreglo,
    ],
    resumen: { fallos: 0, avisos: 0, correctas: 0, sinMirar: 0 },
  }
}

export default { detectarMuro, detectarOcupada, detectarSustituta, queNosHanDado, informeSinWeb, AGENTES_PREVIA }
