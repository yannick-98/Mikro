/**
 * Asistente de brief.
 *
 * Crear una campana empieza hoy con un campo de texto vacio, y ahi se cae
 * mucha gente. Peor: quien no se cae escribe tres lineas, y un brief de tres
 * lineas trae candidaturas que no encajan, lo que convence a la pyme de que
 * esto no funciona.
 *
 * Esto no escribe por nadie: propone un borrador a partir de lo que la empresa
 * ya nos ha dicho (su sector, su ciudad, su producto) y de lo que responde a
 * cuatro preguntas. El texto sale editable, porque el que sabe como habla su
 * marca es el dueno, no nosotros.
 *
 * Deliberadamente sin modelo de lenguaje: es una plantilla con reglas. Un
 * brief generado por IA suena a brief generado por IA, cuesta dinero en cada
 * campana y falla cuando la API esta caida. Una plantilla buena se lee mejor y
 * nunca se inventa el producto de nadie.
 */

/** Lo que de verdad hace falta saber para escribir un buen brief. */
export const PREGUNTAS = [
  {
    id: 'producto',
    pregunta: '¿Qué quieres que enseñe el creador?',
    ayuda: 'Un producto, un servicio, tu local… lo concreto que va a salir en el vídeo.',
    ejemplo: 'Nuestra masa madre de espelta, recién salida del horno',
    requerida: true,
  },
  {
    id: 'objetivo',
    pregunta: '¿Para qué?',
    tipo: 'opcion',
    opciones: [
      { id: 'ventas', texto: 'Vender más', detalle: 'Quiero pedidos o visitas que compren' },
      { id: 'notoriedad', texto: 'Que me conozcan', detalle: 'Quiero llegar a gente nueva de mi zona' },
      { id: 'lanzamiento', texto: 'Lanzar algo nuevo', detalle: 'Tengo un producto o local que estrenar' },
      { id: 'contenido', texto: 'Conseguir contenido', detalle: 'Quiero material para mis propias redes' },
    ],
    requerida: true,
  },
  {
    id: 'publico',
    pregunta: '¿A quién le hablas?',
    ayuda: 'Quién es tu cliente. Cuanto más concreto, mejores candidaturas.',
    ejemplo: 'Familias del barrio que compran pan de calidad entre semana',
    requerida: true,
  },
  {
    id: 'imprescindible',
    pregunta: '¿Hay algo que no puede faltar, o algo que no quieres ver?',
    ayuda: 'Una frase, el nombre bien dicho, no grabar en la cocina… lo que sea.',
    ejemplo: 'Que se vea el interior del pan al cortarlo. Sin música con derechos.',
    requerida: false,
  },
]

const OBJETIVOS = {
  ventas: {
    titulo: (p) => `Queremos vender más ${p}`,
    porque: 'El objetivo es que la gente compre, así que nos importa más que el contenido convenza que que sea bonito.',
    pide: 'Enseña el producto en uso y di por qué merece la pena. Un código de descuento tuyo hará que podamos medir lo que traes.',
    entregables: '1 reel, 2 stories',
  },
  notoriedad: {
    titulo: (p) => `Queremos que más gente conozca ${p}`,
    porque: 'Buscamos llegar a gente de la zona que todavía no nos conoce.',
    pide: 'Preséntanos como se lo contarías a un amigo. Nos interesa más que se entienda quiénes somos que una producción muy cuidada.',
    entregables: '1 reel, 3 stories',
  },
  lanzamiento: {
    titulo: (p) => `Estrenamos ${p} y queremos contarlo`,
    porque: 'Es un lanzamiento: lo importante es la novedad y que se note que llega ahora.',
    pide: 'Cuéntalo como una primicia. Nos viene bien que publiques el día que acordemos, para que coincida con el resto.',
    entregables: '1 reel, 3 stories, 1 publicación',
  },
  contenido: {
    titulo: (p) => `Buscamos contenido de ${p}`,
    porque: 'Queremos material para nuestras propias redes, además de tu publicación.',
    pide: 'Graba pensando también en vertical y sin texto encima, para que podamos reutilizarlo. Acordaremos por escrito durante cuánto tiempo.',
    entregables: '1 reel, 3 vídeos en bruto',
  },
}

const limpia = (s) => String(s || '').trim().replace(/\s+/g, ' ')

/** Quita el punto final para poder encadenar frases sin que queden dos. */
const sinPunto = (s) => limpia(s).replace(/[.…]+$/, '')

/**
 * Compone el borrador.
 *
 * Devuelve tambien titulo y entregables sugeridos, porque son los otros dos
 * campos donde la gente se atasca, y un consejo cuando detecta algo que va a
 * salir mal (un presupuesto fuera de mercado, un brief sin publico).
 */
export function redactarBrief({ respuestas = {}, brand = {}, campaign = {} } = {}) {
  const objetivo = OBJETIVOS[respuestas.objetivo] || OBJETIVOS.notoriedad
  const producto = sinPunto(respuestas.producto) || 'nuestro producto'
  const publico = sinPunto(respuestas.publico)
  const extra = sinPunto(respuestas.imprescindible)
  const ciudad = limpia(campaign.targetCity || brand.city)
  const empresa = limpia(brand.companyName) || 'Nuestra marca'

  const parrafos = []

  parrafos.push(
    `${empresa}${brand.sector ? `, ${brand.sector.toLowerCase()}` : ''}${
      ciudad ? ` en ${ciudad}` : ''
    }. ${objetivo.titulo(producto)}.`,
  )

  parrafos.push(objetivo.porque)

  if (publico) {
    parrafos.push(
      `Nos dirigimos a ${publico}${
        ciudad ? `, sobre todo en ${ciudad} y alrededores` : ''
      }. Si tu audiencia se parece a eso, encajas.`,
    )
  }

  parrafos.push(`**Qué esperamos del contenido.** ${objetivo.pide}`)

  if (extra) parrafos.push(`**Importante para nosotros.** ${extra}.`)

  parrafos.push(
    '**Cómo trabajamos.** Acordamos el precio antes de empezar y el dinero queda retenido en Mikro hasta que aprobamos el contenido, así que cobras sí o sí. Si algo no encaja, te lo decimos por escrito y lo ajustamos antes de publicar.',
  )

  const consejos = []
  if (!publico) {
    consejos.push(
      'No has dicho a quién le hablas. Es el dato que más ordena las candidaturas: sin él te escribirá gente que no tiene tu público.',
    )
  }
  if (campaign.budgetMax && campaign.budgetMax < 60) {
    consejos.push(
      'Por debajo de 60 € vas a recibir pocas candidaturas: es el suelo al que trabaja casi todo el mundo aquí.',
    )
  }
  if (campaign.budgetMin && campaign.budgetMax && campaign.budgetMax === campaign.budgetMin) {
    consejos.push(
      'Dar un rango en lugar de una cifra cerrada suele traer mejores perfiles: deja sitio a que alguien bueno se postule.',
    )
  }

  return {
    titulo: tituloSugerido(respuestas, { empresa, ciudad }),
    brief: parrafos.join('\n\n'),
    deliverables: objetivo.entregables,
    consejos,
  }
}

function tituloSugerido(respuestas, { empresa, ciudad }) {
  const producto = sinPunto(respuestas.producto)
  if (!producto) return `Colaboración con ${empresa}`
  const corto = producto.length > 48 ? `${producto.slice(0, 45).trim()}…` : producto
  const plantillas = {
    ventas: `Da a conocer ${corto}`,
    notoriedad: `${corto}${ciudad ? `, en ${ciudad}` : ''}`,
    lanzamiento: `Estrenamos ${corto}`,
    contenido: `Buscamos contenido de ${corto}`,
  }
  return plantillas[respuestas.objetivo] || plantillas.notoriedad
}

export default { redactarBrief, PREGUNTAS }
