import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Check, FileText, X } from 'lucide-react'
import { api } from '../../api/client'
import { DashboardShell, StatusPill } from '../../components/Dashboard'
import { EmptyState, Spinner, Toast, useAsync, useToast } from '../../components/ui'
import { APPLICATION_STATUS, formatEuro, formatRelative } from '../../lib/format'
import { CREATOR_NAV } from './nav'

export default function MyApplications() {
  const { toast, show, dismiss } = useToast()
  const { data, loading, reload } = useAsync(() => api.applications(), [])
  const [busy, setBusy] = useState(null)
  const [filter, setFilter] = useState('ALL')

  const all = data?.items || []
  const invitations = all.filter((a) => a.source === 'BRAND' && a.status === 'PENDING')
  const items = filter === 'ALL' ? all : all.filter((a) => a.status === filter)

  async function confirm(app) {
    setBusy(app.id)
    try {
      await api.confirmInvitation(app.id)
      show.success('Invitacion aceptada. Ya tienes una colaboracion en marcha.')
      reload()
    } catch (e) {
      show.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function withdraw(app) {
    setBusy(app.id)
    try {
      await api.withdrawApplication(app.id)
      show.info('Candidatura retirada')
      reload()
    } catch (e) {
      show.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <DashboardShell
      title="Mis candidaturas"
      subtitle="Lo que has enviado y las invitaciones que has recibido."
      nav={CREATOR_NAV}
    >
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={26} className="text-brand-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {invitations.length ? (
            <section>
              <h2 className="mb-3 text-[16px] font-extrabold tracking-tight">
                Invitaciones de marcas ({invitations.length})
              </h2>
              <div className="space-y-3">
                {invitations.map((a) => (
                  <article key={a.id} className="rounded-2xl border-2 border-violet-200 bg-violet-50/50 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15.5px] font-extrabold tracking-tight">{a.campaign.title}</p>
                        <p className="mt-0.5 text-[13px] font-bold text-ink/55">
                          {a.campaign.brand?.companyName} te ha invitado a colaborar
                        </p>
                        {a.message ? (
                          <p className="mt-2.5 rounded-xl bg-white px-3.5 py-3 text-[13.5px] leading-relaxed text-ink/70">
                            {a.message}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-ink/35">Te ofrecen</p>
                          <p className="text-[22px] font-black leading-none">{formatEuro(a.proposedFee)}</p>
                          <p className="mt-1 text-[11.5px] text-ink/45">
                            recibes {formatEuro(Math.round(a.proposedFee * 0.88))}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => withdraw(a)} disabled={busy === a.id} className="btn-ghost !px-3 !py-2 !text-[12.5px]">
                            <X size={14} /> Rechazar
                          </button>
                          <button type="button" onClick={() => confirm(a)} disabled={busy === a.id} className="btn-primary !px-3 !py-2 !text-[12.5px]">
                            <Check size={14} /> Aceptar
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { id: 'ALL', label: `Todas (${all.length})` },
                { id: 'PENDING', label: 'Pendientes' },
                { id: 'ACCEPTED', label: 'Aceptadas' },
                { id: 'REJECTED', label: 'Descartadas' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={clsx('chip !px-3.5 !py-1.5 !text-[12.5px] !font-bold', filter === f.id && 'chip-active')}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {items.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No tienes candidaturas aqui"
                description="Postulate a las campanas abiertas que encajen con tu perfil y aparecerán en esta lista."
                action={
                  <Link to="/creador/oportunidades" className="btn-dark">
                    Ver oportunidades
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {items.map((a) => (
                  <article key={a.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[15px] font-extrabold tracking-tight">{a.campaign.title}</h3>
                          <StatusPill status={a.status} map={APPLICATION_STATUS} />
                          {a.source === 'BRAND' ? (
                            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700">
                              Invitacion
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[12.5px] font-semibold text-ink/50">
                          {a.campaign.brand?.companyName} · {a.campaign.category} · {formatRelative(a.createdAt)}
                        </p>
                        {a.message ? (
                          <p className="mt-2.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink/60">{a.message}</p>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-ink/35">Propuesta</p>
                          <p className="text-[20px] font-black leading-none">{formatEuro(a.proposedFee)}</p>
                        </div>
                        {a.status === 'PENDING' && a.source === 'CREATOR' ? (
                          <button
                            type="button"
                            onClick={() => withdraw(a)}
                            disabled={busy === a.id}
                            className="btn-ghost !px-3 !py-1.5 !text-[12px]"
                          >
                            Retirar
                          </button>
                        ) : null}
                        {a.status === 'ACCEPTED' ? (
                          <Link to="/creador/colaboraciones" className="btn-soft !px-3 !py-1.5 !text-[12px]">
                            Ver colaboracion
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      <Toast toast={toast} onDismiss={dismiss} />
    </DashboardShell>
  )
}
