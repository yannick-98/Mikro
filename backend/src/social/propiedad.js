/**
 * Comprobar que una cuenta es de quien dice que es.
 *
 * ## El agujero que tapa esto
 *
 * Si para dar de alta una cuenta basta con escribir su @, cualquiera puede
 * escribir el de otro. Y en Mikro eso no es un dato mal puesto: es que una
 * empresa paga 250 euros por llegar a 80.000 seguidores que son de otra
 * persona, y el dinero acaba en la cuenta bancaria del que mintió.
 *
 * El arreglo es el mismo que usa media internet para verificar dominios: se
 * le da al creador un codigo, el lo pone en su biografia, y nosotros lo
 * leemos. Solo puede escribir ahi quien tiene las llaves de la cuenta. Luego
 * lo quita y ya esta: lo que queda guardado es la fecha en que se comprobo.
 *
 * ## Por que el codigo no se guarda en la base
 *
 * Sale de un HMAC del id del creador, la plataforma y JWT_SECRET. Siempre es
 * el mismo para la misma persona y la misma red, asi que puede empezar hoy y
 * terminar manana sin que le caduque nada, y no hay una tabla mas que
 * mantener. Y no es adivinable: sin el secreto no se puede calcular el codigo
 * de otro para ponerselo en su propia biografia.
 */
import crypto from 'node:crypto'

const SECRET = () => process.env.JWT_SECRET || 'mikro-dev-secret'

/**
 * El codigo que el creador tiene que pegar en su biografia.
 *
 * Corto y legible a proposito: lo va a copiar a mano en el movil. Sin letras
 * que se confundan (no hay o, l ni 1 en hexadecimal salvo el 1, que se queda
 * porque el alfabeto es el que es; lo importante es que sea corto).
 */
export function codigoPara(creatorId, platform) {
  const h = crypto
    .createHmac('sha256', SECRET())
    .update(`propiedad:${creatorId}:${platform}`)
    .digest('hex')
  return `mikro-${h.slice(0, 6)}`
}

/**
 * Busca el codigo en un texto.
 *
 * Tolerante con lo que la gente hace de verdad: mayusculas, espacios
 * alrededor, y el guion cambiado por otra cosa al copiar y pegar desde el
 * movil. Lo que no se tolera es que no este.
 */
export function contiene(texto, codigo) {
  const limpio = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/[\s‐-―_]+/g, '-')
  return limpio(texto).includes(limpio(codigo))
}

/**
 * Lo que hay que decirle al creador.
 *
 * Vive aqui y no en la interfaz porque las instrucciones dependen de donde se
 * pone el codigo en cada red, y eso es un detalle de la plataforma.
 */
export const DONDE = {
  instagram: 'en tu biografía de Instagram',
  tiktok: 'en tu biografía de TikTok',
  youtube: 'en la descripción de tu canal',
}

export function instrucciones(platform, codigo) {
  return {
    codigo,
    donde: DONDE[platform] || 'en tu biografía',
    pasos: [
      `Copia el código ${codigo}`,
      `Pégalo ${DONDE[platform] || 'en tu biografía'} y guarda los cambios`,
      'Vuelve aquí y pulsa Comprobar',
      'Cuando salga verificada, ya puedes quitarlo si quieres',
    ],
  }
}

/**
 * Si las cifras de una cuenta pueden salir al escaparate.
 *
 * Esta funcion es la regla de negocio entera de todo este fichero, y vive
 * aqui, sola y sin dependencias, para que se pueda probar y leer de un golpe.
 *
 * El caso que decide todo es el tercero: una cuenta dada de alta solo con el
 * @ trae cifras reales de una cuenta que quiza no es de quien la dio de alta.
 * Publicarlas seria venderle a una marca la audiencia de otra persona y
 * cobrarsela.
 */
export function cuentaParaElPerfil(c) {
  if (c.source !== 'CONNECTED' || !c.followers) return false
  if (c.metodo === 'LOOKUP' && !c.ownershipVerifiedAt) return false
  return true
}

export default { codigoPara, contiene, instrucciones, cuentaParaElPerfil, DONDE }
