import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { AlertTriangle, Package, ShoppingBag, Wrench } from 'lucide-react'

/**
 * Que se promociona y como se paga.
 *
 * El pago por comisión se calcula sobre las ventas atribuidas al código del
 * creador, que es lo que mide la app de Shopify. Si la tienda no está
 * conectada, esa cifra no existe: las opciones con variable se desactivan y
 * se dice por qué, en vez de dejar publicar una oferta que después nadie
 * podría liquidar.
 *
 * Lo mismo con los servicios. Una clase de yoga también se vende, pero hoy no
 * sabemos medir esa venta, y prometer una comisión sobre algo que no vamos a
 * poder contar es una promesa que acaba rompiéndose delante del creador.
 */

export const TIPOS = [
  { id: 'PRODUCT', texto: 'Un producto', detalle: 'Algo que se compra', icono: Package },
  { id: 'SERVICE', texto: 'Un servicio', detalle: 'Algo que se reserva o se contrata', icono: Wrench },
]

export const MODELOS = [
  {
    id: 'FIXED',
    texto: 'Pago fijo',
    detalle: 'Un importe acordado, pase lo que pase',
    variable: false,
  },
  {
    id: 'FIXED_VARIABLE',
    texto: 'Fijo + comisión',
    detalle: 'Un importe seguro más un % de lo que venda',
    variable: true,
  },
  {
    id: 'VARIABLE',
    texto: 'Solo comisión',
    detalle: 'Cobra únicamente un % de lo que venda',
    variable: true,
  },
]

function Opcion({ activo, disponible = true, titulo, detalle, icono: Icono, onClick }) {
  return (
    <button
      type="button"
      onClick={disponible ? onClick : undefined}
      disabled={!disponible}
      className={clsx(
        'rounded-xl border-2 px-3.5 py-3 text-left transition',
        activo
          ? 'border-ink bg-ink text-white'
          : disponible
            ? 'border-black/[0.08] hover:border-black/20'
            : 'cursor-not-allowed border-black/[0.06] opacity-45',
      )}
    >
      <span className="flex items-center gap-1.5 text-[13.5px] font-bold">
        {Icono ? <Icono size={14} /> : null}
        {titulo}
      </span>
      <span className={clsx('mt-0.5 block text-[12px]', activo ? 'text-white/60' : 'text-ink/45')}>
        {detalle}
      </span>
    </button>
  )
}

export default function ModeloDePago({ valor, onChange, tieneTienda }) {
  const { kind = 'PRODUCT', payModel = 'FIXED', commissionPct = 10, discountPct = 0 } = valor
  const set = (cambios) => onChange({ ...valor, ...cambios })

  const puedeVariable = kind === 'PRODUCT' && tieneTienda
  const conVariable = payModel === 'FIXED_VARIABLE' || payModel === 'VARIABLE'

  // Cambiar a servicio con un modelo variable puesto dejaría una combinación
  // que el servidor rechaza. Se corrige aquí, al vuelo.
  const cambiarTipo = (nuevo) =>
    set({
      kind: nuevo,
      ...(nuevo === 'SERVICE' && conVariable ? { payModel: 'FIXED' } : {}),
    })

  return (
    <div className="space-y-4">
      <div>
        <span className="label">¿Qué quieres promocionar?</span>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {TIPOS.map((t) => (
            <Opcion
              key={t.id}
              activo={kind === t.id}
              titulo={t.texto}
              detalle={t.detalle}
              icono={t.icono}
              onClick={() => cambiarTipo(t.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <span className="label">¿Cómo pagas al creador?</span>
        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          {MODELOS.map((m) => (
            <Opcion
              key={m.id}
              activo={payModel === m.id}
              disponible={!m.variable || puedeVariable}
              titulo={m.texto}
              detalle={m.detalle}
              onClick={() => set({ payModel: m.id })}
            />
          ))}
        </div>

        {kind === 'SERVICE' ? (
          <p className="mt-2 flex gap-2 text-[12px] leading-relaxed text-ink/45">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            En un servicio todavía no sabemos medir la venta, así que solo se puede pagar un
            importe fijo.
          </p>
        ) : !tieneTienda ? (
          <p className="mt-2 flex gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900">
            <ShoppingBag size={14} className="mt-0.5 shrink-0" />
            <span>
              Para pagar por comisión necesitas{' '}
              <Link to="/empresa/perfil" className="font-bold underline">
                conectar tu tienda de Shopify
              </Link>
              . Es lo que nos permite saber qué ha vendido cada creador: sin eso no podríamos
              calcular lo que le toca, y no vamos a dejarte prometer algo que luego no podemos
              liquidar.
            </span>
          </p>
        ) : null}
      </div>

      {conVariable ? (
        <div>
          <label className="label">Comisión para el creador</label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <input
                type="number"
                min={1}
                max={50}
                value={commissionPct}
                onChange={(e) => set({ commissionPct: Number(e.target.value) })}
                className="field !mt-0 w-[110px] pr-7 tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-ink/40">
                %
              </span>
            </div>
            <p className="min-w-[240px] flex-1 text-[12.5px] leading-relaxed text-ink/50">
              Sobre la venta neta de su código, ya descontadas las devoluciones. Se liquida según
              entren los pedidos, no por adelantado.
            </p>
          </div>
        </div>
      ) : null}

      {/* El descuento del código. Es parte de la oferta comercial y no una
          preferencia de la tienda: la misma marca hace un 10% en una campaña
          y un 25% en una liquidación. */}
      {kind === 'PRODUCT' ? (
        <div>
          <label className="label">Descuento del código</label>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <input
                type="number"
                min={0}
                max={70}
                value={discountPct}
                onChange={(e) => set({ discountPct: Number(e.target.value) })}
                className="field !mt-0 w-[110px] pr-7 tabular-nums"
                disabled={!tieneTienda}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-ink/40">
                %
              </span>
            </div>
            <p className="min-w-[240px] flex-1 text-[12.5px] leading-relaxed text-ink/50">
              {!tieneTienda
                ? 'Necesitas la tienda conectada para que Mikro cree los códigos.'
                : discountPct > 0
                  ? 'Lo que se ahorrarán sus seguidores al usar su código. Es el argumento de venta del creador, así que cuanto mejor sea, más fácil le resulta contarlo.'
                  : 'Sin indicar, se usará el descuento por defecto de tu tienda.'}
            </p>
          </div>

          {/* La cuenta que nadie hace hasta que es tarde. */}
          {discountPct > 0 && conVariable && commissionPct > 0 ? (
            <p className="mt-2 flex gap-2 rounded-xl bg-black/[0.03] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink/60">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-ink/35" />
              <span>
                De cada 100 € a precio de catálogo, el cliente paga {100 - discountPct} € y de ahí
                salen {Math.round(((100 - discountPct) * commissionPct) / 100)} € para el creador.
                Te quedan <strong>{100 - discountPct - Math.round(((100 - discountPct) * commissionPct) / 100)} €</strong>{' '}
                antes de tus costes.
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {payModel === 'VARIABLE' ? (
        <p className="flex gap-2 rounded-xl bg-black/[0.03] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink/60">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-ink/35" />
          <span>
            Sin importe fijo, el creador no cobra nada por adelantado y asume todo el riesgo. Se lo
            diremos con esas palabras cuando vea tu campaña, así que espera menos candidaturas y
            una comisión más alta de lo habitual. Suele funcionar con marcas que el creador ya
            conoce.
          </span>
        </p>
      ) : null}
    </div>
  )
}

/** Resumen de una oferta, para las tarjetas. */
export function OfertaResumen({ oferta, className }) {
  if (!oferta) return null
  const { payModel, fijo, commissionPct } = oferta

  return (
    <span className={clsx('inline-flex flex-wrap items-center gap-1.5', className)}>
      {fijo ? (
        <span className="font-bold text-ink">
          {fijo.min === fijo.max ? `${fijo.min} €` : `${fijo.min} – ${fijo.max} €`}
        </span>
      ) : null}
      {commissionPct ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11.5px] font-bold text-brand-700">
          {fijo ? '+ ' : ''}
          {commissionPct}% de lo que vendas
        </span>
      ) : null}
      {payModel === 'VARIABLE' ? (
        <span className="text-[11.5px] font-semibold text-amber-700">sin fijo</span>
      ) : null}
      {oferta.discountPct ? (
        <span className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-[11.5px] font-bold text-ink/60">
          código −{oferta.discountPct}%
        </span>
      ) : null}
    </span>
  )
}
