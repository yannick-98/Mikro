/**
 * Reconocer con que esta hecha una web y que lleva puesto.
 *
 * Todo lo de aqui se decide mirando el HTML que ya hemos descargado: no hay
 * una sola peticion extra. Cada huella es una marca que el propio sistema
 * deja (un script, una ruta, un meta generator) y el informe la ensena como
 * prueba, no como adivinanza.
 *
 * Importa mas de lo que parece. "Tienes Shopify" no es una curiosidad
 * tecnica: significa que esta empresa puede conectar su tienda con Mikro y
 * ver las ventas reales de cada creador, que es lo unico que convierte una
 * colaboracion en una cifra. Y "no tienes analitica" significa que si hoy
 * contrata a un creador, dentro de un mes no sabra si sirvio de algo.
 */

const buscar = (catalogo, texto) => {
  const encontradas = []
  for (const item of catalogo) {
    if (item.patron.test(texto)) encontradas.push({ id: item.id, nombre: item.nombre })
  }
  return encontradas
}

/** Con que esta hecha la web. */
const PLATAFORMAS = [
  { id: 'shopify', nombre: 'Shopify', patron: /cdn\.shopify\.com|shopify\.theme|myshopify\.com|Shopify\.shop/i },
  { id: 'woocommerce', nombre: 'WooCommerce', patron: /woocommerce|wc-ajax|wp-content\/plugins\/woocommerce/i },
  { id: 'prestashop', nombre: 'PrestaShop', patron: /prestashop|\/modules\/ps_/i },
  { id: 'wordpress', nombre: 'WordPress', patron: /wp-content\/|wp-includes\/|name=["']generator["'][^>]*WordPress/i },
  { id: 'wix', nombre: 'Wix', patron: /static\.parastorage\.com|wix\.com\/website|X-Wix/i },
  { id: 'squarespace', nombre: 'Squarespace', patron: /squarespace\.com|static1\.squarespace/i },
  { id: 'webflow', nombre: 'Webflow', patron: /webflow\.(com|io)|data-wf-page/i },
  { id: 'godaddy', nombre: 'GoDaddy Website Builder', patron: /img1\.wsimg\.com|godaddysites\.com/i },
  { id: 'jimdo', nombre: 'Jimdo', patron: /jimdo|jimstatic\.com/i },
  { id: 'magento', nombre: 'Magento', patron: /\/static\/version\d+\/frontend\/|Magento_/i },
  { id: 'joomla', nombre: 'Joomla', patron: /\/media\/jui\/|name=["']generator["'][^>]*Joomla/i },
  { id: 'drupal', nombre: 'Drupal', patron: /\/sites\/default\/files\/|Drupal\.settings/i },
  { id: 'nextjs', nombre: 'Next.js', patron: /\/_next\/static\/|__NEXT_DATA__/i },
  { id: 'nuxt', nombre: 'Nuxt', patron: /\/_nuxt\/|__NUXT__/i },
  { id: 'astro', nombre: 'Astro', patron: /astro-island|generator["'][^>]*Astro/i },
]

/** Lo que mide visitas. */
const ANALITICAS = [
  { id: 'ga4', nombre: 'Google Analytics 4', patron: /gtag\/js\?id=G-|googletagmanager\.com\/gtag|G-[A-Z0-9]{8,}/ },
  { id: 'gtm', nombre: 'Google Tag Manager', patron: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{5,}/ },
  { id: 'ua', nombre: 'Google Analytics (versión antigua)', patron: /UA-\d{4,}-\d+|google-analytics\.com\/analytics\.js/ },
  { id: 'plausible', nombre: 'Plausible', patron: /plausible\.io\/js/i },
  { id: 'matomo', nombre: 'Matomo', patron: /matomo\.(js|php)|piwik\./i },
  { id: 'fathom', nombre: 'Fathom', patron: /usefathom\.com/i },
  { id: 'umami', nombre: 'Umami', patron: /umami\.(is|js)|data-website-id/i },
  { id: 'clarity', nombre: 'Microsoft Clarity', patron: /clarity\.ms/i },
  { id: 'hotjar', nombre: 'Hotjar', patron: /hotjar\.(com|io)/i },
]

/** Lo que mide conversiones y permite reanunciar. */
const PIXELES = [
  { id: 'meta', nombre: 'Píxel de Meta', patron: /connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(/i },
  { id: 'tiktok', nombre: 'Píxel de TikTok', patron: /analytics\.tiktok\.com|ttq\.load/i },
  { id: 'googleads', nombre: 'Google Ads', patron: /googleadservices\.com|gtag\/js\?id=AW-|AW-\d{6,}/ },
  { id: 'pinterest', nombre: 'Pinterest Tag', patron: /s\.pinimg\.com\/ct\/core\.js|pintrk\(/i },
  { id: 'linkedin', nombre: 'LinkedIn Insight', patron: /snap\.licdn\.com/i },
]

/** Lo que pide permiso antes de rastrear. */
const CONSENTIMIENTOS = [
  { id: 'cookiebot', nombre: 'Cookiebot', patron: /cookiebot|consent\.cookiebot/i },
  { id: 'onetrust', nombre: 'OneTrust', patron: /onetrust|otSDKStub|cookielaw\.org/i },
  { id: 'iubenda', nombre: 'Iubenda', patron: /iubenda/i },
  { id: 'complianz', nombre: 'Complianz', patron: /complianz/i },
  { id: 'cookieyes', nombre: 'CookieYes', patron: /cookieyes|cky-/i },
  { id: 'axeptio', nombre: 'Axeptio', patron: /axeptio/i },
  { id: 'didomi', nombre: 'Didomi', patron: /didomi/i },
  { id: 'usercentrics', nombre: 'Usercentrics', patron: /usercentrics/i },
  { id: 'osano', nombre: 'Osano', patron: /osano\.com/i },
  { id: 'cookiescript', nombre: 'CookieScript', patron: /cookie-script\.com/i },
  { id: 'borlabs', nombre: 'Borlabs Cookie', patron: /borlabs-cookie/i },
  { id: 'tarteaucitron', nombre: 'Tarteaucitron', patron: /tarteaucitron/i },
  { id: 'consentmode', nombre: 'Consent Mode de Google', patron: /consent['"]?\s*,\s*['"]default|gtag\(['"]consent/i },
  // El ultimo recurso: un banner hecho a mano. Se reconoce por el patron de
  // clases y textos, no por una libreria concreta.
  { id: 'propio', nombre: 'Banner propio', patron: /(class|id)=["'][^"']*(cookie|consent)[^"']*banner|aceptar\s+(todas\s+las\s+)?cookies/i },
]

/** Donde se compra o se reserva. */
const VENTA = [
  { id: 'shopify', nombre: 'Shopify', patron: /cdn\.shopify\.com|\/cart\/add|myshopify\.com/i },
  { id: 'woocommerce', nombre: 'WooCommerce', patron: /add-to-cart|woocommerce-page|\/\?page_id=\d+&.*add-to-cart/i },
  { id: 'prestashop', nombre: 'PrestaShop', patron: /prestashop|\/carrito|controller=cart/i },
  { id: 'glovo', nombre: 'Glovo', patron: /glovoapp\.com/i },
  { id: 'justeat', nombre: 'Just Eat', patron: /just-eat\.es|justeat\./i },
  { id: 'ubereats', nombre: 'Uber Eats', patron: /ubereats\.com/i },
  { id: 'thefork', nombre: 'TheFork', patron: /thefork\.|eltenedor\./i },
  { id: 'covermanager', nombre: 'CoverManager', patron: /covermanager\.com/i },
  { id: 'booksy', nombre: 'Booksy', patron: /booksy\.com/i },
  { id: 'treatwell', nombre: 'Treatwell', patron: /treatwell\./i },
  { id: 'calendly', nombre: 'Calendly', patron: /calendly\.com/i },
  { id: 'mindbody', nombre: 'Mindbody', patron: /mindbodyonline\.com/i },
  { id: 'booking', nombre: 'Booking.com', patron: /booking\.com\/hotel/i },
  { id: 'holded', nombre: 'Holded Tienda', patron: /holded\./i },
  { id: 'etsy', nombre: 'Etsy', patron: /etsy\.com\/(es\/)?shop/i },
  // Las cuatro siguientes salieron de analizar cadenas espanolas reales: sin
  // ellas, una tienda que vende millones al ano salia como «no se puede
  // comprar aqui», que es justo el tipo de error que tira un informe entero.
  { id: 'demandware', nombre: 'Salesforce Commerce Cloud', patron: /demandware\.store|demandware\.static|dwfrm_/i },
  { id: 'magento2', nombre: 'Magento', patron: /\/checkout\/cart\/add|Magento_Catalog/i },
  { id: 'shopware', nombre: 'Shopware', patron: /shopware|\/widgets\/checkout/i },
  { id: 'vtex', nombre: 'VTEX', patron: /vtexassets\.com|vtexcommercestable/i },
  { id: 'bigcommerce', nombre: 'BigCommerce', patron: /bigcommerce\.com|\/cart\.php/i },
  { id: 'tienda-generica', nombre: 'Carrito propio', patron: /(href|action)=["'][^"']*\/(carrito|cart|checkout|cesta|basket)\b|\badd-to-cart\b/i },
]

/** Las redes donde un creador te puede etiquetar. */
export const REDES = [
  { id: 'instagram', nombre: 'Instagram', patron: /instagram\.com\/([A-Za-z0-9._]{2,30})/i },
  { id: 'tiktok', nombre: 'TikTok', patron: /tiktok\.com\/@([A-Za-z0-9._]{2,30})/i },
  { id: 'facebook', nombre: 'Facebook', patron: /facebook\.com\/(?!sharer|plugins|tr\b)([A-Za-z0-9.]{2,60})/i },
  { id: 'youtube', nombre: 'YouTube', patron: /youtube\.com\/(@[\w.-]+|c\/[\w-]+|channel\/[\w-]+)/i },
  { id: 'linkedin', nombre: 'LinkedIn', patron: /linkedin\.com\/(company|in)\/[\w-]+/i },
  { id: 'x', nombre: 'X', patron: /(twitter|x)\.com\/(?!intent|share)([A-Za-z0-9_]{2,15})\b/i },
  { id: 'pinterest', nombre: 'Pinterest', patron: /pinterest\.[a-z.]+\/[\w-]+/i },
]

/** Quien sirve la web, leido de las cabeceras. */
export function servidor(cabeceras = {}) {
  const pistas = []
  if (cabeceras['cf-ray'] || /cloudflare/i.test(cabeceras.server || '')) pistas.push('Cloudflare')
  if (cabeceras['x-vercel-id']) pistas.push('Vercel')
  if (cabeceras['x-nf-request-id'] || /netlify/i.test(cabeceras.server || '')) pistas.push('Netlify')
  if (/^cloudfront/i.test(cabeceras.via || '') || cabeceras['x-amz-cf-id']) pistas.push('CloudFront')
  if (cabeceras['x-shopify-stage'] || /shopify/i.test(cabeceras['powered-by'] || '')) pistas.push('Shopify')
  if (cabeceras.server && !pistas.length) pistas.push(cabeceras.server.split('/')[0])
  return pistas.length ? [...new Set(pistas)].join(' + ') : null
}

/**
 * Todo lo que se reconoce en un HTML, de una pasada.
 *
 * Se le pasa el documento entero (con los scripts dentro, que es justo donde
 * estan las huellas) mas las cabeceras.
 */
export function reconocer(html = '', cabeceras = {}) {
  const texto = `${html}\n${Object.entries(cabeceras).map(([k, v]) => `${k}: ${v}`).join('\n')}`
  const plataformas = buscar(PLATAFORMAS, texto)
  return {
    // La primera de la lista manda: el catalogo esta ordenado de lo mas
    // concreto (una tienda) a lo mas general (el gestor de contenidos).
    plataforma: plataformas[0] || null,
    plataformas,
    analiticas: buscar(ANALITICAS, texto),
    pixeles: buscar(PIXELES, texto),
    consentimiento: buscar(CONSENTIMIENTOS, texto),
    venta: buscar(VENTA, texto),
    servidor: servidor(cabeceras),
  }
}

export default { reconocer, servidor, REDES }
