/**
 * Area 1 — Que te encuentren.
 *
 * Lo basico para que Google sepa que existes y para que, cuando alguien
 * busque lo que vendes, salga tu ficha y no la de al lado. No es una
 * auditoria SEO completa (eso necesita rastrear el sitio entero y ver a la
 * competencia); es el suelo: las cosas que, si faltan, hacen que el resto del
 * trabajo no sirva de nada.
 *
 * Pesa 12 sobre 100 a proposito. El SEO es el canal mas lento de todos y el
 * que menos tiene que ver con lo que Mikro trae: una campana con un creador
 * mete visitas manana, no en seis meses. Pero un `noindex` olvidado despues
 * de un rediseno es el fallo mas caro y mas invisible que existe, y por eso
 * esa comprobacion sola pesa lo que cinco.
 */
import { aviso, fallo, muestra, ok, segun, sinMirar } from '../comprobacion.js'
import { tieneTipo } from '../html.js'

const area = {
  id: 'encontrar',
  nombre: 'Que te encuentren',
  peso: 12,
  descripcion: 'Si Google puede verte y qué entiende de ti.',
  comprobaciones: [
    {
      id: 'indexable',
      titulo: 'Google tiene permiso para mostrarte',
      peso: 5,
      mira(p) {
        const robots = `${p.metas.robots || ''} ${p.metas.googlebot || ''}`.toLowerCase()
        const cabecera = (p.cabeceras['x-robots-tag'] || '').toLowerCase()
        const bloqueado = /noindex/.test(robots) || /noindex/.test(cabecera)
        if (bloqueado) {
          return fallo({
            dice: 'Tu web le está diciendo a Google que no la enseñe. Hoy no apareces en ninguna búsqueda, y no es un problema de posicionamiento: es una orden tuya.',
            dato: /noindex/.test(cabecera) ? `Cabecera X-Robots-Tag: ${cabecera}` : `<meta name="robots" content="${muestra(p.metas.robots || p.metas.googlebot)}">`,
            arregla: 'Quita el "noindex". Suele quedarse puesto de cuando la web estaba en construcción; en WordPress es la casilla «Disuadir a los motores de búsqueda» en Ajustes → Lectura.',
            esfuerzo: 'minutos',
          })
        }
        return ok({ dice: 'Nada impide que Google te indexe.', dato: p.metas.robots ? `robots: ${muestra(p.metas.robots)}` : 'Sin restricciones' })
      },
    },

    {
      id: 'titulo',
      titulo: 'El título que sale en Google',
      peso: 4,
      mira(p) {
        const t = (p.titulo || '').trim()
        if (!t) {
          return fallo({
            dice: 'No tienes título. En los resultados de Google aparecerá tu dirección a secas, y en la pestaña del navegador, nada.',
            arregla: 'Pon un <title> de 50 a 60 caracteres con lo que haces y dónde: «Panadería de masa madre en Valencia | La Espiga».',
            esfuerzo: 'minutos',
          })
        }
        const dato = `${muestra(t)} (${t.length} caracteres)`
        if (t.length < 15) {
          return aviso({ dice: 'El título es tan corto que no dice qué haces ni dónde.', dato, arregla: 'Amplíalo a 50-60 caracteres: qué vendes, para quién y en qué ciudad.', esfuerzo: 'minutos' })
        }
        if (t.length > 65) {
          return aviso({ dice: 'Google va a cortar el título a mitad de frase.', dato, arregla: 'Déjalo en 60 caracteres y pon lo importante al principio.', esfuerzo: 'minutos' })
        }
        if (/^(inicio|home|index|bienvenid)/i.test(t) && t.length < 30) {
          return aviso({ dice: '«Inicio» no es un título: no le dice nada a quien busca lo que tú vendes.', dato, arregla: 'Cambia «Inicio» por lo que haces y dónde lo haces.', esfuerzo: 'minutos' })
        }
        return ok({ dice: 'Tienes un título con la longitud adecuada.', dato })
      },
    },

    {
      id: 'descripcion',
      titulo: 'El texto que acompaña al título en Google',
      peso: 3,
      mira(p) {
        const d = (p.metas.description || '').trim()
        if (!d) {
          return fallo({
            dice: 'Sin descripción, Google se inventa el resumen cogiendo un trozo cualquiera de la página. A veces coge el menú de cookies.',
            arregla: 'Añade <meta name="description"> con 120-155 caracteres: qué ofreces y por qué llamarte a ti.',
            esfuerzo: 'minutos',
          })
        }
        const dato = `${muestra(d)} (${d.length} caracteres)`
        if (d.length < 50) return aviso({ dice: 'La descripción se queda corta y desaprovecha el espacio que Google te da gratis.', dato, arregla: 'Llévala a 120-155 caracteres y acaba con una invitación («Pide cita», «Mira la carta»).', esfuerzo: 'minutos' })
        if (d.length > 170) return aviso({ dice: 'La descripción se corta en los resultados.', dato, arregla: 'Recórtala a 155 caracteres.', esfuerzo: 'minutos' })
        return ok({ dice: 'La descripción tiene la longitud que Google enseña entera.', dato })
      },
    },

    {
      id: 'h1',
      titulo: 'El titular de la página',
      peso: 3,
      mira(p) {
        if (p.renderizadoEnCliente) return sinMirar('Tu web pinta el contenido con JavaScript y no podemos leer los titulares sin un navegador.')
        if (!p.h1.length) {
          return aviso({
            dice: 'No hay titular principal. Es la primera frase que lee tanto Google como quien entra: sin ella, la página empieza sin decir qué es.',
            arregla: 'Pon un <h1> arriba con lo que haces, en las palabras que usaría un cliente.',
            esfuerzo: 'rato',
          })
        }
        if (p.h1.length > 1) {
          return aviso({
            dice: 'Hay varios titulares principales compitiendo entre ellos.',
            dato: p.h1.slice(0, 3).map((h) => `«${muestra(h, 60)}»`).join(' · '),
            arregla: 'Deja un solo <h1> y baja los demás a <h2>.',
            esfuerzo: 'rato',
          })
        }
        return ok({ dice: 'Tienes un titular principal claro.', dato: `«${muestra(p.h1[0], 90)}»` })
      },
    },

    {
      id: 'datos-estructurados',
      titulo: 'La ficha que Google lee de ti',
      peso: 3,
      mira(p) {
        const bloques = p.jsonLd.filter((b) => !b.roto)
        const rotos = p.jsonLd.filter((b) => b.roto).length
        if (rotos && !bloques.length) {
          return fallo({ dice: 'Tienes datos estructurados pero están mal escritos y Google no puede leerlos.', dato: `${rotos} bloque(s) JSON-LD con errores de sintaxis`, arregla: 'Pásalos por el validador de resultados enriquecidos de Google y corrige el JSON.', esfuerzo: 'encargo' })
        }
        if (!bloques.length) {
          return aviso({
            dice: 'No le dices a Google qué eres. Sin esto no puedes salir con horario, dirección, teléfono ni estrellas en los resultados: solo con un enlace azul.',
            arregla: 'Añade un JSON-LD de tipo LocalBusiness (o Organization) con nombre, dirección, teléfono y horario. En WordPress lo hacen Rank Math o Yoast con un formulario.',
            esfuerzo: 'tarde',
          })
        }
        const tipos = [...new Set(bloques.flatMap((b) => (Array.isArray(b['@type']) ? b['@type'] : [b['@type']])).filter(Boolean))]
        const local = tieneTipo(bloques, 'LocalBusiness', 'Restaurant', 'Store', 'Organization', 'Bakery', 'BeautySalon', 'HealthAndBeautyBusiness', 'ProfessionalService')
        if (!local) {
          return aviso({ dice: 'Tienes datos estructurados, pero ninguno describe al negocio en sí.', dato: tipos.join(', '), arregla: 'Añade un bloque LocalBusiness u Organization con dirección, teléfono y horario.', esfuerzo: 'rato' })
        }
        return ok({ dice: 'Google tiene una ficha de tu negocio que puede enseñar con dirección y horario.', dato: tipos.join(', ') })
      },
    },

    {
      id: 'robots-txt',
      titulo: 'El fichero que da o quita permiso a los buscadores',
      peso: 2,
      mira(p) {
        const r = p.extras.robots
        if (!r) return sinMirar('No hemos podido leer tu robots.txt.')
        if (!r.ok) return aviso({ dice: 'No tienes robots.txt. No es grave, pero es donde se declara el sitemap y se deja fuera lo que no debe indexarse.', dato: `${r.estado} en /robots.txt`, arregla: 'Crea un robots.txt con «User-agent: *» y la línea «Sitemap: https://tudominio.es/sitemap.xml».', esfuerzo: 'rato' })
        const bloqueaTodo = /^\s*user-agent:\s*\*\s*$[\s\S]*?^\s*disallow:\s*\/\s*$/im.test(r.texto)
        if (bloqueaTodo) {
          return fallo({ dice: 'Tu robots.txt le prohíbe la entrada a todos los buscadores. Es la puerta cerrada por dentro.', dato: muestra(r.texto, 200), arregla: 'Quita la línea «Disallow: /» del bloque «User-agent: *».', esfuerzo: 'minutos' })
        }
        return ok({ dice: 'Tu robots.txt deja pasar a los buscadores.', dato: muestra(r.texto, 140) })
      },
    },

    {
      id: 'canonical',
      titulo: 'Cuál es la dirección buena de esta página',
      peso: 2,
      mira(p) {
        const c = p.enlacesCabeza.find((l) => l.rels.includes('canonical'))
        if (!c) return aviso({ dice: 'Sin canónica, la misma página con y sin «www», con «/» final o con parámetros de campaña cuenta como páginas distintas y se reparten la fuerza.', arregla: 'Añade <link rel="canonical" href="https://tudominio.es/"> en el <head> de cada página, apuntando a sí misma.', esfuerzo: 'encargo' })
        if (!c.url) return aviso({ dice: 'La canónica está mal formada.', dato: muestra(c.href), arregla: 'Pon la URL absoluta completa, empezando por https://.', esfuerzo: 'minutos' })
        return ok({ dice: 'Declaras cuál es la dirección buena de esta página.', dato: c.url })
      },
    },

    {
      id: 'sitemap',
      titulo: 'El mapa del sitio',
      peso: 2,
      mira(p) {
        const declarado = p.extras.robots?.ok && /sitemap:\s*https?:\/\//i.test(p.extras.robots.texto)
        const existe = p.extras.sitemap?.ok
        if (existe || declarado) return ok({ dice: 'Los buscadores tienen la lista de tus páginas.', dato: existe ? '/sitemap.xml responde' : 'Declarado en robots.txt' })
        if (!p.extras.sitemap) return sinMirar('No hemos podido comprobar el sitemap.')
        return aviso({ dice: 'No encontramos el mapa del sitio. Google acabará descubriendo tus páginas, pero tarda más y se deja las que no tienen enlaces.', dato: `${p.extras.sitemap.estado} en /sitemap.xml`, arregla: 'Genera un sitemap.xml (cualquier gestor lo hace solo) y decláralo en robots.txt.', esfuerzo: 'rato' })
      },
    },

    {
      id: 'idioma',
      titulo: 'El idioma declarado',
      peso: 2,
      mira(p) {
        // El `lang=""` de una plantilla multiidioma a medio configurar es un
        // caso aparte: la etiqueta esta, pero no declara nada. Lo vimos en una
        // cadena grande y merece su propio mensaje, porque se arregla distinto.
        if (/<html[^>]*\blang\s*=\s*["']\s*["']/i.test(p.html)) {
          return aviso({
            dice: 'Declaras el idioma pero lo dejas en blanco, que para el navegador es lo mismo que no declararlo.',
            dato: 'lang=""',
            arregla: 'Pon <html lang="es"> en cada página, con el idioma que corresponda a esa versión.',
            esfuerzo: 'minutos',
          })
        }
        const m = /<html[^>]*\blang\s*=\s*["']?([a-z]{2}[a-z-]*)/i.exec(p.html)
        if (!m) return aviso({ dice: 'No declaras el idioma. Afecta a cómo te lee un lector de pantalla y a si el navegador ofrece traducir tu web a tus propios clientes.', arregla: 'Pon <html lang="es"> (o «es-ES»).', esfuerzo: 'minutos' })
        return ok({ dice: 'El idioma está declarado.', dato: m[1] })
      },
    },

    {
      id: 'textos-de-imagen',
      titulo: 'Las imágenes tienen descripción',
      peso: 2,
      mira(p) {
        if (!p.imagenes.length) return sinMirar('No hemos encontrado imágenes en el HTML.')
        const sin = p.imagenes.filter((i) => !i.tieneAlt)
        const porcentaje = Math.round((sin.length / p.imagenes.length) * 100)
        const dato = `${sin.length} de ${p.imagenes.length} imágenes sin texto alternativo`
        if (!sin.length) return ok({ dice: 'Todas tus imágenes tienen descripción: las lee Google y las lee quien usa lector de pantalla.', dato })
        if (porcentaje <= 30) return aviso({ dice: 'Algunas imágenes no tienen descripción.', dato, arregla: 'Añade el atributo alt describiendo lo que se ve. Las decorativas llevan alt="" vacío.', esfuerzo: 'rato' })
        return fallo({ dice: 'La mayoría de tus imágenes no tienen descripción: para Google y para un lector de pantalla, ahí no hay nada.', dato, arregla: 'Añade alt a las imágenes con contenido y alt="" a las decorativas.', esfuerzo: 'tarde' })
      },
    },

    {
      id: 'favicon',
      titulo: 'El iconito de la pestaña',
      peso: 1,
      mira(p) {
        const icono = p.enlacesCabeza.find((l) => l.rels.some((r) => r === 'icon' || r === 'shortcut' || r === 'apple-touch-icon'))
        if (icono) return ok({ dice: 'Tienes icono: se te reconoce entre veinte pestañas y en los marcadores.', dato: icono.url || icono.href })
        return aviso({ dice: 'Sin icono, tu pestaña es un folio en blanco entre las demás.', arregla: 'Sube un favicon.ico o un PNG de 180×180 y enlázalo con <link rel="icon">.', esfuerzo: 'rato' })
      },
    },
  ],
}

export default area
