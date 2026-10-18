/**
 * Area 2 — Cuanto tarda.
 *
 * Una advertencia que el informe repite y que conviene tener clara aqui: esto
 * **no es una medida de navegador**. No abrimos Chrome ni calculamos un LCP.
 * Lo que medimos es lo que tarda tu servidor en contestar y lo que pesa y
 * estorba el HTML que manda. Es un trozo del problema, pero es el trozo que
 * depende de ti y el unico que se puede medir honradamente desde fuera.
 *
 * Por que importa tanto en Mikro: el trafico de un creador no llega en goteo,
 * llega de golpe. Dos mil personas en veinte minutos, casi todas desde el
 * movil y desde datos moviles, con la paciencia de quien estaba viendo
 * stories. Una web que tarda cuatro segundos no pierde el 10% de esa gente:
 * pierde la mitad, y la empresa concluye que los creadores no funcionan.
 */
import { aviso, fallo, muestra, ok, sinMirar } from '../comprobacion.js'
import { dominio } from '../html.js'

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`

const area = {
  id: 'velocidad',
  nombre: 'Cuánto tarda',
  peso: 18,
  descripcion: 'Lo que tarda tu servidor y lo que estorba antes de pintar nada.',
  comprobaciones: [
    {
      id: 'respuesta',
      titulo: 'Lo que tarda tu servidor en contestar',
      peso: 5,
      mira(p) {
        const ms = p.ms.cabeceras
        if (ms == null) return sinMirar('No hemos podido cronometrar la respuesta.')
        const dato = `${ms} ms hasta la primera respuesta`
        if (ms <= 600) return ok({ dice: 'Tu servidor contesta rápido. Lo que tarde la página a partir de aquí ya no es culpa del hosting.', dato })
        if (ms <= 1500) {
          return aviso({
            dice: 'Tu servidor tarda en arrancar. Ese tiempo se suma a todo lo demás: la página no puede ir más rápido que esto.',
            dato,
            arregla: 'Pregunta a tu hosting si tienes caché de página activada. En WordPress, un plugin de caché (WP Rocket, LiteSpeed) suele bajarlo a menos de 300 ms.',
            esfuerzo: 'encargo',
          })
        }
        return fallo({
          dice: 'Tu servidor tarda más de un segundo y medio solo en empezar a contestar. Antes de que se pinte una letra, ya has perdido gente.',
          dato,
          arregla: 'Es casi siempre el alojamiento. Activa caché de página y, si sigue igual, cambia a un hosting con SSD y PHP moderno: son 10-20 € al mes.',
          esfuerzo: 'encargo',
        })
      },
    },

    {
      id: 'bloqueo',
      titulo: 'Lo que hay que descargar antes de ver nada',
      peso: 4,
      mira(p) {
        const scripts = p.scripts.filter((s) => s.src && s.enCabeza && !s.async && !s.defer && !s.modulo)
        const hojas = p.hojas.filter((h) => h.bloquea)
        const total = scripts.length + hojas.length
        const dato = `${hojas.length} hoja(s) de estilo y ${scripts.length} script(s) que bloquean el pintado`
        if (total <= 3) return ok({ dice: 'El navegador tiene poco que esperar antes de empezar a pintar.', dato })
        if (total <= 6) {
          return aviso({ dice: 'Hay bastantes ficheros que el navegador tiene que descargar entero antes de enseñar nada.', dato, arregla: 'Añade «defer» a los scripts del <head> que no pinten nada (casi todos) y junta las hojas de estilo.', esfuerzo: 'encargo' })
        }
        return fallo({
          dice: 'El navegador tiene que descargar una pila de ficheros antes de pintar la primera letra. En un móvil con datos, eso son segundos de pantalla en blanco.',
          dato,
          arregla: 'Pon «defer» en todos los scripts del <head> y reduce las hojas de estilo a una. Si la web es de WordPress, un plugin de optimización hace las dos cosas.',
          esfuerzo: 'encargo',
        })
      },
    },

    {
      id: 'peso-html',
      titulo: 'Lo que pesa la página',
      peso: 3,
      mira(p) {
        if (p.cortado) return aviso({ dice: 'Tu HTML pesa más de 2 MB: hemos dejado de descargarlo. Eso es muchísimo para un documento de texto.', dato: 'Más de 2 MB de HTML', arregla: 'Casi siempre son imágenes metidas en el propio HTML en base64, o una página que carga el catálogo entero. Sepáralas en ficheros.', esfuerzo: 'encargo' })
        const dato = kb(p.bytes)
        if (p.bytes <= 120_000) return ok({ dice: 'El HTML tiene un peso razonable.', dato })
        if (p.bytes <= 300_000) return aviso({ dice: 'El HTML pesa más de lo normal. Suele ser contenido oculto que se descarga igual aunque no se vea.', dato, arregla: 'Mira si estás cargando menús, modales o el catálogo completo en cada página.', esfuerzo: 'encargo' })
        return fallo({ dice: 'El HTML pesa demasiado: antes de descargar una sola imagen ya has gastado el tiempo.', dato, arregla: 'Quita del HTML lo que no se ve en pantalla y saca las imágenes incrustadas en base64 a ficheros aparte.', esfuerzo: 'encargo' })
      },
    },

    {
      id: 'compresion',
      titulo: 'La página viaja comprimida',
      peso: 3,
      mira(p) {
        const ce = (p.cabeceras['content-encoding'] || '').toLowerCase()
        if (/br|gzip|deflate|zstd/.test(ce)) return ok({ dice: 'Tu servidor comprime la página: viaja entre tres y cinco veces más ligera.', dato: ce })
        if (p.bytes < 15_000) return ok({ dice: 'La página es tan pequeña que comprimir no cambiaría nada.', dato: kb(p.bytes) })
        return fallo({
          dice: 'Tu servidor manda la página sin comprimir. Estás enviando tres o cuatro veces más datos de los necesarios a cada visita.',
          dato: `Sin Content-Encoding, ${kb(p.bytes)} en crudo`,
          arregla: 'Activa gzip o brotli en el servidor. En Apache es el módulo deflate; en Nginx, «gzip on». Tu hosting lo activa en un minuto.',
          esfuerzo: 'encargo',
        })
      },
    },

    {
      id: 'terceros',
      titulo: 'Los programas de otros que carga tu web',
      peso: 3,
      mira(p) {
        const hosts = [...new Set(p.scripts.filter((s) => s.url && !s.propio).map((s) => dominio(s.url)).filter(Boolean))]
        const dato = hosts.length ? `${hosts.length}: ${muestra(hosts.join(', '), 180)}` : 'Ninguno'
        if (hosts.length <= 4) return ok({ dice: 'Cargas pocos servicios externos.', dato })
        if (hosts.length <= 8) return aviso({ dice: 'Cada servicio externo es una conexión más que abrir y un trozo más de código que ejecutar en el móvil de tu cliente.', dato, arregla: 'Repasa la lista y quita lo que ya no uses: chats que probaste, mapas de calor, plugins antiguos.', esfuerzo: 'rato' })
        return fallo({ dice: 'Tu web carga programas de demasiados sitios distintos. Es la causa número uno de que una web vaya lenta en el móvil aunque el servidor sea rápido.', dato, arregla: 'Quédate con la analítica y el chat si lo usas. Todo lo demás, fuera: cada uno cuesta entre 100 y 500 ms.', esfuerzo: 'tarde' })
      },
    },

    {
      id: 'imagenes-diferidas',
      titulo: 'Las imágenes de abajo esperan su turno',
      peso: 2,
      mira(p) {
        if (p.imagenes.length < 4) return sinMirar('Hay muy pocas imágenes para que esto cambie algo.')
        const diferidas = p.imagenes.filter((i) => i.carga === 'lazy').length
        const dato = `${diferidas} de ${p.imagenes.length} imágenes se cargan solo al llegar a ellas`
        if (diferidas >= p.imagenes.length - 2) return ok({ dice: 'Las imágenes de abajo no retrasan a las de arriba.', dato })
        if (diferidas > 0) return aviso({ dice: 'Parte de las imágenes se descargan desde el principio aunque estén al final de la página.', dato, arregla: 'Pon loading="lazy" en todas menos en la primera que se ve al entrar.', esfuerzo: 'rato' })
        return aviso({ dice: 'Todas las imágenes se descargan a la vez, estén donde estén. Quien entra paga el pie de página antes de ver la cabecera.', dato, arregla: 'Añade loading="lazy" a todas las imágenes salvo la principal.', esfuerzo: 'rato' })
      },
    },

    {
      id: 'imagenes-medidas',
      titulo: 'Las imágenes reservan su hueco',
      peso: 2,
      mira(p) {
        if (!p.imagenes.length) return sinMirar('No hemos encontrado imágenes en el HTML.')
        const sin = p.imagenes.filter((i) => !i.ancho || !i.alto)
        const dato = `${sin.length} de ${p.imagenes.length} imágenes sin ancho y alto declarados`
        if (!sin.length) return ok({ dice: 'Las imágenes reservan su sitio: la página no pega saltos mientras carga.', dato })
        if (sin.length <= p.imagenes.length / 3) return aviso({ dice: 'Algunas imágenes no reservan su hueco y empujan el contenido al cargar.', dato, arregla: 'Pon width y height en el <img>. Aunque el CSS mande, el navegador usa la proporción para reservar el espacio.', esfuerzo: 'rato' })
        return fallo({ dice: 'La página da saltos mientras carga: alguien va a pulsar un botón que se le mueve debajo del dedo.', dato, arregla: 'Añade width y height a cada <img> con las medidas reales del fichero.', esfuerzo: 'tarde' })
      },
    },

    {
      id: 'imagenes-formato',
      titulo: 'El formato de las imágenes',
      peso: 2,
      mira(p) {
        const conUrl = p.imagenes.filter((i) => i.url)
        if (conUrl.length < 3) return sinMirar('Hay muy pocas imágenes para juzgar el formato.')
        const modernas = conUrl.filter((i) => /\.(webp|avif)(\?|$)/i.test(i.url) || /\.(webp|avif)/i.test(i.srcset || '')).length
        const pesadas = conUrl.filter((i) => /\.(png|bmp|tiff?)(\?|$)/i.test(i.url)).length
        const dato = `${modernas} en WebP o AVIF, ${pesadas} en PNG o similar, de ${conUrl.length}`
        if (modernas >= conUrl.length / 2) return ok({ dice: 'Usas formatos modernos: las mismas fotos pesando la mitad.', dato })
        if (pesadas > conUrl.length / 2) return fallo({ dice: 'Tus fotos van en formatos que pesan el doble o el triple de lo necesario.', dato, arregla: 'Convierte las fotografías a WebP. Hay plugins que lo hacen de golpe con todo el catálogo.', esfuerzo: 'tarde' })
        return aviso({ dice: 'Casi ninguna imagen usa formatos modernos.', dato, arregla: 'Pasa las fotos a WebP: se ven igual y pesan la mitad.', esfuerzo: 'tarde' })
      },
    },

    {
      id: 'redirecciones',
      titulo: 'Los saltos hasta llegar a tu web',
      peso: 2,
      mira(p) {
        const n = p.redirecciones.length
        const dato = n ? p.redirecciones.map((r) => `${r.estado} → ${r.a}`).join(' · ') : 'Ninguno'
        if (n <= 1) return ok({ dice: n ? 'Un solo salto, el normal para llevar a todo el mundo a la dirección buena.' : 'Se llega directo, sin saltos.', dato })
        if (n === 2) return aviso({ dice: 'Dos saltos antes de empezar a cargar. Cada uno cuesta un viaje de ida y vuelta al servidor.', dato, arregla: 'Haz que la redirección sea directa: de http sin www a https con www (o al revés) en un solo paso.', esfuerzo: 'encargo' })
        return fallo({ dice: 'Tu web encadena saltos antes de cargar nada. Medio segundo regalado en cada visita, y más en el móvil.', dato, arregla: 'Deja una sola redirección que vaya directamente a la dirección final.', esfuerzo: 'encargo' })
      },
    },

    {
      id: 'fuentes',
      titulo: 'Las tipografías que descargas',
      peso: 1,
      mira(p) {
        const enlaces = p.enlacesCabeza.filter((l) => /fonts\.(googleapis|gstatic)\.com|\.woff2?(\?|$)/i.test(l.href || ''))
        const familias = (p.enlacesCabeza.map((l) => l.href || '').join('&').match(/family=([^&:"']+)/g) || []).length
        const dato = familias ? `${familias} familia(s) de Google Fonts` : `${enlaces.length} recurso(s) de tipografía`
        if (familias > 3) return aviso({ dice: 'Cargas demasiadas tipografías. Cada una es un fichero más y un parpadeo más de texto cambiando de forma.', dato, arregla: 'Quédate con una o dos familias y solo con los grosores que de verdad usas.', esfuerzo: 'encargo' })
        return ok({ dice: 'Las tipografías no son un problema aquí.', dato })
      },
    },
  ],
}

export default area
