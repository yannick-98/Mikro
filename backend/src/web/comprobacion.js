/**
 * La forma de una comprobacion, y por que tiene esta forma.
 *
 * Un informe de web medio dice "SEO: 62/100" y se queda tan ancho. Eso no
 * sirve para nada: quien lo lee no sabe que mirar, ni si es verdad, ni que
 * hacer el lunes. Aqui cada comprobacion esta obligada a traer cuatro cosas:
 *
 *  - **Que se ha mirado** (`titulo`): en una frase y sin tecnicismos.
 *  - **La prueba** (`dato`): el valor exacto que hemos encontrado. Si decimos
 *    que el titulo es largo, ensenamos el titulo y su longitud. Nadie tiene
 *    que creernos.
 *  - **Que significa** (`dice`): la consecuencia para el negocio, no la
 *    descripcion de la etiqueta.
 *  - **Que se hace** (`arregla`): una instruccion concreta, y cuanto cuesta.
 *
 * Y un quinto estado que casi ningun analizador tiene: `no-comprobado`. Si no
 * hemos podido mirar algo, se dice y **no puntua**. Un cero por algo que no
 * hemos sabido ver es una mentira con pinta de rigor.
 */

/** Lo que cuesta arreglarlo, en lenguaje de quien lo va a pagar. */
export const ESFUERZOS = {
  minutos: 'Cinco minutos',
  rato: 'Un rato',
  tarde: 'Una tarde',
  encargo: 'Hay que pedírselo a quien lleva la web',
}

export const ok = ({ dice, dato = null }) => ({ estado: 'ok', dice, dato })

export const aviso = ({ dice, arregla, dato = null, esfuerzo = 'minutos' }) => ({
  estado: 'aviso', dice, arregla, dato, esfuerzo,
})

export const fallo = ({ dice, arregla, dato = null, esfuerzo = 'minutos' }) => ({
  estado: 'fallo', dice, arregla, dato, esfuerzo,
})

/** No se ha podido mirar. No puntua ni a favor ni en contra. */
export const sinMirar = (porque) => ({ estado: 'no-comprobado', porque })

/** No aplica a esta web (no tiene tienda, no tiene formulario...). Tampoco puntua. */
export const noAplica = (porque) => ({ estado: 'no-aplica', porque })

/** Elige entre tres umbrales de una vez: el patron que mas se repite. */
export const segun = (valor, { bien, regular }, hechos) =>
  valor <= bien ? ok(hechos.ok) : valor <= regular ? aviso(hechos.aviso) : fallo(hechos.fallo)

/** Recorta un valor largo para que quepa como prueba en la pantalla. */
export const muestra = (texto, max = 160) => {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/** Ejecuta las comprobaciones de un area sobre una pagina. */
export function pasar(area, pagina) {
  return area.comprobaciones.map((c) => {
    let resultado
    try {
      resultado = c.mira(pagina)
    } catch (e) {
      // Una comprobacion rota no puede llevarse por delante el informe
      // entero: se marca como no comprobada y las demas siguen.
      resultado = sinMirar(`No hemos podido completar esta comprobación (${e.message})`)
    }
    return { id: c.id, area: area.id, titulo: c.titulo, peso: c.peso, ...resultado }
  })
}

export default { ok, aviso, fallo, sinMirar, noAplica, segun, muestra, pasar, ESFUERZOS }
