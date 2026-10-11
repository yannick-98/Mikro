import { Package, Truck } from 'lucide-react'

/**
 * Qué producto se promociona.
 *
 * Hoy el creador tiene que deducirlo leyendo el brief, y a veces no acierta:
 * se postula a algo que no es lo que pensaba, o describe en el vídeo un
 * producto que no era. Con la ficha delante sabe qué es, cuánto cuesta y
 * dónde está antes de decidir si encaja.
 *
 * Y el enlace del producto no es decorativo: es el destino natural del
 * enlace que después compartirá el creador, así que ponerlo aquí ahorra
 * escribirlo otra vez cuando se cree el código.
 */
export default function FichaProducto({ valor, onChange }) {
  const {
    productName = '',
    productUrl = '',
    productImage = '',
    productSku = '',
    productValue = 0,
    shipsProduct = false,
  } = valor

  const set = (campo) => (e) =>
    onChange({ ...valor, [campo]: e.target.type === 'number' ? Number(e.target.value) : e.target.value })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Package size={15} className="text-ink/35" />
        <span className="text-[13.5px] font-extrabold tracking-tight">El producto</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Nombre</label>
          <input
            value={productName}
            onChange={set('productName')}
            className="field"
            placeholder="Hogaza de masa madre de espelta"
          />
        </div>
        <div>
          <label className="label">Referencia o SKU (opcional)</label>
          <input value={productSku} onChange={set('productSku')} className="field" placeholder="PAN-ESP-800" />
        </div>
      </div>

      <div>
        <label className="label">Enlace en tu tienda</label>
        <input
          value={productUrl}
          onChange={set('productUrl')}
          className="field"
          placeholder="https://tutienda.com/products/masa-madre"
        />
        <p className="mt-1.5 text-[12px] text-ink/45">
          Es a donde llevará el enlace que comparta el creador, así que no hay que escribirlo dos
          veces.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Imagen (opcional)</label>
          <input
            value={productImage}
            onChange={set('productImage')}
            className="field"
            placeholder="https://…/foto.jpg"
          />
        </div>
        <div>
          <label className="label">Valor del producto (EUR)</label>
          <input
            type="number"
            min={0}
            value={productValue}
            onChange={set('productValue')}
            className="field tabular-nums"
          />
          <p className="mt-1.5 text-[12px] text-ink/45">
            Si además del pago le cedes producto, dilo: sube el atractivo de la campaña.
          </p>
        </div>
      </div>

      {/* Separado del valor a propósito: se puede ceder producto sin enviar
          nada (una cena, una clase) y se puede enviar algo que no se cede
          (una muestra que vuelve). */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-black/[0.03] px-3.5 py-3">
        <input
          type="checkbox"
          checked={shipsProduct}
          onChange={(e) => onChange({ ...valor, shipsProduct: e.target.checked })}
          className="mt-0.5 h-4 w-4 accent-brand-600"
        />
        <span className="text-[13px] font-semibold leading-snug">
          <span className="inline-flex items-center gap-1.5">
            <Truck size={13} /> Hay que enviarle el producto
          </span>
          <span className="block text-[12px] font-normal text-ink/45">
            Al aceptar, el creador te dará su dirección y podrás marcar el envío. Así nadie se
            queda esperando sin saber si salió.
          </span>
        </span>
      </label>
    </div>
  )
}
