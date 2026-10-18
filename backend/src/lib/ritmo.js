/**
 * Cuantas veces seguidas puede alguien pedir algo caro.
 *
 * Hace falta en cuanto una ruta publica hace trabajo de verdad: el
 * diagnostico de web sale a internet seis veces por analisis, y sin un freno
 * cualquiera con un bucle de tres lineas convierte nuestra funcion en un
 * escaner de webs ajenas con nuestra IP y nuestra factura.
 *
 * Es una ventana deslizante en memoria. En una funcion serverless eso
 * significa que el contador vive por instancia y se pierde al reciclarla:
 * frena el abuso tonto y los dedos nerviosos, que es el 99% de lo que pasa,
 * y no pretende ser una defensa contra un ataque repartido. Para eso esta el
 * borde de Netlify, no una variable de proceso.
 */

const ventanas = new Map()

/** Limpia lo caducado para que el mapa no crezca sin fin. */
function barrer(ahora) {
  for (const [clave, { hasta }] of ventanas) {
    if (hasta <= ahora) ventanas.delete(clave)
  }
}

/**
 * Apunta un uso y dice si se puede seguir.
 *
 * Devuelve `{ ok, restantes, esperaSegundos }`. Cuando `ok` es falso,
 * `esperaSegundos` es lo que queda para volver a intentarlo, que es lo unico
 * que le interesa a quien recibe el no.
 */
export function ritmo(clave, { veces = 10, segundos = 600 } = {}) {
  const ahora = Date.now()
  if (ventanas.size > 5000) barrer(ahora)

  const actual = ventanas.get(clave)
  if (!actual || actual.hasta <= ahora) {
    ventanas.set(clave, { usos: 1, hasta: ahora + segundos * 1000 })
    return { ok: true, restantes: veces - 1, esperaSegundos: 0 }
  }

  actual.usos += 1
  if (actual.usos > veces) {
    return { ok: false, restantes: 0, esperaSegundos: Math.ceil((actual.hasta - ahora) / 1000) }
  }
  return { ok: true, restantes: veces - actual.usos, esperaSegundos: 0 }
}

/** De donde viene la peticion, por detras del CDN. */
export const quien = (req) =>
  (req.headers['x-nf-client-connection-ip'] ||
    String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    'desconocido')

/** Para las pruebas y para cuando haga falta empezar de cero. */
export const olvidarRitmo = (clave) => (clave === undefined ? ventanas.clear() : ventanas.delete(clave))

export default { ritmo, quien, olvidarRitmo }
