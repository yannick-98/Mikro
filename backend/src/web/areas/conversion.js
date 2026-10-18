/**
 * Area 5 — Si convierte.
 *
 * Es la que mas pesa, y la razon es aritmetica. Todo lo demas de este informe
 * sirve para que llegue gente; esta es la unica que decide si esa gente hace
 * algo. Una web impecable a la que no se le puede llamar, que no dice donde
 * esta y que no ensena un precio es un folleto caro.
 *
 * La pregunta que se hace cada comprobacion es siempre la misma: **si entro
 * ahora mismo desde el movil, convencido por el video de un creador, ¿puedo
 * hacer algo antes de aburrirme?** Llamar, reservar, comprar, escribir por
 * WhatsApp o saber a que hora abres y donde estas. Si la respuesta a todo es
 * no, el dinero de la campana se ha ido entero.
 *
 * Las expresiones de este fichero son las que mas se han tenido que afinar
 * contra webs reales, y el motivo siempre es el mismo: un falso positivo aqui
 * no es un detalle, es decirle a alguien que tiene telefono cuando no lo
 * tiene. Cada una lleva apuntado el caso que la corrigio.
 */
import { aviso, fallo, muestra, ok, sinMirar } from '../comprobacion.js'
import { REDES } from '../huellas.js'
import { tieneTipo } from '../html.js'

/**
 * Un telefono espanol escrito como lo escribe una persona.
 *
 * La version ingenua («nueve cifras que empiecen por 6-9») dio por telefono
 * la referencia de un producto en una tienda real. Un numero que nadie ha
 * separado ni ha presentado como telefono no es un telefono: o lleva prefijo,
 * o lleva separadores, o lo acompana la palabra que lo anuncia.
 */
const TELEFONO =
  /(?:\+\s?34|0034)[\s.-]?[6-9]\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}|(?<![\d.,])[6-9]\d{2}(?:[\s.-]\d{2}[\s.-]\d{2}[\s.-]\d{2}|[\s.-]\d{3}[\s.-]\d{3})(?!\d)/
const CON_CONTEXTO =
  /(?:tel[eé]fono|tlf|tel\.|ll[aá]ma(?:nos)?|m[oó]vil|whatsapp)[^\d]{0,30}((?:\+?\s?34[\s.-]?)?[6-9][\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2})(?!\d)/i

/** Una direccion con numero de portal. Sin el numero, «Calle y número» de un formulario se colaba como la direccion del negocio. */
const DIRECCION =
  /\b(c\/|calle|avda\.?|avenida|avinguda|plaza|pza\.?|paseo|carrer|rúa|rua|travesía|camino|ctra\.?)\s+[A-Za-zÁÉÍÓÚÑáéíóúñ][\wÁÉÍÓÚÑáéíóúñ'·.\- ]{2,40}?[,\s]+(n[.ºo]?\s*)?\d{1,4}\b/i

/** Dias y horas de verdad: «Elige tu horario» no dice cuando abres. */
const DIAS = /(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bados?|domingos?|festivos|L\s*-\s*[VXSD])/i
const HORAS = /\b\d{1,2}([:.]\d{2})?\s*(h\b|horas?\b)?\s*(a|-|–|hasta)\s*\d{1,2}([:.]\d{2})?/i
const ANUNCIO_HORARIO = /(horario|abierto|abrimos|atendemos)[^.\n]{0,60}/i

const ACCION = /\b(compra|comprar|comprá|añadir al carrito|anadir al carrito|reserva|reservar|pide|pedir|pedido|contacta|contactar|escríbenos|escribenos|llama|llámanos|llamanos|presupuesto|cita|pedir cita|solicitar|apúntate|apuntate|suscríbete|suscribete|descarga|prueba gratis|empieza|ver carta|ver menú|ver menu|ver precios|tienda|reservar mesa)\b/i

const area = {
  id: 'conversion',
  nombre: 'Si convierte',
  peso: 22,
  descripcion: 'Qué puede hacer quien entra: llamar, reservar, comprar o irse.',
  comprobaciones: [
    {
      id: 'accion-principal',
      titulo: 'Hay algo claro que hacer nada más entrar',
      peso: 5,
      mira(p) {
        if (p.renderizadoEnCliente) return sinMirar('La web se monta con JavaScript y no podemos ver los botones sin un navegador.')
        const arriba = p.body.slice(0, 7000)
        const enlacesArriba = p.enlaces.filter((e) => e.indice < 7000)
        const conAccion = enlacesArriba.filter((e) => ACCION.test(e.texto) || /tel:|wa\.me|mailto:|\/(reserva|cita|contacto|tienda|shop|carrito|comprar)/i.test(e.href))
        const botones = (arriba.match(/<button\b/gi) || []).length
        if (conAccion.length) {
          return ok({
            dice: 'Quien entra tiene claro qué puede hacer sin tener que buscarlo.',
            dato: muestra(conAccion.slice(0, 3).map((e) => `«${e.texto || e.href}»`).join(' · '), 160),
          })
        }
        if (botones) {
          return aviso({
            dice: 'Hay botones arriba, pero ninguno dice claramente qué pasa al pulsarlo.',
            dato: `${botones} botón(es) sin texto de acción reconocible`,
            arregla: 'Cambia el texto del botón principal por el verbo exacto: «Reservar mesa», «Pedir cita», «Ver la carta». «Más información» no es una acción.',
            esfuerzo: 'rato',
          })
        }
        return fallo({
          dice: 'En lo primero que se ve no hay nada que hacer. Quien llega desde el vídeo de un creador tiene quince segundos de intención; si en ese rato no encuentra el botón, se va.',
          arregla: 'Pon arriba del todo un botón con la acción que de verdad quieres: reservar, pedir cita, comprar o llamar. Uno solo, bien grande.',
          esfuerzo: 'rato',
        })
      },
    },

    {
      id: 'telefono',
      titulo: 'Se te puede llamar de un toque',
      peso: 4,
      mira(p) {
        const enlace = p.enlaces.find((e) => /^tel:/i.test(e.href))
        if (enlace) return ok({ dice: 'Tu teléfono es pulsable: desde el móvil se llama de un toque.', dato: enlace.href.replace(/^tel:/i, '') })
        const enTexto = TELEFONO.exec(p.texto) || CON_CONTEXTO.exec(p.texto)
        if (enTexto) {
          return aviso({
            dice: 'Tienes el teléfono escrito pero no se puede pulsar. Desde el móvil hay que memorizarlo, salir de la web y marcarlo a mano. La mitad no lo hace.',
            dato: muestra(enTexto[0], 40),
            arregla: 'Envuélvelo: <a href="tel:+34600000000">600 00 00 00</a>',
            esfuerzo: 'minutos',
          })
        }
        if (p.renderizadoEnCliente) return sinMirar('No podemos leer el texto de la página sin un navegador.')
        return fallo({ dice: 'No hay teléfono en la página. Para un negocio local, es el canal por el que entra la mayoría de lo que se cierra el mismo día.', arregla: 'Pon el teléfono en la cabecera, como enlace tel:, visible sin bajar.', esfuerzo: 'rato' })
      },
    },

    {
      id: 'comprar-o-reservar',
      titulo: 'Se puede comprar o reservar aquí mismo',
      peso: 3,
      mira(p) {
        if (p.huellas.venta.length) {
          return ok({ dice: 'Quien llega puede comprar o reservar sin salir ni esperar a que abras.', dato: p.huellas.venta.map((v) => v.nombre).join(', ') })
        }
        const enlace = p.enlaces.find((e) => /\/(tienda|shop|carrito|cart|checkout|reserva|booking|cita)\b/i.test(e.href || ''))
        if (enlace) return ok({ dice: 'Hay una vía para comprar o reservar.', dato: enlace.url || enlace.href })
        return aviso({
          dice: 'No se puede comprar ni reservar desde la web. Toda la gente que te traiga una campaña tiene que acordarse de ti mañana, y mañana ya no se acuerda.',
          arregla: 'Aunque no montes una tienda: un botón de reserva (Booksy, CoverManager, incluso un Calendly) convierte la visita de hoy en algo que ya está apuntado.',
          esfuerzo: 'tarde',
        })
      },
    },

    {
      id: 'formulario',
      titulo: 'Hay una forma de escribirte',
      peso: 3,
      mira(p) {
        const utiles = p.formularios.filter((f) => {
          const tipos = f.campos.map((c) => c.tipo)
          const nombres = f.campos.map((c) => c.nombre).join(' ')
          const buscador = /buscar|search|\bs\b|query/.test(nombres) && f.campos.length <= 2
          return !buscador && (tipos.includes('email') || tipos.includes('tel') || f.areas > 0 || /email|correo|mensaje|telefono|teléfono/.test(nombres))
        })
        if (utiles.length) return ok({ dice: 'Se te puede escribir sin salir de la web.', dato: `${utiles.length} formulario(s) de contacto` })
        const correo = p.enlaces.find((e) => /^mailto:/i.test(e.href))
        if (correo) return aviso({ dice: 'Solo hay un correo electrónico. Funciona, pero abre el programa de correo y ahí se pierde la mitad de la gente.', dato: correo.href.replace(/^mailto:/i, ''), arregla: 'Pon un formulario corto: nombre, contacto y mensaje. Tres campos, ni uno más.', esfuerzo: 'tarde' })
        if (p.renderizadoEnCliente) return sinMirar('No podemos ver los formularios porque la web se monta con JavaScript.')
        return fallo({ dice: 'No hay formulario ni correo: quien no quiera llamar no tiene forma de contactar contigo.', arregla: 'Añade un formulario de tres campos y enlaza también tu correo.', esfuerzo: 'tarde' })
      },
    },

    {
      id: 'donde-estas',
      titulo: 'Se sabe dónde estás',
      peso: 3,
      mira(p) {
        const enFicha = tieneTipo(p.jsonLd, 'PostalAddress') || p.jsonLd.some((b) => b.address)
        const mapa = p.iframes.some((f) => /google\.[a-z.]+\/maps|openstreetmap|maps\.app/i.test(f.url || '')) ||
          p.enlaces.some((e) => /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(e.href || ''))
        const direccion = DIRECCION.exec(p.texto)
        const cp = /\b\d{5}\b\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(p.texto)
        if (enFicha || (mapa && (direccion || cp))) return ok({ dice: 'Tu dirección está clara y Google la puede leer.', dato: enFicha ? 'Dirección en los datos estructurados' : muestra(direccion?.[0] || 'Mapa incrustado', 90) })
        if (mapa || direccion || cp) return aviso({ dice: 'La dirección aparece, pero no de una forma que Google pueda leer para ponerte en el mapa.', dato: muestra(direccion?.[0] || (mapa ? 'Solo un mapa incrustado' : 'Solo un código postal'), 90), arregla: 'Añade la dirección como texto en el pie y métela también en el JSON-LD de LocalBusiness.', esfuerzo: 'rato' })
        if (p.renderizadoEnCliente) return sinMirar('No podemos leer el texto de la página sin un navegador.')
        return aviso({ dice: 'No encontramos ninguna dirección. Si tienes local, es lo primero que busca quien acaba de descubrirte.', arregla: 'Pon la dirección completa en el pie, con enlace a Google Maps.', esfuerzo: 'minutos' })
      },
    },

    {
      id: 'precio',
      titulo: 'Se ve algún precio',
      peso: 3,
      mira(p) {
        const conPrecio = /(\d{1,3}(?:[.,]\d{1,2})?)\s*€|€\s*\d|\b\d{1,4}\s*euros?\b/i.test(p.texto)
        const enFicha = p.jsonLd.some((b) => b.offers || b.price || b.priceRange)
        if (conPrecio || enFicha) return ok({ dice: 'Hay precios a la vista: quien entra sabe si le encaja antes de escribirte.', dato: enFicha ? 'Precio en los datos estructurados' : muestra((/.{0,40}€.{0,40}/.exec(p.texto) || [''])[0], 90) })
        if (p.renderizadoEnCliente) return sinMirar('No podemos leer el texto de la página sin un navegador.')
        return aviso({
          dice: 'No hay ni un precio. «Consultar» cuesta una conversación entera, y quien acaba de llegar desde una red social no la va a tener contigo.',
          arregla: 'Enseña al menos un precio de referencia o un «desde X €». Filtra a quien no te encaja y convence al que sí.',
          esfuerzo: 'rato',
        })
      },
    },

    {
      id: 'whatsapp',
      titulo: 'WhatsApp',
      peso: 2,
      mira(p) {
        const w = p.enlaces.find((e) => /wa\.me|api\.whatsapp\.com|whatsapp:\/\//i.test(e.href || ''))
        if (w) return ok({ dice: 'Se te puede escribir por WhatsApp, que es por donde la gente pregunta de verdad.', dato: w.url || w.href })
        return aviso({
          dice: 'No hay WhatsApp. Para una pyme local es el canal con más respuesta: quien no llama ni rellena formularios, sí escribe.',
          arregla: 'Pon un enlace https://wa.me/34600000000 con un mensaje ya escrito («Hola, he visto vuestra web y…»).',
          esfuerzo: 'minutos',
        })
      },
    },

    {
      id: 'redes',
      titulo: 'Tus redes están enlazadas',
      peso: 2,
      mira(p) {
        const encontradas = REDES.filter((r) => p.enlaces.some((e) => r.patron.test(e.href || '')))
        if (encontradas.length >= 2) return ok({ dice: 'Tus redes están a la vista. Es donde va a ir quien te descubra por un creador.', dato: encontradas.map((r) => r.nombre).join(', ') })
        if (encontradas.length === 1) return aviso({ dice: 'Solo enlazas una red.', dato: encontradas[0].nombre, arregla: 'Enlaza también las demás donde publiques: quien llega desde un vídeo quiere seguirte, no comprar hoy.', esfuerzo: 'minutos' })
        return aviso({
          dice: 'No enlazas ninguna red social. Quien entre no sabe dónde seguirte, y un creador que quiera etiquetarte no encuentra tu cuenta.',
          arregla: 'Pon los iconos de tus redes en la cabecera o en el pie.',
          esfuerzo: 'minutos',
        })
      },
    },

    {
      id: 'horario',
      titulo: 'Se sabe cuándo abres',
      peso: 2,
      mira(p) {
        const enFicha = p.jsonLd.some((b) => b.openingHours || b.openingHoursSpecification)
        const cerca = ANUNCIO_HORARIO.exec(p.texto)
        const enTexto = (DIAS.test(p.texto) && HORAS.test(p.texto)) || Boolean(cerca && HORAS.test(cerca[0]))
        if (enFicha) return ok({ dice: 'Tu horario está publicado y Google puede enseñarlo en los resultados.', dato: 'Horario en los datos estructurados' })
        if (enTexto) return aviso({ dice: 'El horario está escrito pero Google no puede leerlo para enseñar «Abierto ahora».', dato: muestra(cerca?.[0] || (DIAS.exec(p.texto) || [''])[0], 110), arregla: 'Añade openingHoursSpecification al JSON-LD de tu negocio.', esfuerzo: 'rato' })
        if (p.renderizadoEnCliente) return sinMirar('No podemos leer el texto de la página sin un navegador.')
        return aviso({ dice: 'No dices cuándo abres. Es la segunda pregunta de cualquiera que te acaba de descubrir, justo después de dónde estás.', arregla: 'Pon el horario en el pie y en tu ficha de Google.', esfuerzo: 'minutos' })
      },
    },

    {
      id: 'prueba-social',
      titulo: 'Alguien habla bien de ti',
      peso: 2,
      mira(p) {
        const enFicha = tieneTipo(p.jsonLd, 'Review', 'AggregateRating') || p.jsonLd.some((b) => b.aggregateRating)
        const widget = /trustpilot|elfsight|reviews?-widget|google.{0,20}reviews|tripadvisor/i.test(p.html)
        const enTexto = /\b(opiniones|valoraciones|reseñas|resenas|testimonios?|qué dicen|lo que dicen)\b/i.test(p.texto)
        if (enFicha || widget) return ok({ dice: 'Enseñas opiniones reales, y Google puede sacarlas con estrellas en los resultados.', dato: enFicha ? 'Valoraciones en los datos estructurados' : 'Widget de reseñas' })
        if (enTexto) return aviso({ dice: 'Hay testimonios, pero sin marcarlos no salen con estrellas en Google.', arregla: 'Añade el JSON-LD de Review o AggregateRating con las valoraciones que ya tienes.', esfuerzo: 'rato' })
        if (p.renderizadoEnCliente) return sinMirar('No podemos leer el texto de la página sin un navegador.')
        return aviso({ dice: 'Nadie habla bien de ti en tu web. Quien llega por recomendación de un creador busca una segunda confirmación antes de pagar.', arregla: 'Pon tres opiniones con nombre y foto, o incrusta tus reseñas de Google.', esfuerzo: 'tarde' })
      },
    },
  ],
}

export default area
