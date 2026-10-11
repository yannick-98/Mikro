/**
 * Avisos a una persona.
 *
 * La notificacion dentro de la aplicacion se crea siempre. Ademas, si quien la
 * recibe nos ha dado su telefono y lo ha pedido expresamente, se le manda un
 * WhatsApp.
 *
 * Por que WhatsApp y no correo: una pyme espanola no vive en el correo. El
 * cuello de botella del embudo no es que no haya candidaturas, es que pasan
 * dias hasta que alguien las mira. Si el aviso llega donde la gente ya esta
 * mirando, el tiempo de respuesta baja de dias a horas y con el sube todo lo
 * demas. Esto no es una funcion del producto, es fontaneria del negocio.
 *
 * Tres reglas que no se saltan:
 *  - solo con permiso explicito (whatsappOptIn), nunca por defecto;
 *  - solo lo que no puede esperar, con una lista cerrada de motivos. Un canal
 *    personal se quema en cuanto se usa para dar la lata;
 *  - un fallo al enviar no rompe la accion que lo provoco. Que WhatsApp este
 *    caido no puede impedir que alguien acepte una candidatura.
 */
import { prisma } from '../lib/prisma.js'

const API = 'https://graph.facebook.com'

const config = () => ({
  token: process.env.WHATSAPP_TOKEN || '',
  phoneId: process.env.WHATSAPP_PHONE_ID || '',
  version: process.env.WHATSAPP_API_VERSION || 'v23.0',
  // La plantilla aprobada por Meta que se usa para los avisos. Fuera de la
  // ventana de 24 h solo se pueden mandar plantillas, y nuestros avisos
  // siempre caen fuera: nadie nos ha escrito antes.
  template: process.env.WHATSAPP_TEMPLATE || 'mikro_aviso',
  idioma: process.env.WHATSAPP_TEMPLATE_LANG || 'es',
})

export const whatsappConfigurado = () => {
  const c = config()
  return !!(c.token && c.phoneId)
}

/**
 * Avisos que justifican un mensaje al movil.
 *
 * Lista cerrada y corta a proposito. Todo lo demas se queda dentro de la
 * aplicacion, que es donde debe estar.
 */
const URGENTES = new Set([
  'APPLICATION', // alguien se ha postulado, o te han aceptado o rechazado
  'DEAL', // cambio en una colaboracion: hay dinero de por medio
  'INVITATION', // una marca te invita a su campana
])

// Fuera quedan MESSAGE y REVIEW a proposito. Un hilo de conversacion puede
// tener veinte mensajes en una tarde, y veinte WhatsApps en una tarde es la
// forma mas rapida de que alguien quite el permiso y no lo vuelva a dar. Una
// valoracion, sencillamente, puede esperar a que entre.

/**
 * Normaliza un telefono a formato internacional sin signos.
 *
 * Espana por defecto: la mayoria lo escribe sin prefijo y mandar a un numero
 * de nueve digitos no llega a ninguna parte.
 */
export function normalizarTelefono(valor, prefijoPorDefecto = '34') {
  const limpio = String(valor || '').replace(/[^\d+]/g, '')
  if (!limpio) return null
  if (limpio.startsWith('+')) return limpio.slice(1)
  if (limpio.startsWith('00')) return limpio.slice(2)
  if (limpio.length === 9) return `${prefijoPorDefecto}${limpio}`
  return limpio
}

/** Manda la plantilla. Devuelve si salio o por que no. */
export async function enviarWhatsapp(telefono, { titulo, cuerpo, enlace }) {
  const c = config()
  if (!whatsappConfigurado()) return { enviado: false, motivo: 'sin-configurar' }

  const destino = normalizarTelefono(telefono)
  if (!destino) return { enviado: false, motivo: 'sin-telefono' }

  // Los parametros de una plantilla no admiten saltos de linea ni tabulaciones:
  // Meta rechaza el mensaje entero con un error poco descriptivo.
  const limpia = (s, max) =>
    String(s || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max)

  try {
    const res = await fetch(`${API}/${c.version}/${c.phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: destino,
        type: 'template',
        template: {
          name: c.template,
          language: { code: c.idioma },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: limpia(titulo, 120) },
                { type: 'text', text: limpia(cuerpo || '—', 240) },
              ],
            },
            ...(enlace
              ? [
                  {
                    type: 'button',
                    sub_type: 'url',
                    index: '0',
                    parameters: [{ type: 'text', text: limpia(enlace, 200) }],
                  },
                ]
              : []),
          ],
        },
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) {
      return { enviado: false, motivo: data.error?.message || `HTTP ${res.status}` }
    }
    return { enviado: true, id: data.messages?.[0]?.id || null }
  } catch (e) {
    return { enviado: false, motivo: String(e.message || e) }
  }
}

/**
 * Crea la notificacion y, si procede, avisa al movil.
 *
 * El WhatsApp se manda sin esperarlo: quien llamo a notify esta en mitad de
 * una peticion y no tiene por que pagar la latencia de una API ajena.
 */
export async function notify(userId, { kind, title, body, link }) {
  if (!userId) return null

  const notificacion = await prisma.notification.create({
    data: { userId, kind, title, body, link },
  })

  if (URGENTES.has(kind) && whatsappConfigurado()) {
    prisma.user
      .findUnique({ where: { id: userId }, select: { phone: true, whatsappOptIn: true } })
      .then((u) => {
        if (!u?.whatsappOptIn || !u.phone) return null
        return enviarWhatsapp(u.phone, { titulo: title, cuerpo: body, enlace: link })
      })
      .then((r) => {
        if (r && !r.enviado && r.motivo !== 'sin-telefono') {
          console.warn(`[whatsapp] no se pudo avisar (${kind}): ${r.motivo}`)
        }
      })
      .catch((e) => console.warn('[whatsapp] fallo inesperado:', e?.message))
  }

  return notificacion
}

export default notify
