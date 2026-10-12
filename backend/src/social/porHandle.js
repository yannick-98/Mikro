/**
 * Las cuentas que solo nos dan su @.
 *
 * Esto le da a la consulta por @ la misma forma que tiene un proveedor de
 * OAuth, para que sync.js no tenga que saber de donde vienen los datos. La
 * diferencia entre una cuenta conectada y una consultada acaba siendo una
 * linea alla: de que sitio pide el perfil y las publicaciones.
 *
 * YouTube ya funcionaba asi desde el principio, con su API oficial. Lo que se
 * anade aqui es Instagram y TikTok, que no tienen API publica y van por un
 * servicio de consulta (lookup.js).
 */
import { consultar, lookupDisponible } from './lookup.js'
import { config } from './config.js'
import { contiene } from './propiedad.js'
import youtube from './providers/youtube.js'

/**
 * Perfil y publicaciones salen de la misma consulta, que se paga una vez. El
 * cache de lookup.js hace que las dos llamadas de sync.js no cuesten el
 * doble; aqui solo se reparte el resultado.
 */
function deLookup(platform) {
  return {
    modo: 'handle',
    metodo: 'LOOKUP',

    async fetchProfile(_token, referencia) {
      const { perfil } = await consultar(platform, referencia)
      return perfil
    },

    async fetchPosts(_token, referencia) {
      // sync.js pasa aqui el perfil ya leido; de el se saca el @ para dar en
      // el mismo cache y no pagar otra consulta.
      const ref = typeof referencia === 'object' ? referencia.handle : referencia
      const { posts } = await consultar(platform, ref)
      return posts
    },

    /** El codigo que el creador se ha puesto en la biografia. */
    async verificarPropiedad(referencia, codigo) {
      const { perfil } = await consultar(platform, referencia)
      return contiene(perfil.descripcion, codigo)
    },
  }
}

/**
 * El proveedor por @ de una plataforma, o null si no hay forma de consultarla
 * en este entorno.
 */
export function proveedorPorHandle(platform) {
  if (platform === 'youtube') return config.youtube.apiKey() ? youtube : null
  if (lookupDisponible(platform)) return deLookup(platform)
  return null
}

export default { proveedorPorHandle }
