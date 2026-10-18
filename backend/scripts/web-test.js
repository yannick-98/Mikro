/**
 * Pruebas del diagnostico de web.
 *
 *   node backend/scripts/web-test.js
 *
 * Sin red y sin base de datos. Eso no es una comodidad: es la razon por la
 * que `recoger.js` separa la descarga del analisis. Una suite que necesitara
 * webs reales fallaria los martes porque a alguien le caduco un certificado,
 * y entonces dejariamos de ejecutarla.
 *
 * Lo que se vigila aqui es lo que, si se rompe, no da ningun error:
 *
 *  - que no se pueda usar el analizador para tocar la red interna;
 *  - que una comprobacion que no se ha podido hacer no reste puntos;
 *  - que un aviso no pese lo mismo que un fallo;
 *  - que las prioridades salgan ordenadas por lo que de verdad recuperan;
 *  - que una web vacia hecha con JavaScript no se puntue como una web mala.
 */
const { normalizar, esPrivada, WebInvalida } = await import('../src/web/seguridad.js')
const h = await import('../src/web/html.js')
const { reconocer } = await import('../src/web/huellas.js')
const { leer } = await import('../src/web/recoger.js')
const { puntuar, prioridades, notaDe, letraDe } = await import('../src/web/puntuar.js')
const { informar, informeEnTexto, informeDeFallo } = await import('../src/web/informe.js')
const { analizarHtml } = await import('../src/web/index.js')
const { ritmo, olvidarRitmo } = await import('../src/lib/ritmo.js')

let passed = 0
let failed = 0
const check = (name, cond, extra = '') => {
  if (cond) {
    passed += 1
    console.log(`  OK   ${name}`)
  } else {
    failed += 1
    console.log(`  FALLO ${name} ${extra}`)
  }
}
const lanza = (fn) => {
  try {
    fn()
    return null
  } catch (e) {
    return e
  }
}

// ---------------------------------------------------------------------------
console.log('\n--- A donde se puede ir ---')

check('acepta un dominio a pelo', normalizar('panaderia.es').href === 'https://panaderia.es/')
check('respeta http si se pide', normalizar('http://panaderia.es').protocol === 'http:')
check('quita el ancla', normalizar('https://panaderia.es/a#b').href === 'https://panaderia.es/a')
check('conserva la ruta y la consulta', normalizar('tienda.es/p?x=1').href === 'https://tienda.es/p?x=1')

// Lo que de verdad importa: esto es un formulario publico que hace peticiones
// desde nuestra infraestructura.
check('rechaza localhost', lanza(() => normalizar('http://localhost:3000')) instanceof WebInvalida)
check('rechaza un nombre sin punto', lanza(() => normalizar('servidor-interno')) instanceof WebInvalida)
check('rechaza file://', lanza(() => normalizar('file:///etc/passwd')) instanceof WebInvalida)
check('rechaza un esquema raro', lanza(() => normalizar('gopher://x.es')) instanceof WebInvalida)
check('rechaza un puerto cualquiera', lanza(() => normalizar('https://x.es:5432')) instanceof WebInvalida)
check('rechaza usuario:clave@', lanza(() => normalizar('https://yo:clave@x.es')) instanceof WebInvalida)
check('rechaza .local', lanza(() => normalizar('http://nas.local')) instanceof WebInvalida)
check('rechaza lo vacio', lanza(() => normalizar('   ')) instanceof WebInvalida)
check('rechaza una direccion kilometrica', lanza(() => normalizar(`https://x.es/${'a'.repeat(400)}`)) instanceof WebInvalida)

check('127.0.0.1 es privada', esPrivada('127.0.0.1'))
check('10.x es privada', esPrivada('10.1.2.3'))
check('172.16-31 es privada', esPrivada('172.20.0.1') && esPrivada('172.31.255.1'))
check('172.32 ya no lo es', !esPrivada('172.32.0.1'))
check('192.168 es privada', esPrivada('192.168.1.1'))
// La de los metadatos de AWS, Google y Azure: el objetivo clasico de un SSRF.
check('169.254.169.254 es privada', esPrivada('169.254.169.254'))
check('el CGNAT es privado', esPrivada('100.64.0.1'))
check('::1 es privada', esPrivada('::1'))
check('una IPv4 disfrazada de IPv6 se desenmascara', esPrivada('::ffff:127.0.0.1'))
check('fc00::/7 es privada', esPrivada('fd00::1'))
check('una IP publica pasa', !esPrivada('93.184.216.34') && !esPrivada('2606:2800:220:1::1'))
check('una basura no pasa', esPrivada('no-soy-una-ip'))

// ---------------------------------------------------------------------------
console.log('\n--- Leer HTML ---')

check('atributos con comillas dobles', h.atributos('href="/a" rel="nofollow"').href === '/a')
check('atributos sin comillas', h.atributos('width=600 height=400').width === '600')
check('atributos con comillas simples', h.atributos("src='/x.png'").src === '/x.png')
check('atributos sueltos valen cadena vacia', h.atributos('defer async').defer === '')
check('el nombre se normaliza a minusculas', h.atributos('HREF="/a"').href === '/a')
check('gana el primero si se repite', h.atributos('id="a" id="b"').id === 'a')
check('decodifica entidades en el valor', h.atributos('alt="Caf&eacute;"').alt === 'Café')

check('entidad con nombre', h.decodificar('Pan &amp; vino') === 'Pan & vino')
check('entidad numerica', h.decodificar('&#8364;10') === '€10')
check('entidad hexadecimal', h.decodificar('&#x20AC;') === '€')
check('lo que no es entidad se queda', h.decodificar('100 & 200 &noexiste;') === '100 & 200 &noexiste;')

const doc = `<!doctype html><html lang="es"><head>
  <title>Panader&iacute;a La Espiga</title>
  <meta name="description" content="Pan de masa madre">
  <meta property="og:image" content="/portada.jpg">
  <link rel="canonical" href="https://espiga.es/">
  <link rel="stylesheet" href="/estilos.css">
  <script src="/app.js"></script>
</head><body>
  <h1>Pan de masa madre</h1>
  <!-- <h1>titular viejo</h1> -->
  <p>Hecho cada ma&ntilde;ana en Valencia.</p>
  <script>var oculto = "no soy texto"</script>
  <style>.x{color:red}</style>
  <a href="/carta">Ver carta</a>
</body></html>`

check('saca el titulo y lo decodifica', h.textoVisible(h.etiqueta(h.cabeza(doc), 'title').interior) === 'Panadería La Espiga')
check('indexa los metas por name y property', h.metas(h.cabeza(doc))['og:image'] === '/portada.jpg')
check('separa cabeza y cuerpo', !h.cabeza(doc).includes('<h1>') && h.cuerpo(doc).includes('<h1>'))
check('el texto visible no trae el javascript', !h.textoVisible(h.cuerpo(doc)).includes('no soy texto'))
check('ni el css', !h.textoVisible(h.cuerpo(doc)).includes('color:red'))
// Un titular dentro de un comentario no es un titular: ese fallo haria que
// una web sin h1 pareciera tenerlo.
check('ni lo que hay en un comentario', !h.textoVisible(h.cuerpo(doc)).includes('titular viejo'))
check('el texto visible se lee', h.textoVisible(h.cuerpo(doc)).includes('Hecho cada mañana en Valencia'))
check('cuenta los enlaces con su texto', h.enlaces(h.cuerpo(doc), 'https://espiga.es/')[0].texto === 'Ver carta')
check('resuelve el enlace a absoluto', h.enlaces(h.cuerpo(doc), 'https://espiga.es/')[0].url === 'https://espiga.es/carta')

check('dominio de un subdominio', h.dominio('https://tienda.espiga.es/x') === 'espiga.es')
check('dominio con doble sufijo', h.dominio('https://www.algo.com.es/') === 'algo.com.es')
check('quita el www', h.dominio('https://www.espiga.es') === 'espiga.es')
check('propio frente a tercero', h.esPropio('https://www.espiga.es/a.js', 'https://espiga.es/') && !h.esPropio('https://cdn.otro.com/a.js', 'https://espiga.es/'))

const conLd = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"LocalBusiness","name":"X"},{"@type":"WebSite"}]}</script>`
check('aplana el @graph', h.jsonLd(conLd).length === 2)
check('reconoce el tipo', h.tieneTipo(h.jsonLd(conLd), 'LocalBusiness'))
check('un json-ld roto se marca pero no revienta', h.jsonLd('<script type="application/ld+json">{roto</script>')[0].roto === true)

// ---------------------------------------------------------------------------
console.log('\n--- Reconocer lo que lleva puesto ---')

const huellas = reconocer(
  `<script src="https://cdn.shopify.com/s/x.js"></script>
   <script src="https://www.googletagmanager.com/gtag/js?id=G-ABC12345"></script>
   <script>fbq('init','1')</script>
   <script src="https://consent.cookiebot.com/uc.js"></script>`,
  { server: 'cloudflare', 'cf-ray': 'abc' },
)
check('reconoce Shopify', huellas.plataforma?.id === 'shopify')
check('reconoce GA4', huellas.analiticas.some((a) => a.id === 'ga4'))
check('reconoce el pixel de Meta', huellas.pixeles.some((p) => p.id === 'meta'))
check('reconoce el gestor de consentimiento', huellas.consentimiento.some((c) => c.id === 'cookiebot'))
check('lee el servidor de las cabeceras', huellas.servidor === 'Cloudflare')
check('una web pelada no reconoce nada', reconocer('<html><body>hola</body></html>').plataforma === null)

// ---------------------------------------------------------------------------
console.log('\n--- Como se suman los puntos ---')

const falsas = (defs) => defs.map((d, i) => ({ id: `c${i}`, peso: d.peso, estado: d.estado }))
check('todo bien es 100', notaDe(falsas([{ peso: 5, estado: 'ok' }, { peso: 1, estado: 'ok' }])) === 100)
check('todo mal es 0', notaDe(falsas([{ peso: 5, estado: 'fallo' }])) === 0)
check('un aviso vale la mitad', notaDe(falsas([{ peso: 4, estado: 'aviso' }])) === 50)
// La regla que separa este informe de los demas: lo que no se ha mirado no
// cuenta, ni a favor ni en contra.
check(
  'lo no comprobado no resta',
  notaDe(falsas([{ peso: 5, estado: 'ok' }, { peso: 5, estado: 'no-comprobado' }])) === 100,
)
check('lo que no aplica tampoco', notaDe(falsas([{ peso: 5, estado: 'ok' }, { peso: 9, estado: 'no-aplica' }])) === 100)
check('si no se midio nada, no hay nota', notaDe(falsas([{ peso: 5, estado: 'no-comprobado' }])) === null)
check('el peso manda sobre el numero', notaDe(falsas([{ peso: 9, estado: 'ok' }, { peso: 1, estado: 'fallo' }])) === 90)
check('las letras van de la A a la E', letraDe(95).letra === 'A' && letraDe(60).letra === 'C' && letraDe(0).letra === 'E')
check('el corte de la A es 88', letraDe(88).letra === 'A' && letraDe(87).letra === 'B')

// ---------------------------------------------------------------------------
console.log('\n--- Una web que lo hace todo mal ---')

const MALA = `<!doctype html><html><head>
  <meta name="robots" content="noindex,nofollow">
  <script src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
  <script src="https://connect.facebook.net/es_ES/fbevents.js"></script>
</head><body>
  <table width="980"><tr><td>
  <img src="/foto.png">
  <img src="/foto2.png">
  <img src="/foto3.png">
  <p>Llama al 963 00 11 22</p>
  <form action="http://espiga.es/enviar"><input type="email" name="correo"></form>
  </td></tr></table>
</body></html>`

const mala = analizarHtml(MALA, { url: 'http://espiga.es/', cabeceras: {}, ms: { cabeceras: 2400 }, bytes: 400_000 })
const de = (informe, id) => informe.areas.flatMap((a) => a.comprobaciones).find((c) => c.id === id)

check('la nota baja de 40', mala.nota.total < 40, `${mala.nota.total}`)
check('y la letra lo dice', ['D', 'E'].includes(mala.nota.letra), mala.nota.letra)
check('detecta el noindex', de(mala, 'indexable').estado === 'fallo')
check('detecta que no hay titulo', de(mala, 'titulo').estado === 'fallo')
check('detecta que falta el viewport', de(mala, 'viewport').estado === 'fallo')
check('detecta que no va por https', de(mala, 'https').estado === 'fallo')
check('detecta el formulario sin cifrar', de(mala, 'formularios-seguros').estado === 'fallo')
check('detecta el servidor lento', de(mala, 'respuesta').estado === 'fallo')
check('detecta que no se comprime', de(mala, 'compresion').estado === 'fallo')
check('detecta el ancho fijo de la tabla', de(mala, 'ancho-fijo').estado !== 'ok')
check('detecta que falta la imagen al compartir', de(mala, 'vista-previa').estado === 'fallo')
// El que nadie mira: rastrea sin pedir permiso.
check('detecta que rastrea sin consentimiento', de(mala, 'consentimiento').estado === 'fallo')
check('y dice con que rastrea', de(mala, 'consentimiento').dato.includes('Google Analytics 4'))
check('ve el telefono escrito pero no pulsable', de(mala, 'telefono').estado === 'aviso')
check('y ensena el telefono que ha visto', de(mala, 'telefono').dato.includes('963'))
check('no hay aviso legal', de(mala, 'aviso-legal').estado === 'fallo')
check('el semaforo de campana esta en rojo', mala.campana.semaforo === 'no')
check('y nombra los bloqueos', mala.campana.texto.includes('HTTPS') || mala.campana.texto.includes('móvil'))

console.log('\n--- Lo primero que habria que arreglar ---')

check('propone como mucho ocho cosas', mala.prioridades.length <= 8 && mala.prioridades.length > 3)
check('vienen ordenadas por impacto', mala.prioridades.every((p, i, a) => i === 0 || a[i - 1].impacto >= p.impacto))
check('cada una dice cuanto recupera', mala.prioridades.every((p) => typeof p.impacto === 'number' && p.impacto > 0))
check('cada una trae la instruccion', mala.prioridades.every((p) => p.arregla && p.arregla.length > 20))
check('y lo que cuesta', mala.prioridades.every((p) => ['minutos', 'rato', 'tarde', 'encargo'].includes(p.esfuerzo)))
check('y de que area sale', mala.prioridades.every((p) => p.areaNombre))
// El orden tiene que premiar al area que mas pesa, no al fallo mas aparatoso.
const primera = mala.prioridades[0]
check('lo primero sale de un area con peso', ['conversion', 'confianza', 'velocidad', 'movil', 'campanas'].includes(primera.area), primera.area)

// ---------------------------------------------------------------------------
console.log('\n--- Una web que lo hace bien ---')

const BUENA = `<!doctype html><html lang="es"><head>
  <title>Panadería de masa madre en Valencia | La Espiga</title>
  <meta name="description" content="Pan de masa madre horneado cada mañana en Russafa. Recoge en tienda o pide tu hogaza del día antes de las 11:00.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta property="og:title" content="Panadería La Espiga">
  <meta property="og:description" content="Masa madre cada mañana en Valencia">
  <meta property="og:image" content="https://espiga.es/portada.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://espiga.es/">
  <link rel="icon" href="/favicon.ico">
  <script src="https://plausible.io/js/script.js" defer></script>
  <script src="https://consent.cookiebot.com/uc.js"></script>
  <script type="application/ld+json">{"@type":"Bakery","name":"La Espiga","address":{"@type":"PostalAddress","streetAddress":"Calle Cuba 12","postalCode":"46006","addressLocality":"Valencia"},"openingHours":"Mo-Sa 08:00-14:00","aggregateRating":{"@type":"AggregateRating","ratingValue":4.8,"reviewCount":120}}</script>
  <style>@media (max-width: 600px){.x{display:block}} @media (min-width:900px){.y{display:flex}} @media (max-width:420px){.z{width:100%}}</style>
</head><body>
  <h1>Pan de masa madre, cada mañana</h1>
  <a href="https://espiga.es/tienda">Comprar pan</a>
  <a href="tel:+34963001122">963 00 11 22</a>
  <a href="https://wa.me/34600112233">WhatsApp</a>
  <a href="https://instagram.com/laespiga">Instagram</a>
  <a href="https://tiktok.com/@laespiga">TikTok</a>
  <p>Hogaza de espelta: 4,50 €. Calle Cuba 12, 46006 Valencia. Horario: de 8 a 14 h.</p>
  <img src="/pan.webp" alt="Hogaza" width="800" height="600" srcset="/pan-400.webp 400w, /pan-800.webp 800w">
  <img src="/horno.webp" alt="Horno" width="800" height="600" loading="lazy" srcset="/horno-400.webp 400w">
  <img src="/masa.webp" alt="Masa" width="800" height="600" loading="lazy" srcset="/masa-400.webp 400w">
  <img src="/tienda.webp" alt="Tienda" width="800" height="600" loading="lazy" srcset="/tienda-400.webp 400w">
  <form action="/contacto" method="post"><input type="email" name="correo"><textarea name="mensaje"></textarea></form>
  <a href="/aviso-legal">Aviso legal</a> · <a href="/privacidad">Privacidad</a> · <a href="/cookies">Cookies</a>
  <p>La Espiga S.L. · B12345678 · Calle Cuba 12, 46006 Valencia</p>
</body></html>`

const buena = analizarHtml(BUENA, {
  url: 'https://espiga.es/',
  cabeceras: {
    'content-encoding': 'br',
    'strict-transport-security': 'max-age=31536000',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
  },
  ms: { cabeceras: 180 },
  bytes: 48_000,
  extras: {
    robots: { ok: true, texto: 'User-agent: *\nAllow: /\nSitemap: https://espiga.es/sitemap.xml' },
    sitemap: { ok: true, estado: 200 },
    http: { ok: true, estado: 200, saltos: [{ estado: 301, a: 'https://espiga.es/' }] },
    utm: { ok: true, conserva: true, saltos: 0, destino: 'https://espiga.es/?utm_source=mikro' },
    ogImagen: { ok: true, estado: 200, tipo: 'image/jpeg', bytes: 180_000 },
  },
})

check('saca buena nota', buena.nota.total >= 85, `${buena.nota.total}`)
check('y la letra lo dice', buena.nota.letra === 'A', buena.nota.letra)
check('el semaforo de campana esta en verde', buena.campana.semaforo === 'si', buena.campana.semaforo)
check('no quedan fallos', buena.resumen.fallos === 0, JSON.stringify(buena.areas.flatMap((a) => a.comprobaciones).filter((c) => c.estado === 'fallo').map((c) => c.id)))
check('ve las paginas legales', de(buena, 'aviso-legal').estado === 'ok' && de(buena, 'privacidad').estado === 'ok')
check('ve el NIF', de(buena, 'identificacion').estado === 'ok')
check('ve el telefono pulsable', de(buena, 'telefono').estado === 'ok')
check('ve el WhatsApp', de(buena, 'whatsapp').estado === 'ok')
check('ve la direccion en los datos estructurados', de(buena, 'donde-estas').estado === 'ok')
check('ve el horario', de(buena, 'horario').estado === 'ok')
check('ve el precio', de(buena, 'precio').estado === 'ok')
check('ve las valoraciones', de(buena, 'prueba-social').estado === 'ok')
check('ve la analitica', de(buena, 'analitica').estado === 'ok')
check('ve que conserva los parametros de campana', de(buena, 'parametros').estado === 'ok')
check('ve las reglas de movil', de(buena, 'adaptable').estado === 'ok')
check('y lo que esta bien se destaca', buena.bienHecho.length > 0 && buena.bienHecho[0].estado === 'ok')

// ---------------------------------------------------------------------------
console.log('\n--- Lo que no se puede ver ---')

// Una web montada con JavaScript llega vacia. Lo honrado no es suspenderla:
// es decir que no se ha podido mirar y no contarlo en la nota.
const SPA = `<!doctype html><html lang="es"><head>
  <title>Mi tienda</title><meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="/_next/static/chunks/main.js" defer></script>
  <script src="/_next/static/chunks/app.js" defer></script>
</head><body><div id="__next"></div></body></html>`

const spa = analizarHtml(SPA, { url: 'https://tienda.es/' })
check('detecta que se monta con JavaScript', spa.ficha.plataforma === 'Next.js')
check('lo avisa lo primero', spa.advertencias[0].includes('JavaScript'))
check('y no puntua lo que no ha visto', de(spa, 'aviso-legal').estado === 'no-comprobado')
check('la lista de lo no comprobado no esta vacia', spa.sinMirar.length >= 3)
check('cada entrada explica por que', spa.sinMirar.every((s) => s.porque && s.porque.length > 15))
// Lo importante: no se le pone un cero por lo que no hemos sabido mirar.
check('aun asi hay nota', typeof spa.nota.total === 'number')
check('y no es un suspenso automatico', spa.nota.total > 20, `${spa.nota.total}`)

const sinExtras = analizarHtml(BUENA, { url: 'https://espiga.es/' })
check('sin las peticiones extra, esas comprobaciones quedan sin mirar', de(sinExtras, 'parametros').estado === 'no-comprobado')
check('y el resto se puntua igual', de(sinExtras, 'titulo').estado === 'ok')
check('la nota sigue saliendo', sinExtras.nota.total !== null)

// ---------------------------------------------------------------------------
console.log('\n--- Casos que rompen ---')

const vacia = analizarHtml('', { url: 'https://nada.es/' })
check('un HTML vacio no revienta', vacia.nota.total !== undefined)
check('ninguna comprobacion lanza', vacia.areas.flatMap((a) => a.comprobaciones).every((c) => c.estado !== undefined))

const rara = analizarHtml('<html><body><img src><a href></a><form></form><script>', { url: 'https://rara.es/' })
check('etiquetas sin cerrar ni atributos tampoco', rara.areas.length === 6)

const fallo = informeDeFallo({ url: 'https://caida.es/', fallo: { tipo: 'dns', mensaje: 'Ese dominio no resuelve' } })
check('una web caida da informe igual', fallo.campana.semaforo === 'no')
check('y dice que es lo unico que importa hoy', fallo.campana.texto.includes('no resuelve'))
check('sin nota inventada', fallo.nota.total === null)

// ---------------------------------------------------------------------------
console.log('\n--- Cuando no nos dejan ver la web ---')

// Esto salio probando contra una tienda real: nos contesto un 200 de siete
// kilobytes que era la pagina de un antibots, y el informe la suspendio
// entera. Un informe falso es peor que ninguno.
const MURO = `<!doctype html><html><head><meta name="robots" content="noindex,nofollow">
  <script src="/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page/v1"></script></head>
  <body><div class="card">Checking your browser before accessing the site.</div></body></html>`
const { queNosHanDado, informeSinWeb } = await import('../src/web/muro.js')
const mirar = (html, cabeceras = {}, estado = 200) =>
  queNosHanDado({ html, cabeceras, estado, pagina: leer({ url: 'https://x.es/', html }) })

const muro = mirar(MURO, { 'cf-ray': 'x' })
check('reconoce el muro de Cloudflare', muro?.tipo === 'cloudflare', JSON.stringify(muro))
check('un 403 escueto tambien cuenta', mirar('<html><body>Access Denied</body></html>', {}, 403)?.clase === 'bloqueo')
// Y lo contrario: media internet esta detras de Cloudflare y sirve su web
// perfectamente. La huella sola no puede bastar.
check('una web buena detras de Cloudflare no es un muro', mirar(BUENA, { 'cf-ray': 'x', server: 'cloudflare' }) === null)

// El otro caso real: el dominio ya no es una web, es un escaparate de venta.
const aparcado = mirar('<html><head><title>tienda.es</title></head><body><div class="card"><h1>This domain is for sale</h1><p>Re-visit the page to contact the owner.</p></div></body></html>')
check('reconoce un dominio aparcado', aparcado?.clase === 'aparcado', JSON.stringify(aparcado))
check('reconoce un «en construcción»', mirar('<html><body><h1>Web en construcción</h1><p>Volveremos pronto</p></body></html>')?.clase === 'construccion')
check('reconoce la página de fábrica del servidor', mirar('<html><body><h1>Welcome to nginx!</h1></body></html>')?.clase === 'defecto')
check('una web de verdad no es ninguna de esas cosas', mirar(BUENA) === null)

const infMuro = informeSinWeb({ url: 'https://tienda.es/', muro })
check('no se inventa una nota', infMuro.nota.total === null)
check('dice quien nos ha parado', infMuro.campana.titular.includes('Cloudflare'))
check('y avisa de que puede estar echando a Google', infMuro.campana.texto.includes('Google'))
check('el texto plano tampoco finge un informe', informeEnTexto(infMuro).includes('NO HEMOS PODIDO VERLA'))

const infAparcado = informeSinWeb({ url: 'https://tienda.es/', muro: aparcado })
check('el dominio aparcado se cuenta como lo que es', infAparcado.campana.titular.includes('en venta'))
check('y dice por dónde empezar', infAparcado.advertencias.some((a) => a.includes('proveedor')))
check('tampoco lleva nota', infAparcado.nota.total === null)

console.log('\n--- Telefonos de verdad y numeros que no lo son ---')

// El relleno no es decorativo: sin el, la pagina parece vacia y la
// comprobacion se marca como no comprobada en lugar de mirarse.
const tel = (texto) =>
  de(
    analizarHtml(
      `<html><body><h1>Tienda de prueba</h1><p>${texto}</p><p>Abrimos de lunes a sábado en Valencia y hacemos envíos a toda España desde nuestro taller.</p><a href="/x">Catálogo</a></body></html>`,
      { url: 'https://x.es/' },
    ),
    'telefono',
  )
check('un fijo separado se reconoce', tel('Llama al 963 00 11 22').dato?.includes('963'))
check('con prefijo tambien', tel('Pide cita en +34 600 11 22 33').dato?.includes('600'))
check('en grupos de tres', tel('Teléfono: 963 001 122').dato?.includes('963'))
check('anunciado por la palabra, aunque vaya junto', tel('Teléfono 963001122').estado === 'aviso')
// El falso positivo real: una referencia de producto de nueve cifras.
check('una referencia de nueve cifras no es un telefono', tel('Referencia 720519023 en stock').estado === 'fallo')
check('ni un numero largo', tel('Pedido 9630011223344').estado === 'fallo')

// ---------------------------------------------------------------------------
console.log('\n--- Lo que aprendimos de webs reales ---')

// Cada una de estas cuatro es un error que el analizador cometio contra una
// web de verdad. Estan aqui para que no vuelva a cometerlo.
const conCuerpo = (dentro, id) =>
  de(
    analizarHtml(
      `<html lang="es"><head><title>Prueba de la tienda</title></head><body><h1>Tienda</h1>${dentro}<p>Vendemos cosas en Valencia desde hace veinte años y enviamos a toda España.</p></body></html>`,
      { url: 'https://x.es/' },
    ),
    id,
  )

check(
  'una tienda de Salesforce Commerce Cloud vende',
  conCuerpo('<a href="/on/demandware.store/Sites-ES/default/Cart-Show">Cesta</a>', 'comprar-o-reservar').estado === 'ok',
)
check('la etiqueta «Calle y número» de un formulario no es una dirección', conCuerpo('<label>Calle y número del portal</label>', 'donde-estas').estado === 'aviso')
check('una dirección con portal sí lo es', conCuerpo('<p>Estamos en Calle Cuba 12, Valencia</p>', 'donde-estas').dato?.includes('Cuba'))
check('«Elige tu horario» no dice cuándo abres', !conCuerpo('<label>Elige tu horario de entrega</label>', 'horario').dato)
check('«Abierto de 8 a 14» sí', conCuerpo('<p>Abierto de 8 a 14 h</p>', 'horario').dato?.includes('Abierto'))
check(
  'un lang vacío tiene su propio mensaje',
  de(analizarHtml('<html lang=""><head><title>x</title></head><body><h1>Hola</h1><p>Texto suficiente para no parecer vacía, con unas cuantas palabras más.</p><a href="/a">Ir</a></body></html>', { url: 'https://x.es/' }), 'idioma').dato === 'lang=""',
)

// ---------------------------------------------------------------------------
console.log('\n--- El informe en texto ---')

const texto = informeEnTexto(mala)
check('lleva la direccion', texto.includes('espiga.es'))
check('lleva la nota', texto.includes('/100'))
check('lleva las prioridades numeradas', texto.includes('1. ['))
check('cada prioridad dice que hacer', texto.includes('Qué hacer:'))
check('lleva el desglose por areas', texto.includes('POR ÁREAS'))
check('y las advertencias de como leerlo', texto.includes('CÓMO LEER ESTO'))
check('el de una web caida no finge un informe', informeEnTexto(fallo).includes('NO HEMOS PODIDO'))

// ---------------------------------------------------------------------------
console.log('\n--- El freno ---')

olvidarRitmo()
const tira = (n) => Array.from({ length: n }, () => ritmo('prueba', { veces: 3, segundos: 60 }))
const usos = tira(5)
check('las tres primeras pasan', usos.slice(0, 3).every((u) => u.ok))
check('la cuarta no', !usos[3].ok)
check('y dice cuanto esperar', usos[3].esperaSegundos > 0 && usos[3].esperaSegundos <= 60)
check('va por clave', ritmo('otra', { veces: 3, segundos: 60 }).ok)
olvidarRitmo()
check('se puede olvidar', ritmo('prueba', { veces: 3, segundos: 60 }).ok)

// ---------------------------------------------------------------------------
console.log('\n--- Coherencia del catalogo ---')

const { AREAS } = await import('../src/web/puntuar.js')
const todas = AREAS.flatMap((a) => a.comprobaciones)
check('las areas suman 100', AREAS.reduce((s, a) => s + a.peso, 0) === 100, `${AREAS.reduce((s, a) => s + a.peso, 0)}`)
check('ningun id repetido', new Set(todas.map((c) => c.id)).size === todas.length)
check('todas tienen titulo', todas.every((c) => c.titulo && c.titulo.length > 5))
check('todas tienen peso entre 1 y 5', todas.every((c) => c.peso >= 1 && c.peso <= 5))
check('todas saben mirar', todas.every((c) => typeof c.mira === 'function'))
check('hay mas de cuarenta comprobaciones', todas.length >= 40, `${todas.length}`)
// Si algo esta mal, el informe tiene que decir que hacer. Sin excepciones.
const sinArreglo = [mala, buena, spa, vacia]
  .flatMap((i) => i.areas.flatMap((a) => a.comprobaciones))
  .filter((c) => (c.estado === 'fallo' || c.estado === 'aviso') && !c.arregla)
check('ningun problema se queda sin instruccion', sinArreglo.length === 0, sinArreglo.map((c) => c.id).join())
const sinPorque = [mala, buena, spa, vacia]
  .flatMap((i) => i.areas.flatMap((a) => a.comprobaciones))
  .filter((c) => c.estado === 'no-comprobado' && !c.porque)
check('nada queda sin mirar sin decir por que', sinPorque.length === 0, sinPorque.map((c) => c.id).join())

console.log(`\n=== ${passed} correctas, ${failed} fallidas ===\n`)
process.exit(failed > 0 ? 1 : 0)
