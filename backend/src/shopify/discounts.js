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
export function buildCode(handle, prefix = 'MIKRO') {
  const base = (handle || 'creador')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)

  const alfabeto = '0123456789BCDFGHJKLMNPQRSTVWXYZ'
  const bytes = crypto.randomBytes(4)
  const sufijo = Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')

  return `${prefix}-${base || 'CREADOR'}-${sufijo}`
}

/** Crea el descuento en Shopify y devuelve su identificador. */
export async function createDiscount(shopDomain, { code, title, percentage, startsAt, endsAt, oncePerCustomer = false }) {
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
