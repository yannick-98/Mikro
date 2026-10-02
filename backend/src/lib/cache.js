/**
 * Cache en memoria con caducidad.
 *
 * Vive dentro de la instancia: en una funcion serverless eso significa que
 * sirve mientras esa instancia siga caliente y se pierde al reciclarse. Es
 * justo lo que hace falta para datos publicos que cambian poco (el ranking de
 * la landing), sin montar un Redis para ahorrar 600 ms.
 *
 * Las respuestas publicas ademas se marcan como cacheables para que el CDN las
 * sirva sin llegar a invocar la funcion.
 */

const store = new Map()

/** Devuelve el valor cacheado o lo calcula y lo guarda. */
export async function remember(key, ttlSeconds, compute) {
  const hit = store.get(key)
  if (hit && hit.expires > Date.now()) return hit.value

  const value = await compute()
  store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 })
  return value
}

/** Invalida una clave concreta o todo el almacen. */
export function forget(key) {
  if (key === undefined) store.clear()
  else store.delete(key)
}

/**
 * Marca la respuesta como cacheable por el CDN.
 *
 * `Vary: Authorization` es imprescindible: la misma ruta devuelve cosas
 * distintas con sesion y sin ella, y sin esa cabecera el borde podria servirle
 * a un usuario la version recortada de los anonimos.
 */
export function publicCache(res, { maxAge = 60, swr = 300 } = {}) {
  res.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${swr}`)
  res.set('Netlify-CDN-Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${swr}`)
  res.set('Vary', 'Authorization')
}

export default { remember, forget, publicCache }
