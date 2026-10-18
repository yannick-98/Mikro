/**
 * Diagnostico de la web de una empresa.
 *
 *   import { analizarWeb } from './web/index.js'
 *   const informe = await analizarWeb('panaderialaespiga.es')
 *
 * Que hace: descarga la pagina (y cinco cosas mas: robots.txt, sitemap, la
 * hoja de estilos principal, la version sin cifrar y una sonda con
 * parametros de campana), pasa 46 comprobaciones agrupadas en seis areas y
 * devuelve un informe con nota, prioridades ordenadas por lo que recupera
 * cada arreglo, y la lista de lo que no se ha podido mirar.
 *
 * Que no hace, y conviene que quede dicho: no abre un navegador, no mide
 * Core Web Vitals, no rastrea el sitio entero ni mira a la competencia. Todo
 * lo que afirma lo puede comprobar cualquiera mirando el codigo fuente de su
 * propia web, y por eso cada comprobacion viene con la prueba delante.
 *
 * Las piezas, por si hay que tocarlas:
 *
 *   seguridad.js   a donde se puede ir (y a donde no: SSRF)
 *   traer.js       descargar con limites de tiempo, peso y saltos
 *   html.js        leer HTML sin dependencias
 *   huellas.js     reconocer plataformas, analitica, pixeles y consentimiento
 *   recoger.js     la unica parte con red; produce la radiografia
 *   areas/*.js     las comprobaciones, puras y una por fichero
 *   puntuar.js     notas, pesos y prioridades
 *   informe.js     que se cuenta primero, y el informe en texto
 */
import { informar, informeDeFallo, informeEnTexto } from './informe.js'
import { informeSinWeb } from './muro.js'
import { leer, recoger } from './recoger.js'
import { WebInvalida, normalizar } from './seguridad.js'

/** El diagnostico completo de una direccion. */
export async function analizarWeb(entrada, opciones = {}) {
  const recogida = await recoger(entrada)
  if (recogida.muro) return informeSinWeb(recogida)
  if (recogida.fallo) return informeDeFallo(recogida)
  return informar(recogida.pagina, opciones)
}

/**
 * El mismo analisis sobre un HTML que ya tenemos.
 *
 * Es lo que usan las pruebas, y tambien lo que permitiria analizar una
 * pagina capturada en otro momento sin volver a salir a la red.
 */
export function analizarHtml(html, { url = 'https://example.com/', ...resto } = {}) {
  return informar(leer({ url, entrada: url, html, ...resto }))
}

export { informeEnTexto, informeSinWeb, normalizar, WebInvalida, leer, recoger }
export default { analizarWeb, analizarHtml, informeEnTexto }
