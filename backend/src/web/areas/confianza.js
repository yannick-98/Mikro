/**
 * Area 4 — Si da confianza y si cumple.
 *
 * Dos cosas que en realidad son la misma. Un candado roto en la barra del
 * navegador y una web sin aviso legal transmiten lo mismo a quien acaba de
 * llegar desde el enlace de un creador: aqui no dejo mi tarjeta.
 *
 * La parte legal es ley espanola de verdad, no buenas practicas:
 *
 *  - **LSSI-CE, articulo 10**: quien vende por internet esta obligado a dar su
 *    nombre o razon social, su NIF, su domicilio y un medio de contacto.
 *  - **RGPD y LOPDGDD**: cualquier formulario que recoja un correo necesita
 *    informar de quien trata el dato y para que.
 *  - **Articulo 22.2 de la LSSI** (y el criterio de la AEPD): las cookies que
 *    no son imprescindibles necesitan consentimiento **antes** de instalarse.
 *    Cargar Google Analytics en cuanto alguien entra, sin banner, es la
 *    infraccion mas sancionada en Espana, y le pasa a casi todas las pymes.
 *
 * No somos abogados y el informe lo dice. Lo que hacemos es senalar lo que no
 * esta, que es lo que nadie mira hasta que llega una reclamacion.
 */
import { aviso, fallo, muestra, ok, sinMirar } from '../comprobacion.js'

/** Busca un enlace por su texto o por su direccion. */
const buscaEnlace = (p, patron) =>
  p.enlaces.find((e) => patron.test(e.texto || '') || patron.test(e.href || ''))

const area = {
  id: 'confianza',
  nombre: 'Confianza y ley',
  peso: 20,
  descripcion: 'El candado, las páginas legales y el consentimiento de cookies.',
  comprobaciones: [
    {
      id: 'https',
      titulo: 'La conexión es segura',
      peso: 5,
      mira(p) {
        if (p.seguro) return ok({ dice: 'Tu web va por HTTPS: el navegador enseña el candado y nadie puede leer por el camino lo que te escriben.', dato: p.url })
        return fallo({
          dice: 'Tu web va sin cifrar. Chrome y Safari marcan «No es seguro» junto a tu dirección, y en cualquier formulario sale un aviso rojo. Es la primera razón por la que alguien se va sin comprar.',
          dato: p.url,
          arregla: 'Pide a tu hosting el certificado gratuito de Let\'s Encrypt: se activa en un clic y no cuesta nada.',
          esfuerzo: 'encargo',
        })
      },
    },

    {
      id: 'consentimiento',
      titulo: 'Pides permiso antes de rastrear',
      peso: 4,
      mira(p) {
        const rastreadores = [...p.huellas.analiticas, ...p.huellas.pixeles]
        const cmp = p.huellas.consentimiento
        if (!rastreadores.length) return ok({ dice: 'No cargas nada que rastree, así que no necesitas pedir permiso por eso.', dato: 'Sin analítica ni píxeles' })
        if (cmp.length) {
          return ok({
            dice: 'Tienes un sistema de consentimiento delante de lo que rastrea.',
            dato: `${cmp.map((c) => c.nombre).join(', ')} con ${rastreadores.map((r) => r.nombre).join(', ')}`,
          })
        }
        return fallo({
          dice: 'Cargas herramientas que rastrean a quien entra y no vemos ningún aviso de cookies que pida permiso antes. Es exactamente lo que más multa la Agencia de Protección de Datos, y las sanciones empiezan en los miles de euros.',
          dato: `Rastrean sin consentimiento detectado: ${rastreadores.map((r) => r.nombre).join(', ')}`,
          arregla: 'Instala un gestor de consentimiento que bloquee los scripts hasta que la persona acepte (Cookiebot, CookieYes y Complianz tienen plan gratuito para webs pequeñas). Aceptar y rechazar tienen que estar igual de a mano.',
          esfuerzo: 'tarde',
        })
      },
    },

    {
      id: 'privacidad',
      titulo: 'La política de privacidad',
      peso: 4,
      mira(p) {
        if (p.renderizadoEnCliente) return sinMirar('No podemos leer los enlaces del pie porque la web se monta con JavaScript.')
        const e = buscaEnlace(p, /privacidad|privacy|proteccion-de-datos|protección de datos/i)
        if (e) return ok({ dice: 'Tienes política de privacidad enlazada.', dato: e.url || e.texto })
        return fallo({
          dice: 'No encontramos la política de privacidad. Si tu web tiene un solo formulario, es obligatoria, y sin ella ningún consentimiento que recojas vale.',
          arregla: 'Publica una página de privacidad con quién trata los datos, para qué, cuánto los guarda y cómo ejercer los derechos. Enlázala desde el pie y desde cada formulario.',
          esfuerzo: 'tarde',
        })
      },
    },

    {
      id: 'aviso-legal',
      titulo: 'El aviso legal',
      peso: 4,
      mira(p) {
        if (p.renderizadoEnCliente) return sinMirar('No podemos leer los enlaces del pie porque la web se monta con JavaScript.')
        const e = buscaEnlace(p, /aviso\s*legal|legal-notice|terminos|términos|condiciones/i)
        if (e) return ok({ dice: 'Tienes aviso legal enlazado.', dato: e.url || e.texto })
        return fallo({
          dice: 'No encontramos el aviso legal. La LSSI lo exige a cualquier web de una empresa, aunque no venda nada por internet.',
          arregla: 'Publica un aviso legal con la razón social, el NIF, el domicilio, el correo de contacto y, si procede, los datos registrales. Enlázalo desde el pie.',
          esfuerzo: 'tarde',
        })
      },
    },

    {
      id: 'cookies',
      titulo: 'La política de cookies',
      peso: 3,
      mira(p) {
        if (p.renderizadoEnCliente) return sinMirar('No podemos leer los enlaces del pie porque la web se monta con JavaScript.')
        const e = buscaEnlace(p, /cookies?/i)
        const rastrea = p.huellas.analiticas.length || p.huellas.pixeles.length
        if (e) return ok({ dice: 'Tienes política de cookies.', dato: e.url || e.texto })
        if (!rastrea) return aviso({ dice: 'No tienes política de cookies, aunque tampoco vemos nada que las instale ahora mismo.', arregla: 'En cuanto pongas analítica o un mapa incrustado la vas a necesitar: déjala escrita ya.', esfuerzo: 'rato' })
        return fallo({ dice: 'Instalas cookies de terceros y no hay política de cookies que explique cuáles son y para qué.', arregla: 'Publica una página de cookies con la lista, su finalidad y su duración, y enlázala desde el banner.', esfuerzo: 'tarde' })
      },
    },

    {
      id: 'http-a-https',
      titulo: 'Quien entra sin https acaba en https',
      peso: 3,
      mira(p) {
        if (!p.seguro) return sinMirar('Tu web todavía no tiene HTTPS: esto se mira después.')
        const h = p.extras.http
        if (!h) return sinMirar('No hemos podido comprobar la versión sin cifrar de tu web.')
        if (h.saltos?.some((s) => s.a.startsWith('https://'))) return ok({ dice: 'Quien escriba tu dirección sin «https» acaba igualmente en la versión segura.', dato: `${h.saltos[0].estado} → ${h.saltos[0].a}` })
        return aviso({
          dice: 'La versión sin cifrar de tu web sigue contestando por su cuenta. Quien llegue ahí por un enlace viejo navegará sin candado y, para Google, es otra web distinta compitiendo con la tuya.',
          dato: `http://${new URL(p.url).host}/ responde ${h.estado} sin redirigir a https`,
          arregla: 'Pon una redirección permanente (301) de todo el http a https. Tu hosting suele tener una casilla «Forzar HTTPS».',
          esfuerzo: 'encargo',
        })
      },
    },

    {
      id: 'contenido-mixto',
      titulo: 'Nada se carga sin cifrar dentro de una página segura',
      peso: 3,
      mira(p) {
        if (!p.seguro) return sinMirar('Esto solo aplica cuando la web ya va por HTTPS.')
        const sueltos = [
          ...p.html.matchAll(/(?:src|href|action)\s*=\s*["'](http:\/\/[^"']+)["']/gi),
        ]
          .map((m) => m[1])
          // Los espacios de nombres de XML y los esquemas no son recursos.
          .filter((u) => !/^http:\/\/(www\.)?(w3\.org|schema\.org|purl\.org|ogp\.me|gmpg\.org)/i.test(u))
        if (!sueltos.length) return ok({ dice: 'Todo lo que carga tu web va cifrado.', dato: 'Sin contenido mixto' })
        const dato = `${sueltos.length} recurso(s): ${muestra(sueltos.slice(0, 3).join(', '), 180)}`
        return fallo({
          dice: 'Tu web carga ficheros sin cifrar dentro de una página segura. El navegador los bloquea: ahí hay imágenes que no se ven o un formulario que no funciona, y el candado desaparece.',
          dato,
          arregla: 'Cambia esas direcciones de http:// a https:// (o a rutas relativas que empiecen por /).',
          esfuerzo: 'encargo',
        })
      },
    },

    {
      id: 'formularios-seguros',
      titulo: 'Los formularios se envían cifrados',
      peso: 2,
      mira(p) {
        if (!p.formularios.length) return sinMirar('No hemos encontrado formularios en esta página.')
        const malos = p.formularios.filter((f) => f.url && f.url.startsWith('http://'))
        if (!malos.length) return ok({ dice: 'Lo que te escriben viaja cifrado.', dato: `${p.formularios.length} formulario(s) revisado(s)` })
        return fallo({ dice: 'Un formulario manda los datos sin cifrar. El navegador avisa en rojo al escribir dentro.', dato: malos.map((f) => f.url).join(', '), arregla: 'Cambia el «action» del formulario a https://.', esfuerzo: 'minutos' })
      },
    },

    {
      id: 'identificacion',
      titulo: 'Se sabe quién hay detrás',
      peso: 2,
      mira(p) {
        if (p.renderizadoEnCliente) return sinMirar('No podemos leer el pie de página porque la web se monta con JavaScript.')
        const t = p.texto
        const nif = /\b[ABCDEFGHJNPQRSUVW][\s-]?\d{7}[\s-]?[0-9A-J]\b/.test(t) || /\b\d{8}[\s-]?[A-Z]\b/.test(t)
        const forma = /\b(S\.?L\.?U?\.?|S\.?A\.?U?\.?|S\.?C\.?P?\.?|sociedad limitada|cooperativa|autónom)/i.test(t)
        if (nif) return ok({ dice: 'Tu NIF aparece en la página, como pide la LSSI.', dato: 'NIF/CIF localizado en el texto' })
        if (forma) return aviso({ dice: 'Aparece la forma jurídica pero no vemos el NIF. La LSSI pide los dos.', arregla: 'Añade el NIF y el domicilio en el pie o en el aviso legal.', esfuerzo: 'minutos' })
        return aviso({
          dice: 'No vemos quién hay detrás de la web: ni razón social, ni NIF, ni domicilio. Es obligatorio y, además, es lo que mira quien duda antes de pagar por adelantado.',
          arregla: 'Pon en el pie el nombre o razón social, el NIF y la dirección. Dos líneas.',
          esfuerzo: 'minutos',
        })
      },
    },

    {
      id: 'cabeceras',
      titulo: 'Las defensas del servidor',
      peso: 1,
      mira(p) {
        const c = p.cabeceras
        const puestas = []
        if (c['strict-transport-security']) puestas.push('HSTS')
        if (c['x-content-type-options']) puestas.push('X-Content-Type-Options')
        if (c['content-security-policy']) puestas.push('CSP')
        if (c['x-frame-options'] || /frame-ancestors/i.test(c['content-security-policy'] || '')) puestas.push('protección contra marcos')
        if (c['referrer-policy']) puestas.push('Referrer-Policy')
        if (puestas.length >= 3) return ok({ dice: 'Tu servidor manda las cabeceras de seguridad habituales.', dato: puestas.join(', ') })
        return aviso({
          dice: 'Faltan cabeceras de seguridad. No es urgente para una web pequeña, pero son gratis y evitan que te metan dentro de un marco en otra web.',
          dato: puestas.length ? `Solo: ${puestas.join(', ')}` : 'Ninguna',
          arregla: 'Pide que se añadan Strict-Transport-Security, X-Content-Type-Options: nosniff y X-Frame-Options: SAMEORIGIN.',
          esfuerzo: 'encargo',
        })
      },
    },
  ],
}

export default area
