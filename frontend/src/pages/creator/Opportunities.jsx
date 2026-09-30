import { useState } from 'react'
import clsx from 'clsx'
import { Briefcase, Check, Package, Send } from 'lucide-react'
import { api } from '../../api/client'
import { DashboardShell } from '../../components/Dashboard'
import { Avatar, EmptyState, Modal, Spinner, Toast, useAsync, useToast } from '../../components/ui'
import { formatDate, formatEuro, formatFollowers } from '../../lib/format'
import { CREATOR_NAV } from './nav'

function ApplyModal({ campaign, onClose, onDone }) {
  const [fee, setFee] = useState(campaign ? Math.round((campaign.budgetMin + campaign.budgetMax) / 2) : 0)
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
            <p className="mt-2 text-[13px] font-bold">
              Presupuesto: {formatEuro(campaign.budgetMin)} – {formatEuro(campaign.budgetMax)}
            </p>
          </div>

          <div>
            <label className="label">Tu tarifa para esta campana (EUR)</label>
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

                  {c.productValue > 0 ? (
                    <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-[12px] font-bold text-amber-700">
                      <Package size={13} /> Incluye producto por valor de {formatEuro(c.productValue)}
                    </p>
                  ) : null}
                </div>

                <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                  <div className="sm:text-right">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink/35">Presupuesto</p>
                    <p className="text-[19px] font-black leading-none">
                      {formatEuro(c.budgetMin)} – {formatEuro(c.budgetMax)}
                    </p>
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
