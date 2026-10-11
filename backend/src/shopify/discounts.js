/**
 * Codigos de descuento: el hilo que une una colaboracion con sus ventas.
 *
 * Cada creador de una campana recibe su propio codigo. Cuando entra un pedido
 * con ese codigo, la venta es de esa colaboracion. Es mas fiable que un enlace
 * con UTM, que se pierde en cuanto el seguidor abre la tienda en otro
 * dispositivo o la red le quita los parametros.
 */
import crypto from 'node:crypto'
import { adminGraphql, throwOnUserErrors } from './admin.js'

const CREATE = `
  mutation crearCodigo($basicCodeDiscount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }
`

/**
 * Envio gratis.
 *
 * Mutacion distinta de la del descuento basico, no un parametro de aquella:
 * un envio gratis no toca el precio del producto, toca el del envio, y
 * Shopify lo modela aparte. Los campos estan comprobados contra el esquema
 * de la version que tenemos fijada.
 */
const CREATE_FREE_SHIPPING = `
  mutation crearEnvioGratis($freeShippingCodeDiscount: DiscountCodeFreeShippingInput!) {
    discountCodeFreeShippingCreate(freeShippingCodeDiscount: $freeShippingCodeDiscount) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }
`

const DEACTIVATE = `
  mutation desactivarCodigo($id: ID!) {
    discountCodeDeactivate(id: $id) {
      userErrors { field message }
    }
  }
`

/**
 * Codigo legible y dificil de adivinar.
 *
 * El nombre del creador delante para que lo reconozca y lo diga en camara; un
 * sufijo aleatorio detras para que nadie lo acierte por probar. Sin vocales en
 * el alfabeto del sufijo: asi no sale ninguna palabra desafortunada por azar.
 */
/**
 * Limpia un codigo escrito a mano.
 *
 * Shopify acepta casi cualquier cosa, pero un codigo con espacios o acentos
 * es un codigo que el seguidor teclea mal y una venta que nadie atribuye.
 */
export function normalizeCode(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export function buildCode(handle, prefix = 'MIKRO') {
  const base = (handle || 'creador')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)

  // Cinco caracteres y no cuatro. Con cuatro habia 31^4 = 923.000
  // combinaciones, que suena a mucho y no lo es: por la paradoja del
  // cumpleanios, 300 codigos ya chocan una vez de cada veinte. La unicidad de
  // verdad la garantiza la clave unica de la base; esto solo tiene que hacer
  // el choque raro, y con cinco pasa a 28 millones.
  const alfabeto = '0123456789BCDFGHJKLMNPQRSTVWXYZ'
  const bytes = crypto.randomBytes(5)
  const sufijo = Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')

  return `${prefix}-${base || 'CREADOR'}-${sufijo}`
}

/**
 * Crea el codigo en Shopify y devuelve su identificador.
 *
 * discountType decide que clase de descuento es. El porcentaje se ignora en
 * un envio gratis: ahi no hay porcentaje que aplicar, y arrastrarlo solo
 * serviria para que alguien lo pintara como "0%" mas adelante.
 */
export async function createDiscount(shopDomain, opciones) {
  if (opciones.discountType === 'FREE_SHIPPING') return createFreeShipping(shopDomain, opciones)
  return createPercentage(shopDomain, opciones)
}

/** Envio gratis para cualquier destino de la tienda. */
async function createFreeShipping(shopDomain, { code, title, startsAt, endsAt, oncePerCustomer = false }) {
  const data = await adminGraphql(shopDomain, CREATE_FREE_SHIPPING, {
    freeShippingCodeDiscount: {
      title: title || `Mikro · ${code}`,
      code,
      startsAt: (startsAt || new Date()).toISOString(),
      ...(endsAt ? { endsAt: new Date(endsAt).toISOString() } : {}),
      context: { all: 'ALL' },
      // A todos los destinos a los que ya envia la tienda. Limitarlo por pais
      // seria una decision de la tienda, no nuestra.
      destination: { all: true },
      appliesOncePerCustomer: oncePerCustomer,
    },
  })

  const result = throwOnUserErrors(
    data.discountCodeFreeShippingCreate,
    'No se pudo crear el codigo de envio gratis',
  )
  return result.codeDiscountNode.id
}

async function createPercentage(shopDomain, { code, title, percentage, startsAt, endsAt, oncePerCustomer = false }) {
  const data = await adminGraphql(shopDomain, CREATE, {
    basicCodeDiscount: {
      title: title || `Mikro · ${code}`,
      code,
      startsAt: (startsAt || new Date()).toISOString(),
      ...(endsAt ? { endsAt: new Date(endsAt).toISOString() } : {}),
      // context y no customerSelection: este ultimo esta obsoleto. "all: ALL"
      // significa cualquier comprador, y el valor es un enum (DiscountBuyerSelection),
      // no un booleano, asi que en las variables viaja como la cadena 'ALL'.
      context: { all: 'ALL' },
      customerGets: {
        value: { percentage: percentage / 100 },
        items: { all: true },
      },
      // Una vez por cliente solo si la tienda lo pide.
      //
      // Estaba puesto por defecto con el argumento de que nadie se abastezca
      // para el ano. Suena razonable y sale caro: un codigo con limite por
      // cliente no se puede aplicar a un pedido creado desde el admin, y
      // obliga a identificar al comprador. Es una restriccion que la tienda no
      // ha pedido, asi que deja de venir puesta de serie.
      appliesOncePerCustomer: oncePerCustomer,
    },
  })

  const result = throwOnUserErrors(data.discountCodeBasicCreate, 'No se pudo crear el codigo')
  return result.codeDiscountNode.id
}

/**
 * Desactiva el descuento.
 *
 * Desactivar y no borrar: si se borra, los pedidos antiguos pierden la
 * referencia y con ella el historico de ventas de esa colaboracion.
 */
export async function deactivateDiscount(shopDomain, discountGid) {
  const data = await adminGraphql(shopDomain, DEACTIVATE, { id: discountGid })
  throwOnUserErrors(data.discountCodeDeactivate, 'No se pudo desactivar el codigo')
}

export default { buildCode, createDiscount, deactivateDiscount }
