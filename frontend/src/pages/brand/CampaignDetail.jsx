import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowLeft, Check, Send, Sparkles, Trash2, Users, X } from 'lucide-react'
import { api } from '../../api/client'
import { DashboardShell, StatusPill } from '../../components/Dashboard'
import { Avatar, EmptyState, Modal, PlatformIcon, Spinner, Toast, VerifiedBadge, useAsync, useToast } from '../../components/ui'
import { CAMPAIGN_STATUS, APPLICATION_STATUS, formatEuro, formatFollowers, formatPercent, formatRelative } from '../../lib/format'
import { BRAND_NAV } from './nav'

function ApplicantCard({ application, onAccept, onReject, busy }) {
  const c = application.creator
  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar src={c.avatarUrl} name={c.displayName} size={54} rounded="rounded-xl" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/creador/${c.handle}`} className="text-[15px] font-extrabold tracking-tight hover:text-brand-600">
              {c.displayName}
            </Link>
            {c.verified ? <VerifiedBadge size={14} /> : null}
            <StatusPill status={application.status} map={APPLICATION_STATUS} />
            {application.source === 'BRAND' ? (
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700">Invitado por ti</span>
            ) : null}
          </div>

          <p className="mt-0.5 text-[12.5px] font-semibold text-ink/50">
            {c.category} · {c.city} · {formatFollowers(c.totalFollowers)} seguidores · {formatPercent(c.engagementRate)} engagement
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {c.socialAccounts.map((a) => (
              <span key={a.platform} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink/55">
                <PlatformIcon platform={a.platform} size={14} />
                {formatFollowers(a.followers)}
              </span>
            ))}
          </div>

          {application.message ? (
            <p className="mt-3 rounded-xl bg-black/[0.03] px-3.5 py-3 text-[13.5px] leading-relaxed text-ink/70">
              {application.message}
            </p>
          ) : null}

          <p className="mt-2.5 text-[11.5px] font-medium text-ink/40">{formatRelative(application.createdAt)}</p>
        </div>

        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink/35">Propone</p>
            <p className="text-[22px] font-black leading-none">{formatEuro(application.proposedFee)}</p>
          </div>
          {c.match ? (
            <span className="self-end rounded-lg bg-emerald-50 px-2.5 py-1 text-[12px] font-black text-emerald-600">
              {c.match}% match
            </span>
          ) : null}

          {application.status === 'PENDING' ? (
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={() => onReject(application)} disabled={busy} className="btn-ghost !px-3">
                <X size={15} /> Descartar
              </button>
              <button type="button" onClick={() => onAccept(application)} disabled={busy} className="btn-primary !px-3">
                <Check size={15} /> Aceptar
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default function CampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast, show, dismiss } = useToast()
  const { data, loading, reload } = useAsync(() => api.campaign(id), [id])
  const { data: reco } = useAsync(() => api.recommended(id), [id])
  const [busy, setBusy] = useState(false)
  const [invite, setInvite] = useState(null)
  const [tab, setTab] = useState('applications')

  if (loading) {
    return (
      <DashboardShell title="Campana" nav={BRAND_NAV}>
        <div className="flex justify-center py-20">
          <Spinner size={26} className="text-brand-600" />
        </div>
      </DashboardShell>
    )
  }

  const c = data?.campaign
  if (!c) {
    return (
      <DashboardShell title="Campana" nav={BRAND_NAV}>
        <EmptyState title="Campana no encontrada" action={<Link to="/empresa/campanas" className="btn-dark">Volver</Link>} />
      </DashboardShell>
    )
  }

  async function accept(application) {
    setBusy(true)
    try {
      await api.acceptApplication(application.id, application.proposedFee)
      show.success(`Colaboracion creada con ${application.creator.displayName}`)
      reload()
    } catch (e) {
      show.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function reject(application) {
    setBusy(true)
    try {
      await api.rejectApplication(application.id)
      show.info('Candidatura descartada')
      reload()
    } catch (e) {
      show.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeCampaign() {
    if (!window.confirm('Seguro que quieres eliminar esta campana? Se perderan sus candidaturas.')) return
    try {
      await api.deleteCampaign(c.id)
      navigate('/empresa/campanas')
    } catch (e) {
      show.error(e.message)
    }
  }

  async function changeStatus(status) {
    try {
      await api.updateCampaign(c.id, { status })
      show.success(status === 'OPEN' ? 'Campana reabierta' : 'Campana cerrada a nuevas candidaturas')
      reload()
    } catch (e) {
      show.error(e.message)
    }
  }

  const pending = data.applications.filter((a) => a.status === 'PENDING')
  const resolved = data.applications.filter((a) => a.status !== 'PENDING')

  return (
    <DashboardShell
      title={c.title}
      subtitle={`${c.category} · ${c.targetCity || 'Toda Espana'}`}
      nav={BRAND_NAV}
      actions={
        <>
          <Link to="/empresa/campanas" className="btn-ghost">
            <ArrowLeft size={15} /> Volver
          </Link>
          {c.status === 'OPEN' ? (
            <button type="button" onClick={() => changeStatus('CLOSED')} className="btn-ghost">
              Cerrar campana
            </button>
          ) : (
            <button type="button" onClick={() => changeStatus('OPEN')} className="btn-ghost">
              Reabrir
            </button>
          )}
          <button type="button" onClick={removeCampaign} className="btn-ghost !text-rose-600">
            <Trash2 size={15} />
          </button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <div className="mb-1 flex gap-6 border-b border-black/[0.07]">
            <button type="button" onClick={() => setTab('applications')} className={clsx('tab', tab === 'applications' && 'tab-active')}>
              Candidaturas
              <span className="ml-1.5 rounded-full bg-black/5 px-1.5 py-0.5 text-[11px] text-ink/50">
                {data.applications.length}
              </span>
            </button>
            <button type="button" onClick={() => setTab('recommended')} className={clsx('tab', tab === 'recommended' && 'tab-active')}>
              Recomendados por Mikro
            </button>
          </div>

          {tab === 'applications' ? (
            data.applications.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Todavia no hay candidaturas"
                description="Las campanas suelen recibir las primeras candidaturas en menos de 24 horas. Tambien puedes invitar tu a creadores concretos."
                action={
                  <button type="button" onClick={() => setTab('recommended')} className="btn-dark">
                    Ver recomendados
                  </button>
                }
              />
            ) : (
              <div className="space-y-4">
                {pending.length ? (
                  <>
                    <h2 className="text-[15px] font-extrabold tracking-tight">Pendientes ({pending.length})</h2>
                    {pending.map((a) => (
                      <ApplicantCard key={a.id} application={a} onAccept={accept} onReject={reject} busy={busy} />
                    ))}
                  </>
                ) : null}
                {resolved.length ? (
                  <>
                    <h2 className="pt-2 text-[15px] font-extrabold tracking-tight">Resueltas ({resolved.length})</h2>
                    {resolved.map((a) => (
                      <ApplicantCard key={a.id} application={a} onAccept={accept} onReject={reject} busy={busy} />
                    ))}
                  </>
                ) : null}
              </div>
            )
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
                <Sparkles size={18} className="mt-0.5 shrink-0 text-brand-600" />
                <p className="text-[13.5px] leading-relaxed text-ink/65">
                  Estos perfiles son los que mejor encajan con tu brief segun categoria, ciudad, tamano de audiencia y
                  presupuesto. Invitarles no tiene coste.
                </p>
              </div>

              {(reco?.items || []).map((creator) => (
                <article key={creator.id} className="card flex flex-wrap items-center gap-4 p-4">
                  <Avatar src={creator.avatarUrl} name={creator.displayName} size={48} rounded="rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/creador/${creator.handle}`} className="flex items-center gap-1.5">
                      <span className="truncate text-[14.5px] font-extrabold tracking-tight hover:text-brand-600">
                        {creator.displayName}
                      </span>
                      {creator.verified ? <VerifiedBadge size={13} /> : null}
                    </Link>
                    <p className="mt-0.5 text-[12.5px] font-semibold text-ink/50">
                      {creator.category} · {creator.city} · {formatFollowers(creator.totalFollowers)} ·{' '}
                      {formatPercent(creator.engagementRate)}
                    </p>
                  </div>
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[12.5px] font-black text-emerald-600">
                    {creator.match}%
                  </span>
                  <p className="text-[13px] font-bold text-ink/60">
                    {creator.rates.post ? formatEuro(creator.rates.post) : '—'}
                  </p>
                  <button type="button" onClick={() => setInvite(creator)} className="btn-dark !px-3.5 !py-2 !text-[12.5px]">
                    <Send size={14} /> Invitar
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold tracking-tight">Detalles</h2>
              <StatusPill status={c.status} map={CAMPAIGN_STATUS} />
            </div>
            <dl className="mt-4 space-y-3 text-[13.5px]">
              {[
                ['Presupuesto', `${formatEuro(c.budgetMin)} – ${formatEuro(c.budgetMax)}`],
                ['Entregables', c.deliverables.join(', ')],
                ['Plataformas', c.platforms.join(', ')],
                ['Seguidores', `${formatFollowers(c.minFollowers)} – ${formatFollowers(c.maxFollowers)}`],
                ['Producto cedido', c.productValue ? formatEuro(c.productValue) : 'No'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 border-b border-black/[0.05] pb-3 last:border-0 last:pb-0">
                  <dt className="font-medium text-ink/50">{k}</dt>
                  <dd className="text-right font-bold capitalize">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="mb-2.5 text-[15px] font-extrabold tracking-tight">Brief</h2>
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink/65">{c.brief}</p>
          </section>
        </aside>
      </div>

      <Modal open={!!invite} onClose={() => setInvite(null)} title={`Invitar a ${invite?.displayName || ''}`}>
        {invite ? (
          <InviteForm
            creator={invite}
            campaign={c}
            onDone={() => {
              setInvite(null)
              show.success('Invitacion enviada')
              reload()
            }}
            onError={(m) => show.error(m)}
          />
        ) : null}
      </Modal>

      <Toast toast={toast} onDismiss={dismiss} />
    </DashboardShell>
  )
}

function InviteForm({ creator, campaign, onDone, onError }) {
  const [fee, setFee] = useState(creator.rates?.post || campaign.budgetMax)
  const [message, setMessage] = useState(
    `Hola ${creator.displayName.split(' ')[0]}, nos encaja mucho tu perfil para "${campaign.title}". Te contamos los detalles?`,
  )
  const [sending, setSending] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setSending(true)
    try {
      await api.invite(campaign.id, { creatorId: creator.id, fee: Number(fee), message })
      onDone()
    } catch (err) {
      onError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Importe propuesto (EUR)</label>
        <input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} className="field" required />
        <p className="mt-1.5 text-[12px] text-ink/45">
          Presupuesto de la campana: {formatEuro(campaign.budgetMin)} – {formatEuro(campaign.budgetMax)}
        </p>
      </div>
      <div>
        <label className="label">Mensaje</label>
        <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="field resize-none" />
      </div>
      <button type="submit" disabled={sending} className="btn-primary w-full !py-3">
        {sending ? <Spinner size={16} /> : <Send size={15} />}
        Enviar invitacion
      </button>
    </form>
  )
}
