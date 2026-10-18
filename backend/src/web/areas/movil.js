/**
 * Area 3 — En el movil.
 *
 * Es donde se juega el partido. El trafico que trae un creador llega desde
 * Instagram o TikTok: es movil en mas de nueve de cada diez visitas, y entra
 * por el navegador de dentro de la propia aplicacion, que es mas estrecho y
 * mas lento que Chrome. Una web que "se ve bien en el ordenador" y regular en
 * el movil no esta al 80%: esta rota para el unico publico que va a llegar.
 *
 * Lo que se puede afirmar sin navegador es menos de lo que nos gustaria, y
 * aqui esta todo: la etiqueta que activa el modo movil, si la hoja de estilos
 * tiene reglas para pantallas pequenas, si quedan anchos fijos de la epoca de
 * las webs de 960 pixeles y si el texto se declara mas pequeno de lo legible.
 * Lo que necesita pintar la pagina para saberse, no se dice.
 */
import { aviso, fallo, muestra, ok, sinMirar } from '../comprobacion.js'

const area = {
  id: 'movil',
  nombre: 'En el móvil',
  peso: 15,
  descripcion: 'Donde va a entrar el 90% del tráfico de una campaña.',
  comprobaciones: [
    {
      id: 'viewport',
      titulo: 'La web se adapta a la pantalla',
      peso: 5,
      mira(p) {
        const v = p.metas.viewport
        if (!v) {
          return fallo({
            dice: 'Falta la etiqueta que le dice al móvil que tu web es para él. Sin ella, el navegador enseña la versión de ordenador encogida: letra minúscula y a hacer pinza para leer.',
            arregla: 'Añade en el <head>: <meta name="viewport" content="width=device-width, initial-scale=1">',
            esfuerzo: 'minutos',
          })
        }
        if (!/width\s*=\s*device-width/i.test(v)) {
          return fallo({ dice: 'La etiqueta de pantalla está puesta pero no usa el ancho del dispositivo, que es justo para lo que sirve.', dato: muestra(v), arregla: 'Déjala exactamente así: content="width=device-width, initial-scale=1"', esfuerzo: 'minutos' })
        }
        return ok({ dice: 'Tu web se declara adaptada al móvil.', dato: muestra(v) })
      },
    },

    {
      id: 'adaptable',
      titulo: 'Los estilos tienen reglas para pantallas pequeñas',
      peso: 4,
      mira(p) {
        const css = `${p.estilos}\n${p.extras.css?.ok ? p.extras.css.texto : ''}`
        const hayCss = Boolean(p.estilos.trim() || p.extras.css?.ok)
        if (!hayCss) return sinMirar('No hemos podido leer tu hoja de estilos para ver si tiene reglas de móvil.')
        const consultas = (css.match(/@media[^{]*\((max|min)-width/gi) || []).length
        const utilidades = /\b(sm|md|lg|xl):[a-z-]/.test(p.html) // Tailwind y parecidos
        const dato = consultas ? `${consultas} regla(s) @media por ancho de pantalla` : utilidades ? 'Clases responsivas en el HTML' : 'Ninguna'
        if (consultas >= 3 || utilidades) return ok({ dice: 'Tus estilos cambian según el ancho de la pantalla.', dato })
        if (consultas >= 1) return aviso({ dice: 'Hay muy pocas reglas para pantallas pequeñas: la web se adapta a medias.', dato, arregla: 'Repasa en el móvil las secciones que se salen y añade las reglas que falten.', esfuerzo: 'tarde' })
        return fallo({ dice: 'Tu hoja de estilos no tiene ni una regla para pantallas pequeñas. La web se ve igual en un móvil que en un monitor, encogida.', dato, arregla: 'Hace falta rehacer el diseño como adaptable, o cambiar a una plantilla que ya lo sea. No es un retoque.', esfuerzo: 'encargo' })
      },
    },

    {
      id: 'zoom',
      titulo: 'Se puede ampliar con los dedos',
      peso: 2,
      mira(p) {
        const v = p.metas.viewport || ''
        if (!v) return sinMirar('Sin etiqueta de pantalla no podemos juzgar el zoom.')
        const bloqueado = /user-scalable\s*=\s*(no|0)/i.test(v) || /maximum-scale\s*=\s*1(\.0)?\b/i.test(v)
        if (bloqueado) {
          return aviso({ dice: 'Has bloqueado el zoom. Quien no ve bien de cerca no puede ampliar tu carta ni tus precios, y es media clientela mayor de cuarenta y cinco años.', dato: muestra(v), arregla: 'Quita «user-scalable=no» y «maximum-scale=1» de la etiqueta viewport.', esfuerzo: 'minutos' })
        }
        return ok({ dice: 'Se puede ampliar con los dedos.', dato: muestra(v) })
      },
    },

    {
      id: 'ancho-fijo',
      titulo: 'Nada tiene un ancho fijo de escritorio',
      peso: 3,
      mira(p) {
        const css = `${p.estilos}\n${p.extras.css?.ok ? p.extras.css.texto : ''}`
        const enEstilos = [...css.matchAll(/width\s*:\s*(\d{3,4})px/gi)].map((m) => Number(m[1])).filter((n) => n > 480)
        const enLinea = [...p.html.matchAll(/style=["'][^"']*width\s*:\s*(\d{3,4})px/gi)].map((m) => Number(m[1])).filter((n) => n > 480)
        const tablas = (p.body.match(/<table[^>]+width\s*=\s*["']?\d{3,}/gi) || []).length
        const total = enEstilos.length + enLinea.length + tablas
        const dato = total ? `${total} ancho(s) fijo(s) mayores de 480px${tablas ? `, ${tablas} en tablas` : ''}` : 'Ninguno'
        if (!total) return ok({ dice: 'No hay anchos fijos que obliguen a desplazarse en horizontal.', dato })
        if (total <= 2) return aviso({ dice: 'Hay algún elemento con ancho fijo: en un móvil se sale de la pantalla y obliga a arrastrar de lado.', dato, arregla: 'Cambia esos «width: 900px» por «max-width: 900px; width: 100%».', esfuerzo: 'rato' })
        return fallo({ dice: 'Hay varios bloques con ancho de escritorio clavado. En el móvil, la página se sale por la derecha.', dato, arregla: 'Sustituye los anchos fijos por «max-width» con «width: 100%», y las tablas de maquetación por bloques.', esfuerzo: 'encargo' })
      },
    },

    {
      id: 'texto-legible',
      titulo: 'El texto se lee sin acercarse',
      peso: 2,
      mira(p) {
        const css = `${p.estilos}\n${p.extras.css?.ok ? p.extras.css.texto : ''}\n${(p.html.match(/style=["'][^"']*["']/gi) || []).join(' ')}`
        if (!css.trim()) return sinMirar('No hemos podido leer los estilos.')
        const pequenos = [...css.matchAll(/font-size\s*:\s*(\d{1,2}(?:\.\d+)?)px/gi)].map((m) => Number(m[1])).filter((n) => n < 12)
        if (!pequenos.length) return ok({ dice: 'No encontramos texto declarado por debajo del tamaño legible.', dato: 'Nada por debajo de 12px' })
        const dato = `${pequenos.length} declaración(es) de ${Math.min(...pequenos)}px o menos`
        if (pequenos.length <= 3) return aviso({ dice: 'Hay texto muy pequeño. Suele ser el aviso legal o el pie, que es justo donde está lo que te obliga la ley a que se lea.', dato, arregla: 'Sube el tamaño mínimo a 14px; 16px para el texto normal.', esfuerzo: 'rato' })
        return fallo({ dice: 'Buena parte del texto está declarado por debajo de lo legible en un móvil.', dato, arregla: 'Pon 16px como tamaño base y no bajes de 14px en ningún sitio.', esfuerzo: 'tarde' })
      },
    },

    {
      id: 'imagenes-adaptables',
      titulo: 'Las fotos se sirven al tamaño del móvil',
      peso: 2,
      mira(p) {
        const conUrl = p.imagenes.filter((i) => i.url)
        if (conUrl.length < 3) return sinMirar('Hay muy pocas imágenes para juzgarlo.')
        const adaptables = conUrl.filter((i) => i.srcset).length
        const dato = `${adaptables} de ${conUrl.length} imágenes con varias versiones según la pantalla`
        if (adaptables >= conUrl.length / 2) return ok({ dice: 'Sirves versiones distintas de las fotos según la pantalla: el móvil no se descarga la de 2000 píxeles.', dato })
        return aviso({ dice: 'El móvil se descarga las mismas fotos enormes que el ordenador y luego las encoge. Son megas de datos tirados en cada visita.', dato, arregla: 'Usa srcset con dos o tres tamaños. Casi cualquier gestor lo genera solo al subir la imagen.', esfuerzo: 'encargo' })
      },
    },

    {
      id: 'obsoleto',
      titulo: 'Nada que un móvil no pueda abrir',
      peso: 1,
      mira(p) {
        const encontrados = []
        if (/<frameset|<frame\b/i.test(p.html)) encontrados.push('marcos (frames)')
        if (/application\/x-shockwave-flash|\.swf\b/i.test(p.html)) encontrados.push('Flash')
        if (/<marquee|<blink/i.test(p.html)) encontrados.push('texto en movimiento antiguo')
        if (/<applet\b/i.test(p.html)) encontrados.push('applets de Java')
        if (!encontrados.length) return ok({ dice: 'No hay tecnologías que el móvil no sepa abrir.', dato: 'Nada obsoleto' })
        return fallo({ dice: 'Tu web usa cosas que ningún móvil puede enseñar: ahí se ve un hueco en blanco.', dato: encontrados.join(', '), arregla: 'Sustituye esas partes por HTML y vídeo normales.', esfuerzo: 'encargo' })
      },
    },
  ],
}

export default area
