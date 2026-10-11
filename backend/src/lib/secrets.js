/**
 * Cifrado de los tokens que guardamos de otras plataformas.
 *
 * Un token de Instagram o de TikTok no es un dato del creador: es la llave de
 * su cuenta. Guardarlo en claro significa que una copia de seguridad perdida,
 * un volcado de la base o un error de permisos en el panel de administracion
 * se convierten en una lista de accesos a cuentas ajenas. Cifrarlo no arregla
 * una base comprometida, pero si separa "se han llevado la base" de "se han
 * llevado las cuentas de los creadores", que son dos incidentes muy distintos.
 *
 * AES-256-GCM: cifra y autentica a la vez, asi que un valor manipulado falla
 * al descifrar en vez de devolver basura. La clave sale de SECRETS_KEY (32
 * bytes en hexadecimal o base64).
 *
 * Si no hay clave configurada, cifrar lanza. Es deliberado: preferimos que
 * conectar una cuenta falle de forma ruidosa en el despliegue a que funcione
 * guardando tokens en claro sin que nadie se entere.
 */
import crypto from 'node:crypto'

const ALGO = 'aes-256-gcm'
const PREFIJO = 'v1'

let cache
/** La clave, decodificada una vez. */
function clave() {
  if (cache !== undefined) return cache
  const bruta = process.env.SECRETS_KEY || ''
  if (!bruta) return (cache = null)

  const buf = /^[0-9a-f]{64}$/i.test(bruta)
    ? Buffer.from(bruta, 'hex')
    : Buffer.from(bruta, 'base64')
  if (buf.length !== 32) {
    throw new Error('SECRETS_KEY tiene que ser de 32 bytes (64 caracteres hex o 44 en base64)')
  }
  return (cache = buf)
}

/** Para las pruebas y para poder cambiar la clave sin reiniciar el proceso. */
export function resetSecretsCache() {
  cache = undefined
}

export const secretsConfigured = () => !!clave()

/** Cifra un texto. Devuelve null si no hay nada que cifrar. */
export function encrypt(texto) {
  if (texto == null || texto === '') return null
  const key = clave()
  if (!key) throw new Error('Falta SECRETS_KEY: no se guardan tokens sin cifrar')

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const datos = Buffer.concat([cipher.update(String(texto), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [PREFIJO, iv.toString('base64'), tag.toString('base64'), datos.toString('base64')].join(':')
}

/**
 * Descifra. Devuelve null si el valor no se puede leer.
 *
 * No lanza: un token ilegible (clave rotada, dato corrupto) tiene el mismo
 * efecto practico que no tener token, y el codigo que llama ya sabe tratar
 * ese caso pidiendo al creador que vuelva a conectar.
 */
export function decrypt(valor) {
  if (!valor) return null
  const key = clave()
  if (!key) return null

  const partes = String(valor).split(':')
  if (partes.length !== 4 || partes[0] !== PREFIJO) return null

  // base64 es indulgente: ignora los caracteres sobrantes al final en vez de
  // quejarse, asi que "...AB" y "...ABx" decodifican igual y GCM valida los
  // dos. Un valor con basura pegada no es nuestro valor, y aqui se rechaza.
  const limpio = (b64) => {
    const buf = Buffer.from(b64, 'base64')
    return buf.toString('base64') === b64 ? buf : null
  }

  try {
    const [, iv64, tag64, datos64] = partes
    const iv = limpio(iv64)
    const tag = limpio(tag64)
    const datos = limpio(datos64)
    if (!iv || !tag || !datos) return null

    const decipher = crypto.createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(datos), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

export default { encrypt, decrypt, secretsConfigured, resetSecretsCache }
