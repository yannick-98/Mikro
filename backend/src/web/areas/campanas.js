/**
 * Area 6 — Lista para una campana.
 *
 * Esta area no la mide ningun analizador de webs, y es la que de verdad
 * contesta a la pregunta que trae aqui a una pyme: si manana contrato a tres
 * creadores, ¿mi web aguanta y me entero de lo que ha pasado?
 *
 * Son cuatro cosas, y las cuatro fallan en silencio:
 *
 *  1. **Como se ve tu enlace cuando alguien lo comparte.** Sin imagen de
 *     Open Graph, el creador pega tu direccion en una story y sale un
 *     rectangulo gris. Ese es el soporte por el que has pagado.
 *  2. **Si mides algo.** Sin analitica, dentro de un mes la pregunta "¿valio
 *     la pena?" no tiene respuesta posible, y la empresa decide por la
 *     sensacion que tenga ese dia.
 *  3. **Si los parametros de campana sobreviven.** Muchas webs redirigen y
 *     se comen la cadena `?utm_source=...`. Entonces todas las visitas
 *     aparecen como "directo" y la campana parece no haber traido a nadie.
 *     Es el fallo mas caro que existe porque no se nota: se nota al reves,
 *     concluyendo que los creadores no funcionan.
 *  4. **Si se puede atribuir una venta a una persona.** Un codigo de
 *     descuento por creador es la unica forma barata de saber quien vendio.
 */
import { aviso, fallo, muestra, ok, sinMirar } from '../comprobacion.js'

const area = {
  id: 'campanas',
  nombre: 'Lista para una campaña',
  peso: 13,
  descripcion: 'Si tu web aguanta el tráfico de un creador y te enteras de lo que trajo.',
  comprobaciones: [
    {
      id: 'vista-previa',
      titulo: 'Cómo se ve tu enlace cuando lo comparten',
      peso: 5,
      mira(p) {
        const t = p.metas['og:title'] || p.metas['twitter:title']
        const d = p.metas['og:description'] || p.metas['twitter:description']
        const i = p.metas['og:image'] || p.metas['twitter:image']
        const faltan = [!t && 'título', !d && 'descripción', !i && 'imagen'].filter(Boolean)
        if (!faltan.length) {
          return ok({ dice: 'Cuando un creador comparta tu enlace saldrá con imagen, título y texto: una tarjeta que se mira.', dato: `${muestra(t, 70)} — imagen: ${muestra(i, 70)}` })
        }
        if (!i) {
          return fallo({
            dice: 'Tu enlace no tiene imagen de vista previa. Compartido en una story o en WhatsApp sale como un rectángulo gris con una dirección. Has pagado por una recomendación y la enseñas en blanco.',
            dato: `Faltan: ${faltan.join(', ')}`,
            arregla: 'Añade en el <head>: <meta property="og:image" content="https://tudominio.es/portada.jpg"> con una imagen de 1200×630. Y og:title y og:description con el mismo texto que tu título y tu descripción.',
            esfuerzo: 'rato',
          })
        }
        return aviso({ dice: 'Tienes imagen de vista previa pero le falta parte del texto.', dato: `Faltan: ${faltan.join(', ')}`, arregla: 'Completa og:title y og:description en el <head>.', esfuerzo: 'minutos' })
      },
    },

    {
      id: 'analitica',
      titulo: 'Puedes saber lo que trae cada campaña',
      peso: 5,
      mira(p) {
        const a = p.huellas.analiticas
        if (!a.length) {
          return fallo({
            dice: 'No tienes analítica. Si mañana contratas a un creador, dentro de un mes no vas a poder decir si vino alguien: solo si te «pareció» que hubo más movimiento. Así es imposible saber a quién repetir.',
            arregla: 'Instala Google Analytics 4 (gratis) o Plausible (de pago, más simple y sin necesidad de consentimiento). Media hora y lo tienes para siempre.',
            esfuerzo: 'tarde',
          })
        }
        const soloAntigua = a.length === 1 && a[0].id === 'ua'
        if (soloAntigua) {
          return fallo({ dice: 'Tienes la versión antigua de Google Analytics, que dejó de recoger datos en 2023. Está puesta pero no mide nada.', dato: a[0].nombre, arregla: 'Migra a Google Analytics 4: el código viejo (UA-) ya no sirve.', esfuerzo: 'tarde' })
        }
        return ok({ dice: 'Mides las visitas: podrás ver qué trajo cada campaña.', dato: a.map((x) => x.nombre).join(', ') })
      },
    },

    {
      id: 'parametros',
      titulo: 'Tu web conserva las etiquetas de campaña',
      peso: 4,
      mira(p) {
        const u = p.extras.utm
        if (!u) return sinMirar('No hemos podido probar tu web con parámetros de campaña.')
        if (!u.ok) {
          return fallo({
            dice: 'Tu web da error cuando le llegan los parámetros con los que viaja el tráfico de una campaña. Todas esas visitas aterrizan en una página rota.',
            dato: `Error ${u.estado} con ?utm_source=mikro`,
            arregla: 'Es casi siempre una regla del servidor o una caché demasiado estricta. Quien lleve la web tiene que permitir los parámetros utm_.',
            esfuerzo: 'encargo',
          })
        }
        if (!u.conserva) {
          return fallo({
            dice: 'Tu web se come las etiquetas de campaña por el camino. Las visitas que te traiga un creador llegarán como «tráfico directo» y en la analítica parecerá que la campaña no trajo a nadie.',
            dato: `?${'utm_source=mikro'} acaba en ${muestra(u.destino, 90)}`,
            arregla: 'Alguna redirección está quitando la parte de «?» de la dirección. Hay que corregirla para que arrastre los parámetros.',
            esfuerzo: 'encargo',
          })
        }
        if (u.saltos > 0) return ok({ dice: 'Las etiquetas de campaña sobreviven a las redirecciones.', dato: `Conservadas tras ${u.saltos} salto(s)` })
        return ok({ dice: 'Tu web conserva las etiquetas: vas a poder medir qué trajo cada creador.', dato: 'Probado con ?utm_source=mikro&utm_medium=creador' })
      },
    },

    {
      id: 'pixel',
      titulo: 'Puedes volver a hablarle a quien te visitó',
      peso: 3,
      mira(p) {
        if (p.huellas.pixeles.length) {
          return ok({ dice: 'Tienes píxel: lo que traiga una campaña se puede reaprovechar después en publicidad.', dato: p.huellas.pixeles.map((x) => x.nombre).join(', ') })
        }
        return aviso({
          dice: 'No tienes ningún píxel. Las visitas que traiga un creador entran, miran y se van sin dejar rastro: no podrás volver a alcanzarlas.',
          arregla: 'Instala el píxel de Meta (y el de TikTok si vas a trabajar ahí). Es gratis y se configura desde el administrador de anuncios.',
          esfuerzo: 'tarde',
        })
      },
    },

    {
      id: 'atribucion-de-venta',
      titulo: 'Se puede saber qué creador vendió',
      peso: 3,
      mira(p) {
        const tienda = p.huellas.venta
        if (!tienda.length) return sinMirar('No vendes online, así que la venta no se puede atribuir por aquí. Un código de descuento que se mencione en el local hace el mismo papel.')
        if (tienda.some((t) => t.id === 'shopify')) {
          return ok({
            dice: 'Tienes Shopify. Mikro puede crear un código de descuento propio para cada creador y enseñarte las ventas reales que entró cada uno, sin que tengas que cruzar nada a mano.',
            dato: 'Shopify detectado',
          })
        }
        return aviso({
          dice: 'Tienes tienda, pero sin un código por creador no vas a poder separar qué vendió cada uno.',
          dato: tienda.map((t) => t.nombre).join(', '),
          arregla: 'Crea un código de descuento distinto por colaboración (NOMBRE10). Es la forma más barata de atribuir una venta a una persona.',
          esfuerzo: 'rato',
        })
      },
    },

    {
      id: 'imagen-previa',
      titulo: 'La imagen de vista previa existe de verdad',
      peso: 2,
      mira(p) {
        const i = p.extras.ogImagen
        if (!p.metas['og:image']) return sinMirar('No hay imagen declarada que comprobar.')
        if (!i) return sinMirar('No hemos podido comprobar la imagen de vista previa.')
        if (!i.ok) {
          return fallo({
            dice: 'La imagen de vista previa que declaras no se puede descargar. Al compartir tu enlace sale el hueco vacío igualmente.',
            dato: `${i.estado || 'sin respuesta'} en ${muestra(i.url, 90)}`,
            arregla: 'Sube la imagen o corrige la dirección del og:image. Tiene que ser una URL absoluta y pública.',
            esfuerzo: 'rato',
          })
        }
        if (i.bytes && i.bytes > 5_000_000) {
          return aviso({ dice: 'La imagen de vista previa pesa demasiado y algunas aplicaciones no llegan a cargarla.', dato: `${Math.round(i.bytes / 1024)} KB`, arregla: 'Deja la imagen en menos de 1 MB a 1200×630.', esfuerzo: 'rato' })
        }
        return ok({ dice: 'La imagen de vista previa existe y se descarga.', dato: `${i.tipo || 'imagen'}${i.bytes ? `, ${Math.round(i.bytes / 1024)} KB` : ''}` })
      },
    },

    {
      id: 'tarjeta',
      titulo: 'La tarjeta grande al compartir en X',
      peso: 1,
      mira(p) {
        const c = p.metas['twitter:card']
        if (/summary_large_image/i.test(c || '')) return ok({ dice: 'Tu enlace sale con imagen grande.', dato: c })
        if (c) return aviso({ dice: 'Tu enlace sale con una miniatura pequeña en vez de una imagen grande.', dato: c, arregla: 'Cambia twitter:card a «summary_large_image».', esfuerzo: 'minutos' })
        return aviso({ dice: 'Sin twitter:card, algunas aplicaciones enseñan tu enlace con una miniatura diminuta.', arregla: 'Añade <meta name="twitter:card" content="summary_large_image">.', esfuerzo: 'minutos' })
      },
    },
  ],
}

export default area
