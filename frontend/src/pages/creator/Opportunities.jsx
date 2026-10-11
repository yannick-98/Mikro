import { useState } from 'react'
import clsx from 'clsx'
import { AlertTriangle, Briefcase, Check, Package, Send, Tag, TrendingUp, Truck } from 'lucide-react'
import { api } from '../../api/client'
import { DashboardShell } from '../../components/Dashboard'
import { Avatar, EmptyState, Modal, Spinner, Toast, useAsync, useToast } from '../../components/ui'
import PrecioReferencia from '../../components/PrecioReferencia'
import { OfertaResumen } from '../../components/ModeloDePago'
import { formatDate, formatEuro, formatFollowers } from '../../lib/format'
import { CREATOR_NAV } from './nav'

function ApplyModal({ campaign, onClose, onDone }) {
  const [fee, setFee] = useState(
    campaign && campaign.oferta?.payModel !== 'VARIABLE'
      ? Math.round((campaign.budgetMin + campaign.budgetMax) / 2)
      : 0,
  )
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      await api.apply({ campaignId: campaign.id, proposedFee: Number(fee), message })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open={!!campaign} onClose={onClose} title="Postularme a la campana">
      {campaign ? (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-2xl bg-black/[0.03] p-4">
            <p className="text-[14.5px] font-extrabold tracking-tight">{campaign.title}</p>
            <p className="mt-1 text-[13px] text-ink/55">
              {campaign.brand?.companyName} · {campaign.deliverables.join(', ')}
            </p>
            <p className="mt-2 text-[13px]">
              <OfertaResumen oferta={campaign.oferta} />
            </p>
            {campaign.oferta?.payModel === 'VARIABLE' ? (
              <p className="mt-2 flex gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[12.5px] leading-relaxed text-amber-900">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>
                  Esta campaña <strong>no paga nada fijo</strong>. Cobrarás el{' '}
                  {campaign.oferta.commissionPct}% de lo que vendas con tu código y nada más, así
                  que si no vende, no cobras. El riesgo es tuyo: míralo bien antes de aceptar.
                </span>
              </p>
            ) : campaign.oferta?.commissionPct ? (
              <p className="mt-2 flex gap-2 rounded-lg bg-brand-50 px-2.5 py-2 text-[12.5px] leading-relaxed text-brand-900">
                <TrendingUp size={13} className="mt-0.5 shrink-0" />
                <span>
                  Además del fijo, te llevas el {campaign.oferta.commissionPct}% de lo que vendas
                  con tu código, ya descontadas las devoluciones. Esa parte se liquida según
                  entren los pedidos.
                </span>
              </p>
            ) : null}
          </div>

          <div className={campaign.oferta?.payModel === 'VARIABLE' ? 'hidden' : undefined}>
            <label className="label">
              {campaign.oferta?.payModel === 'FIXED_VARIABLE'
                ? 'Tu importe fijo para esta campana (EUR)'
                : 'Tu tarifa para esta campana (EUR)'}
            </label>
            <input
              required
              type="number"
              min={0}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              className="field"
            />
            <p className="mt-1.5 text-[12px] text-ink/45">
              Recibiras {formatEuro(Math.round(Number(fee) * 0.88))} despues de la comision del 12%.
            </p>
            {/* Aqui es donde el creador decide su precio, y donde hoy se
                malvende por no saber lo que cobran los demas. */}
            <PrecioReferencia mio className="mt-3" onUsar={(ref) => setFee(ref.mediana)} />
          </div>

          <div>
            <label className="label">Por que encajas</label>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="field resize-none"
              placeholder="Cuentale a la marca por que tu audiencia le interesa y que idea tienes para el contenido. Las candidaturas con propuesta concreta se aceptan mucho mas."
            />
          </div>

          {error ? <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-semibold text-rose-700">{error}</p> : null}

          <button type="submit" disabled={sending} className="btn-primary w-full !py-3">
            {sending ? <Spinner size={16} /> : <Send size={15} />}
            Enviar candidatura
          </button>
        </form>
      ) : null}
    </Modal>
  )
}

export default function Opportunities() {
  const { toast, show, dismiss } = useToast()
  const { data, loading, reload } = useAsync(() => api.campaigns({}), [])
  const [category, setCategory] = useState('')
  const [applying, setApplying] = useState(null)
  const { data: facets } = useAsync(() => api.facets(), [])

  const items = (data?.items || [])
    .filter((c) => !category || c.category === category)
    .sort((a, b) => (b.match || 0) - (a.match || 0))

  return (
    <DashboardShell
      title="Oportunidades"
      subtitle="Campanas abiertas ordenadas por lo bien que encajan contigo."
      nav={CREATOR_NAV}
    >
      <div className="mb-5 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategory('')}
          className={clsx('chip !px-3.5 !py-1.5 !text-[12.5px] !font-bold', !category && 'chip-active')}
        >
          Todas
        </button>
        {(facets?.categories || []).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(category === c ? '' : c)}
            className={clsx('chip !px-3 !py-1.5 !text-[12.5px]', category === c && 'chip-active')}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={26} className="text-brand-600" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No hay campanas abiertas con ese filtro"
          description="Prueba a quitar el filtro de categoria. Publicamos campanas nuevas cada semana."
        />
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <article key={c.id} className="card p-5">
              <div className="flex flex-wrap items-start gap-4">
                <Avatar src={c.brand?.logoUrl} name={c.brand?.companyName || 'Marca'} size={48} rounded="rounded-xl" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[16px] font-extrabold tracking-tight">{c.title}</h2>
                    {c.match ? (
                      <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11.5px] font-black text-emerald-600">
                        {c.match}% match
                      </span>
                    ) : null}
                    {c.applied ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-black/[0.06] px-2.5 py-1 text-[11.5px] font-bold text-ink/55">
                        <Check size={12} /> Ya te has postulado
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 text-[12.5px] font-bold text-ink/50">
                    {c.brand?.companyName} · {c.brand?.city}
                  </p>
                  <p className="mt-2.5 line-clamp-2 max-w-2xl text-[13.5px] leading-relaxed text-ink/60">{c.brief}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] font-semibold text-ink/50">
                    <span>{c.category}</span>
                    <span>{c.targetCity || 'Toda Espana'}</span>
                    <span>{c.deliverables.join(', ')}</span>
                    <span>
                      {formatFollowers(c.minFollowers)} – {formatFollowers(c.maxFollowers)} seguidores
                    </span>
                    {c.endDate ? <span>Hasta el {formatDate(c.endDate)}</span> : null}
                  </div>

                  {/* El producto, con su foto si la hay. Antes habia que
                      deducirlo del brief y a veces se deducia mal. */}
                  {c.producto ? (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-black/[0.07] p-2.5">
                      {c.producto.imagen ? (
                        <img
                          src={c.producto.imagen}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/[0.04]">
                          <Package size={16} className="text-ink/30" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-bold">
                          {c.producto.nombre || 'El producto de la campaña'}
                        </span>
                        <span className="block text-[12px] text-ink/50">
                          {c.producto.valor > 0 ? `${formatEuro(c.producto.valor)} de valor` : null}
                          {c.producto.valor > 0 && c.producto.seEnvia ? ' · ' : null}
                          {c.producto.seEnvia ? 'te lo envían' : null}
                        </span>
                      </span>
                      {c.producto.url ? (
                        <a
                          href={c.producto.url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-[12px] font-bold text-brand-600 hover:underline"
                        >
                          Verlo
                        </a>
                      ) : null}
                    </div>
                  ) : null}

                  {c.oferta?.discountType === 'FREE_SHIPPING' ? (
                    <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-black/[0.05] px-2.5 py-1 text-[12px] font-bold text-ink/65">
                      <Truck size={13} /> Tu código dará envío gratis a tus seguidores
                    </p>
                  ) : c.oferta?.discountPct ? (
                    <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-black/[0.05] px-2.5 py-1 text-[12px] font-bold text-ink/65">
                      <Tag size={13} /> Tu código dará un {c.oferta.discountPct}% a tus seguidores
                    </p>
                  ) : null}

                  {c.productValue > 0 ? (
                    <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[12px] font-bold text-amber-700">
                      <Package size={13} /> Incluye producto por valor de {formatEuro(c.productValue)}
                    </p>
                  ) : null}
                </div>

                <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                  <div className="sm:text-right">
                    {/* Lo seguro, primero y grande. Lo que depende de las
                        ventas, al lado y marcado: es lo que necesita saber
                        quien decide si le compensa el trabajo. */}
                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink/35">
                      {c.oferta?.payModel === 'VARIABLE' ? 'Solo comisión' : 'Pago seguro'}
                    </p>
                    {c.oferta?.fijo ? (
                      <p className="text-[19px] font-black leading-none">
                        {formatEuro(c.oferta.fijo.min)} – {formatEuro(c.oferta.fijo.max)}
                      </p>
                    ) : (
                      <p className="text-[19px] font-black leading-none text-amber-700">
                        {c.oferta?.commissionPct}%
                      </p>
                    )}
                    {c.oferta?.commissionPct && c.oferta?.fijo ? (
                      <p className="mt-1 text-[12px] font-bold text-brand-700">
                        + {c.oferta.commissionPct}% de lo que vendas
                      </p>
                    ) : null}
                    {c.oferta?.payModel === 'VARIABLE' ? (
                      <p className="mt-1 text-[11.5px] font-semibold text-amber-700">
                        sin pago fijo
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={c.applied}
                    onClick={() => setApplying(c)}
                    className={c.applied ? 'btn-soft !py-2' : 'btn-primary !py-2'}
                  >
                    {c.applied ? 'Candidatura enviada' : 'Postularme'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <ApplyModal
        campaign={applying}
        onClose={() => setApplying(null)}
        onDone={() => {
          setApplying(null)
          show.success('Candidatura enviada. La marca la vera en su panel.')
          reload()
        }}
      />
      <Toast toast={toast} onDismiss={dismiss} />
    </DashboardShell>
  )
}
