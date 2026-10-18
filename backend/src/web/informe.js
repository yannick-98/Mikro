/**
 * El informe: lo que de verdad se lee.
 *
 * Todo lo anterior produce datos; esto decide que se cuenta primero. El orden
 * no es casual y es la mitad del valor de la herramienta:
 *
 *  1. **La ficha**: que hemos mirado exactamente, para que nadie dude de si
 *     el informe va de su web.
 *  2. **¿Puedo lanzar una campana manana?**: la pregunta por la que esta
 *     persona ha entrado. Se contesta la primera, en una linea.
 *  3. **Lo primero que arreglaria**: como mucho ocho cosas, ordenadas por lo
 *     que recupera cada una. Una lista de cuarenta cosas no se arregla; se
 *     cierra.
 *  4. **Lo que ya esta bien**: porque un informe que solo rine se lee una vez
 *     y porque hay cosas que conviene no tocar en el proximo rediseno.
 *  5. **El desglose**, para quien quiera verlo todo.
 *  6. **Lo que no hemos podido mirar**, con el porque. Es la parte que separa
 *     un informe de un panfleto de agencia.
 */
import { ESFUERZOS } from './comprobacion.js'
import { bienHecho, prioridades, puntuar } from './puntuar.js'

/** Lo que de verdad decide si una campana va a funcionar. */
const CRITICAS = {
  https: 'tu web no va por HTTPS',
  viewport: 'tu web no está adaptada al móvil',
  respuesta: 'tu servidor tarda demasiado en contestar',
  adaptable: 'tus estilos no tienen reglas para pantallas pequeñas',
  'accion-principal': 'no hay nada claro que hacer al entrar',
  analitica: 'no mides las visitas y no sabrás qué trajo',
  parametros: 'tu web pierde las etiquetas de campaña',
  'vista-previa': 'tu enlace se comparte sin imagen',
}

/** La ficha de identidad: que hemos mirado y con que esta hecho. */
function ficha(p) {
  return {
    url: p.url,
    entrada: p.entrada,
    dominio: p.dominio,
    titulo: p.titulo,
    descripcion: p.metas.description || null,
    idioma: (/<html[^>]*\blang\s*=\s*["']?([a-z-]+)/i.exec(p.html) || [])[1] || null,
    imagen: p.metas['og:image'] || null,
    plataforma: p.huellas.plataforma?.nombre || null,
    servidor: p.huellas.servidor,
    estado: p.estado,
    saltos: p.redirecciones.length,
    peso: p.bytes,
    respuestaMs: p.ms.cabeceras,
    analiticas: p.huellas.analiticas.map((a) => a.nombre),
    pixeles: p.huellas.pixeles.map((a) => a.nombre),
    venta: p.huellas.venta.map((a) => a.nombre),
    palabras: p.palabras,
  }
}

/**
 * La respuesta a «¿puedo lanzar una campana con esto?».
 *
 * No se calcula con la nota global: una web puede sacar un 80 largo y seguir
 * sin poder medir una sola visita. Lo que manda son las ocho comprobaciones
 * que, falladas, hacen que el dinero de la campana no vuelva.
 */
function paraTuCampana(areas) {
  const todas = areas.flatMap((a) => a.comprobaciones)
  const rotas = todas.filter((c) => c.estado === 'fallo' && c.id in CRITICAS)
  const flojas = todas.filter((c) => c.estado === 'aviso' && c.id in CRITICAS)
  const lista = (cs) => {
    const textos = cs.map((c) => CRITICAS[c.id])
    if (textos.length === 1) return textos[0]
    return `${textos.slice(0, -1).join(', ')} y ${textos.at(-1)}`
  }

  if (rotas.length >= 3) {
    return {
      semaforo: 'no',
      titular: 'Hoy no traigas tráfico a esta web.',
      texto: `Antes de pagar a nadie por mandarte visitas hay tres cosas que arreglar: ${lista(rotas.slice(0, 3))}. Tal y como está, la mayoría de la gente que llegue se irá sin hacer nada y tú no te enterarás de cuánta era.`,
      bloqueos: rotas.map((c) => ({ id: c.id, titulo: c.titulo })),
    }
  }
  if (rotas.length) {
    return {
      semaforo: 'reparos',
      titular: 'Casi, pero arregla esto antes.',
      texto: `Tu web aguanta una campaña salvo por un detalle que lo echa a perder: ${lista(rotas)}. Es cosa de una tarde y cambia el resultado entero.`,
      bloqueos: rotas.map((c) => ({ id: c.id, titulo: c.titulo })),
    }
  }
  if (flojas.length >= 2) {
    return {
      semaforo: 'reparos',
      titular: 'Puedes lanzar, pero vas a medir a medias.',
      texto: `Nada está roto. Lo que flojea: ${lista(flojas.slice(0, 3))}. Se puede empezar igualmente, con la idea de ir corrigiendo.`,
      bloqueos: [],
    }
  }
  return {
    semaforo: 'si',
    titular: 'Tu web está lista para recibir una campaña.',
    texto: 'Lo esencial está: se ve bien en el móvil, se puede hacer algo al entrar, mides lo que llega y tu enlace se comparte con buena cara.',
    bloqueos: [],
  }
}

/** Lo que no hemos podido mirar y por que. Se cuenta, no se esconde. */
const sinMirar = (areas) =>
  areas.flatMap((a) =>
    a.comprobaciones
      .filter((c) => c.estado === 'no-comprobado' || c.estado === 'no-aplica')
      .map((c) => ({ id: c.id, area: a.nombre, titulo: c.titulo, porque: c.porque })),
  )

/** Las advertencias que cambian como hay que leer el informe entero. */
function advertencias(p) {
  const out = [
    'Medimos el HTML que entrega tu servidor y las cabeceras de la respuesta, no lo que acaba pintando un navegador. Es una radiografía, no una foto.',
    'Hemos mirado solo esta página. Lo que valga para tu portada no tiene por qué valer para una ficha de producto.',
  ]
  if (p.renderizadoEnCliente) {
    out.unshift(
      'Tu web monta el contenido con JavaScript en el navegador: el HTML que llega viene prácticamente vacío. Varias comprobaciones de textos, enlaces y formularios no se pueden hacer así y aparecen como «no comprobadas». Google sí ejecuta JavaScript, pero tarda más y no siempre lo hace.',
    )
  }
  if (p.cortado) out.push('Tu HTML supera los 2 MB y hemos dejado de descargarlo: las comprobaciones que dependen del final de la página pueden quedarse cortas.')
  if (p.redirecciones.length) out.push(`Analizamos ${p.url} tras ${p.redirecciones.length} redirección(es) desde ${p.entrada}.`)
  out.push('Las menciones a la LSSI y al RGPD señalan lo que no encontramos; no son asesoramiento legal.')
  return out
}

/** El informe completo a partir de una pagina ya recogida. */
export function informar(pagina, { cuantasPrioridades = 8 } = {}) {
  const { total, letra, veredicto, areas } = puntuar(pagina)
  return {
    analizadaEl: new Date().toISOString(),
    ficha: ficha(pagina),
    nota: { total, letra, veredicto },
    campana: paraTuCampana(areas),
    prioridades: prioridades(areas, { cuantas: cuantasPrioridades }),
    bienHecho: bienHecho(areas),
    areas,
    sinMirar: sinMirar(areas),
    advertencias: advertencias(pagina),
    resumen: {
      fallos: areas.reduce((s, a) => s + a.fallos, 0),
      avisos: areas.reduce((s, a) => s + a.avisos, 0),
      correctas: areas.reduce((s, a) => s + a.correctas, 0),
      sinMirar: areas.reduce((s, a) => s + a.sinMirar, 0),
    },
  }
}

/** El informe cuando no hemos llegado ni a descargar la web. */
export function informeDeFallo({ url, fallo, estado, redirecciones = [] }) {
  return {
    analizadaEl: new Date().toISOString(),
    ficha: { url, estado: estado ?? null, saltos: redirecciones.length },
    nota: { total: null, letra: null, veredicto: null },
    fallo,
    campana: {
      semaforo: 'no',
      titular: 'No hemos podido entrar en tu web.',
      texto: `${fallo.mensaje}. Si no entramos nosotros, tampoco entra Google ni la gente que te mande un creador: esto es lo primero y lo único que hay que arreglar hoy.`,
      bloqueos: [],
    },
    prioridades: [],
    bienHecho: [],
    areas: [],
    sinMirar: [],
    advertencias: ['No hemos llegado a descargar la página, así que no hay nada más que podamos decirte de ella.'],
    resumen: { fallos: 1, avisos: 0, correctas: 0, sinMirar: 0 },
  }
}

const ESTADO = { ok: '✓', aviso: '!', fallo: '✗', 'no-comprobado': '·', 'no-aplica': '·' }

/**
 * El mismo informe en texto plano.
 *
 * Existe porque esto se reenvia. La duena de la panaderia no va a arreglar
 * nada: se lo va a mandar a su sobrino o a la agencia que le hizo la web, y
 * lo va a hacer por WhatsApp o por correo. Si para eso hay que hacer capturas
 * de pantalla, no lo manda.
 */
export function informeEnTexto(informe) {
  const l = []
  const { ficha: f, nota, campana } = informe

  l.push(`DIAGNÓSTICO DE ${f.url}`)
  l.push(new Date(informe.analizadaEl).toLocaleString('es-ES'))
  l.push('')

  if (informe.fallo) {
    l.push(`NO HEMOS PODIDO ANALIZARLA: ${informe.fallo.mensaje}`)
    return l.join('\n')
  }
  if (informe.muro) {
    l.push(`NO HEMOS PODIDO VERLA: ${informe.campana.titular}`)
    l.push('')
    l.push(informe.campana.texto)
    return l.join('\n')
  }

  l.push(`NOTA: ${nota.total}/100 (${nota.letra}) — ${nota.veredicto}`)
  l.push(`${informe.resumen.fallos} fallos · ${informe.resumen.avisos} avisos · ${informe.resumen.correctas} correctas · ${informe.resumen.sinMirar} sin comprobar`)
  l.push('')
  l.push(`PARA UNA CAMPAÑA: ${campana.titular}`)
  l.push(campana.texto)
  l.push('')

  if (informe.prioridades.length) {
    l.push('LO PRIMERO QUE ARREGLARÍA')
    informe.prioridades.forEach((p, i) => {
      l.push(`${i + 1}. [${p.areaNombre}] ${p.titulo} — recupera ${p.impacto} puntos`)
      l.push(`   ${p.dice}`)
      if (p.dato) l.push(`   Lo que hemos visto: ${p.dato}`)
      l.push(`   Qué hacer: ${p.arregla} (${ESFUERZOS[p.esfuerzo] || p.esfuerzo})`)
      l.push('')
    })
  }

  l.push('POR ÁREAS')
  for (const a of informe.areas) {
    l.push(`  ${a.nombre}: ${a.nota === null ? 'sin datos' : `${a.nota}/100`}`)
    for (const c of a.comprobaciones) {
      l.push(`    ${ESTADO[c.estado] || '?'} ${c.titulo}${c.dato ? ` — ${c.dato}` : ''}`)
    }
    l.push('')
  }

  if (informe.sinMirar.length) {
    l.push('LO QUE NO HEMOS PODIDO MIRAR')
    informe.sinMirar.forEach((s) => l.push(`  · ${s.titulo}: ${s.porque}`))
    l.push('')
  }

  l.push('CÓMO LEER ESTO')
  informe.advertencias.forEach((a) => l.push(`  · ${a}`))

  return l.join('\n')
}

export default { informar, informeDeFallo, informeEnTexto }
