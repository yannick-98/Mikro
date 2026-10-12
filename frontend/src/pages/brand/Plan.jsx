import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { AlertTriangle, ArrowUpRight, Check, Receipt, Sparkles, TrendingDown } from 'lucide-react'
import { api } from '../../api/client'
import { DashboardShell } from '../../components/Dashboard'
import { Spinner, Toast, useAsync, useToast } from '../../components/ui'
import { BRAND_NAV } from './nav'

/**
 * Mi plan.
 *
 * Esta pantalla hace una cosa que las paginas de precios no suelen hacer:
 * **decirle al cliente que no se suscriba cuando no le compensa**, y
 * decirselo con sus propios numeros.
 *
 * No es generosidad. Un plan que no compensa se cancela a los dos meses con
 * mal sabor, y el dia que alguien hace la cuenta y ve que lleva medio ano
 * pagando de mas, lo que se pierde no son 29 euros al mes. Que la tabla
 * ensene tambien los ahorros negativos es parte de lo mismo: una tabla en la
 * que todos los numeros son buenos no la cree nadie.
 */

const euro = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const euroExacto = (n) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

const fecha = (d) =>
  d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : null

/** Una colaboración de ejemplo, para que los porcentajes dejen de ser abstractos. */
function Ejemplo({ plan, base }) {
  const cache = 250
  const creador = cache - Math.round((cache * base) / 100)
  const empresa = cache - (cache * (base - plan.comision)) / 100

  return (
    <div className="mt-3 rounded-lg bg-black/[0.03] px-3 py-2.5 text-[12px] leading-relaxed text-ink/60">
      En una colaboración de {euro(cache)} pagas{' '}
      <strong className="text-ink">{euroExacto(empresa)}</strong>
      {plan.comision < base ? ` en vez de ${euro(cache)}` : ''}. El creador cobra {euro(creador)} en los
      tres planes.
    </div>
  )
}

function Tarjeta({ plan, base, actual, recomendado, onElegir, ocupado }) {
  const esActual = actual === plan.id
  const gratis = plan.precio === 0

  return (
    <div
      className={clsx(
        'flex flex-col rounded-2xl border p-5',
        esActual
          ? 'border-brand-600 bg-brand-50/40 ring-1 ring-brand-600/20'
          : recomendado
            ? 'border-emerald-300 bg-emerald-50/30'
            : 'border-black/[0.08]',
      )}
    >
      <div className="flex items-center gap-2">
        <h3 className="text-[15px] font-extrabold tracking-tight">{plan.nombre}</h3>
        {esActual ? (
          <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">
            Tu plan
          </span>
        ) : recomendado ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
            <Sparkles size={11} /> Para ti
          </span>
        ) : null}
      </div>

      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-[26px] font-black tabular-nums tracking-tight">
          {gratis ? '0 €' : `${plan.precio} €`}
        </span>
        <span className="text-[12.5px] font-bold text-ink/45">/mes</span>
      </p>

      <p className="mt-1 text-[13px] font-bold text-brand-700">{plan.comision}% de comisión</p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink/55">{plan.resumen}</p>

      <Ejemplo plan={plan} base={base} />

      <div className="mt-3 space-y-1.5 text-[12px] text-ink/50">
        <p className="flex gap-2">
          <Check size={13} className="mt-0.5 shrink-0 text-ink/25" />
          {plan.paraQuien}
        </p>
        {plan.umbral ? (
          <p className="flex gap-2">
            <Check size={13} className="mt-0.5 shrink-0 text-ink/25" />
            Compensa a partir de {euro(plan.umbral)} al mes en colaboraciones.
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex-1" />

      {esActual ? (
        <p className="rounded-lg bg-white px-3 py-2 text-center text-[12.5px] font-bold text-ink/45">
          Es el que tienes
        </p>
      ) : gratis ? (
        <p className="rounded-lg px-3 py-2 text-center text-[12.5px] text-ink/40">
          Es donde vuelves si te das de baja
        </p>
      ) : (
        <button
          type="button"
          onClick={() => onElegir(plan.id)}
          disabled={ocupado}
          className={recomendado ? 'btn-primary w-full justify-center' : 'btn-ghost w-full justify-center'}
        >
          {ocupado ? <Spinner size={14} /> : null} Contratar {plan.nombre}
        </button>
      )}

      {/* El ahorro va debajo del boton y se ensena aunque sea negativo. */}
      {!gratis ? (
        <p
          className={clsx(
            'mt-2 text-center text-[12px] font-bold tabular-nums',
            plan.ahorro > 0 ? 'text-emerald-700' : 'text-ink/40',
          )}
        >
          {plan.ahorro > 0
            ? `Te ahorras ${euroExacto(plan.ahorro)} al mes`
            : `Te costaría ${euroExacto(-plan.ahorro)} más al mes`}
        </p>
      ) : null}
    </div>
  )
}

export default function BrandPlan() {
  const { toast, show, dismiss } = useToast()
  const { data, loading, reload } = useAsync(() => api.planes(), [])
  const [ocupado, setOcupado] = useState(null)
  const [params, setParams] = useSearchParams()

  // Vuelta de la página de pago. El plan no se guarda aquí: lo guarda el
  // webhook cuando Stripe confirma que está cobrado. Lo que se hace es
  // volver a preguntar, que para entonces suele haber llegado.
  useEffect(() => {
    const r = params.get('suscripcion')
    if (!r) return
    params.delete('suscripcion')
    setParams(params, { replace: true })
    if (r === 'ok') {
      show.success('Plan contratado. Si tarda un momento en aparecer, es Stripe confirmándolo.')
      setTimeout(reload, 2500)
    } else {
      show.info('No se ha contratado nada.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const elegir = async (plan) => {
    setOcupado(plan)
    try {
      const { url } = await api.suscribir(plan)
      window.location.href = url
    } catch (e) {
      show.error(e.message)
      setOcupado(null)
    }
  }

  const alPortal = async () => {
    setOcupado('portal')
    try {
      const { url } = await api.portalPlan()
      window.location.href = url
    } catch (e) {
      show.error(e.message)
      setOcupado(null)
    }
  }

  const actual = data?.actual?.plan || 'FREE'
  const recomendado = data?.recomendado
  const gasto = data?.gasto

  return (
    <DashboardShell
      title="Mi plan"
      subtitle="Lo único que cambia un plan es la comisión. No hay funciones escondidas detrás."
      nav={BRAND_NAV}
      actions={
        data?.actual?.tienePasarela ? (
          <button type="button" onClick={alPortal} disabled={!!ocupado} className="btn-ghost">
            <Receipt size={14} /> Facturas y pagos
          </button>
        ) : null
      }
    >
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={26} className="text-brand-600" />
        </div>
      ) : !data?.configurado ? (
        <section className="card p-6">
          <p className="flex gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-900">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            En este entorno los pagos están en modo demostración, así que todavía no se pueden
            contratar planes. Tu comisión es el {data?.comisionBase}%.
          </p>
        </section>
      ) : (
        <>
          {/* Lo primero, su situación con sus números. */}
          <section className="card p-5">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-ink/40">
                  Tu comisión ahora
                </p>
                <p className="mt-0.5 text-[20px] font-black tabular-nums">
                  {data.planes.find((p) => p.id === actual)?.comision}%
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-ink/40">
                  {gasto.esEjemplo ? 'Ejemplo de gasto' : 'Tu gasto, últimos 30 días'}
                </p>
                <p className="mt-0.5 text-[20px] font-black tabular-nums">{euro(gasto.importe)}</p>
              </div>
              {data.actual?.terminaEl ? (
                <p className="text-[12.5px] text-amber-800">
                  Te has dado de baja. Mantienes tu comisión hasta el {fecha(data.actual.terminaEl)}.
                </p>
              ) : data.actual?.renuevaEl ? (
                <p className="text-[12.5px] text-ink/45">
                  Se renueva el {fecha(data.actual.renuevaEl)}.
                </p>
              ) : null}
            </div>

            {gasto.esEjemplo ? (
              <p className="mt-3 text-[12px] leading-relaxed text-ink/45">
                Todavía no tienes colaboraciones suficientes para calcularlo con tus datos, así que
                la tabla está hecha con {euro(gasto.importe)} al mes de ejemplo. En cuanto cierres un
                par, se recalcula sola.
              </p>
            ) : recomendado !== actual ? (
              <p className="mt-3 flex gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-emerald-900">
                <TrendingDown size={14} className="mt-0.5 shrink-0" />
                Con lo que gastas, te sale mejor el plan{' '}
                <strong>{data.planes.find((p) => p.id === recomendado)?.nombre}</strong>.
                {recomendado === 'FREE'
                  ? ' Sí, te estamos diciendo que te des de baja: a este ritmo el plan no te compensa.'
                  : ''}
              </p>
            ) : (
              <p className="mt-3 text-[12.5px] text-ink/45">
                Con lo que gastas, el que tienes es el que más te conviene.
              </p>
            )}
          </section>

          <section className="mt-4 grid gap-3 lg:grid-cols-3">
            {data.planes.map((p) => (
              <Tarjeta
                key={p.id}
                plan={p}
                base={data.comisionBase}
                actual={actual}
                recomendado={p.id === recomendado && p.id !== actual}
                onElegir={elegir}
                ocupado={ocupado === p.id}
              />
            ))}
          </section>

          <section className="card mt-4 p-5">
            <h2 className="text-[14px] font-extrabold tracking-tight">La letra pequeña, en grande</h2>
            <ul className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-ink/55">
              <li className="flex gap-2">
                <Check size={14} className="mt-0.5 shrink-0 text-ink/25" />
                <span>
                  <strong className="text-ink/75">El creador cobra lo mismo tengas el plan que tengas.</strong>{' '}
                  Lo que baja es lo que pagas tú, y sale de nuestra comisión. Su trato no cambia
                  porque tú contrates algo.
                </span>
              </li>
              <li className="flex gap-2">
                <Check size={14} className="mt-0.5 shrink-0 text-ink/25" />
                <span>
                  La comisión se fija al cerrar cada colaboración. Suscribirte hoy no abarata lo que
                  acordaste ayer, y darte de baja no encarece lo que está a medias.
                </span>
              </li>
              <li className="flex gap-2">
                <Check size={14} className="mt-0.5 shrink-0 text-ink/25" />
                <span>
                  Sin permanencia. Te das de baja desde «Facturas y pagos» y mantienes tu comisión
                  hasta el final del mes que ya has pagado.
                </span>
              </li>
              <li className="flex gap-2">
                <Check size={14} className="mt-0.5 shrink-0 text-ink/25" />
                <span>
                  Si falla el cobro no te subimos la comisión de golpe: te avisamos y tienes unos
                  días para arreglarlo.
                </span>
              </li>
            </ul>

            {data.actual?.tienePasarela ? (
              <button type="button" onClick={alPortal} disabled={!!ocupado} className="btn-ghost mt-4">
                <ArrowUpRight size={14} /> Cambiar de plan, tarjeta o darme de baja
              </button>
            ) : null}
          </section>
        </>
      )}

      <Toast toast={toast} onDismiss={dismiss} />
    </DashboardShell>
  )
}
