import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  Bookmark,
  Clock,
  Globe,
  MapPin,
  MessageSquare,
  Send,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../store/auth'
import Layout from '../components/Layout'
import { CreatorCard } from '../components/CreatorRow'
import { Avatar, Delta, EmptyState, Modal, PlatformIcon, Spinner, Thumb, Toast, VerifiedBadge, useAsync, useToast } from '../components/ui'
import { formatEuro, formatFollowers, formatNumber, formatPercent, formatRelative } from '../lib/format'

function Stat({ label, value, sub, icon: Icon, tone = 'text-ink' }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-ink/40">
        {Icon ? <Icon size={12} /> : null}
        {label}
      </div>
      <p className={clsx('mt-1.5 text-[22px] font-black leading-none tracking-tight', tone)}>{value}</p>
      {sub ? <p className="mt-1 text-[12px] font-medium text-ink/45">{sub}</p> : null}
    </div>
  )
}

function InviteModal({ open, onClose, creator, onDone }) {
  const [campaigns, setCampaigns] = useState(null)
  const [campaignId, setCampaignId] = useState('')
  const [fee, setFee] = useState(creator?.rates?.post || 150)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  // Las campanas abiertas se cargan al abrir el modal, no antes.
  useEffect(() => {
    if (!open || campaigns) return
    api
      .campaigns({ mine: true, status: 'OPEN' })
      .then((res) => {
        setCampaigns(res.items)
        if (res.items[0]) setCampaignId(res.items[0].id)
      })
      .catch(() => setCampaigns([]))
  }, [open, campaigns])

  async function submit(e) {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      await api.invite(campaignId, { creatorId: creator.id, fee: Number(fee), message })
      onDone()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Invitar a ${creator?.displayName}`}>
      {campaigns && campaigns.length === 0 ? (
        <EmptyState
          title="No tienes campanas abiertas"
          description="Crea una campana para poder invitar a este creador a colaborar."
          action={
            <Link to="/empresa/campanas" className="btn-dark">
              Crear campana
            </Link>
          }
        />
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Campana</label>
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="field" required>
              {(campaigns || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Importe propuesto (EUR)</label>
            <input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} className="field" required />
            <p className="mt-1.5 text-[12px] text-ink/45">
              Tarifa publicada del creador: {creator?.rates?.post ? formatEuro(creator.rates.post) : 'no indicada'} por
              post.
            </p>
          </div>
          <div>
            <label className="label">Mensaje</label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="field resize-none"
              placeholder="Cuentale por que encaja con tu marca y que esperas de la colaboracion."
            />
          </div>
          {error ? <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-semibold text-rose-700">{error}</p> : null}
          <button type="submit" disabled={sending || !campaignId} className="btn-primary w-full !py-3">
            {sending ? <Spinner size={16} /> : <Send size={15} />}
            Enviar invitacion
          </button>
        </form>
      )}
    </Modal>
  )
}

export default function CreatorProfile() {
  const { handle } = useParams()
  const { user, isBrand } = useAuth()
  const { toast, show, dismiss } = useToast()
  const { data, loading, error, setData } = useAsync(() => api.creator(handle), [handle])
  const [inviteOpen, setInviteOpen] = useState(false)

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner size={28} className="text-brand-600" />
        </div>
      </Layout>
    )
  }

  if (error || !data?.creator) {
    return (
      <Layout>
        <div className="mx-auto max-w-lg px-4 py-24">
          <EmptyState
            title="Creador no encontrado"
            description="Puede que haya cambiado su nombre de usuario o que ya no este disponible."
            action={
              <Link to="/" className="btn-dark">
                Volver a Descubrir
              </Link>
            }
          />
        </div>
      </Layout>
    )
  }

  const c = data.creator

  async function toggleSave() {
    if (!isBrand) {
      show.info('Inicia sesion como empresa para guardar creadores')
      return
    }
    try {
      const { saved } = await api.toggleSaved(c.id)
      setData({ ...data, creator: { ...c, saved } })
      show.success(saved ? 'Creador guardado' : 'Creador quitado de guardados')
    } catch {
      show.error('No hemos podido guardar el creador')
    }
  }

  return (
    <Layout>
      {/* Portada */}
      <div className="relative h-44 overflow-hidden bg-ink sm:h-56">
        <Thumb src={c.coverUrl} seed={c.id} className="h-full w-full opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-transparent" />
      </div>

      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 sm:-mt-20">
          <div className="card p-5 sm:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <Avatar
                src={c.avatarUrl}
                name={c.displayName}
                size={112}
                rounded="rounded-3xl"
                className="ring-4 ring-white"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[27px] font-black tracking-tight">{c.displayName}</h1>
                  {c.verified ? <VerifiedBadge size={20} /> : null}
                  {c.rankPosition ? (
                    <span className="rounded-lg bg-ink px-2.5 py-1 text-[11.5px] font-black text-white">
                      #{c.rankPosition} del ranking
                    </span>
                  ) : null}
                  {c.featured ? (
                    <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-[11.5px] font-black uppercase text-amber-700">
                      Destacado
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-[14px] font-bold text-ink/55">@{c.handle}</p>
                {c.headline ? <p className="mt-2.5 text-[16px] font-semibold text-ink/80">{c.headline}</p> : null}

                <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-semibold text-ink/50">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={14} /> {c.city}
                    {c.province && c.province !== c.city ? `, ${c.province}` : ''}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Globe size={14} /> {c.languages.join(', ')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={14} /> Responde en ~{c.responseHours}h
                  </span>
                  {c.ratingCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-amber-600">
                      <Star size={14} fill="currentColor" /> {c.ratingAvg} ({c.ratingCount})
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="chip chip-active !py-1 !text-[12px]">{c.category}</span>
                  {c.subcategories.map((s) => (
                    <span key={s} className="chip !py-1 !text-[12px]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 gap-2 sm:flex-col">
                {isBrand ? (
                  <button type="button" onClick={() => setInviteOpen(true)} className="btn-primary flex-1 sm:w-48">
                    <Send size={15} /> Invitar a campana
                  </button>
                ) : (
                  <Link to={user ? '/' : '/registro?rol=empresa'} className="btn-primary flex-1 sm:w-48">
                    <MessageSquare size={15} /> Contactar
                  </Link>
                )}
                <button
                  type="button"
                  onClick={toggleSave}
                  className={clsx('btn-ghost flex-1 sm:w-48', c.saved && '!border-brand-200 !bg-brand-50 !text-brand-700')}
                >
                  <Bookmark size={15} fill={c.saved ? 'currentColor' : 'none'} />
                  {c.saved ? 'Guardado' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Seguidores" value={formatFollowers(c.totalFollowers)} icon={Users} sub={`${formatNumber(c.totalFollowers)} en total`} />
              <Stat label="Engagement" value={formatPercent(c.engagementRate)} icon={TrendingUp} tone="text-emerald-600" sub="media ponderada" />
              <Stat
                label="Ranking"
                value={c.rankPosition ? `#${c.rankPosition}` : '—'}
                sub={<Delta value={c.rankDelta} />}
              />
              <Stat label="Colaboraciones" value={c.completedDeals} sub="completadas en Mikro" />
            </div>

            {c.bio ? (
              <section className="card p-6">
                <h2 className="mb-3 text-[16px] font-extrabold tracking-tight">Sobre mi</h2>
                <p className="text-[14.5px] leading-relaxed text-ink/70">{c.bio}</p>
              </section>
            ) : null}

            <section className="card p-6">
              <h2 className="mb-4 text-[16px] font-extrabold tracking-tight">Redes</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {c.socialAccounts.map((a) => (
                  <a
                    key={a.platform}
                    href={a.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-black/[0.07] p-4 transition hover:border-black/15 hover:shadow-card"
                  >
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={a.platform} size={18} />
                      <span className="text-[13px] font-bold capitalize">{a.platform}</span>
                    </div>
                    <p className="mt-2.5 text-[21px] font-black leading-none">{formatFollowers(a.followers)}</p>
                    <p className="mt-1.5 text-[12px] font-semibold text-ink/45">
                      {formatPercent(a.engagement)} engagement · {formatFollowers(a.avgViews)} visitas medias
                    </p>
                  </a>
                ))}
              </div>
            </section>

            {c.portfolio.length ? (
              <section className="card p-6">
                <h2 className="mb-4 text-[16px] font-extrabold tracking-tight">Trabajos recientes</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {c.portfolio.map((p) => (
                    <figure key={p.id} className="group overflow-hidden rounded-xl">
                      <Thumb src={p.imageUrl} seed={p.id} className="aspect-square w-full transition duration-300 group-hover:scale-105" />
                      <figcaption className="mt-2 px-0.5">
                        <p className="truncate text-[12px] font-bold text-ink/75">{p.caption}</p>
                        <p className="text-[11px] font-medium text-ink/40">{formatFollowers(p.likes)} me gusta</p>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            ) : null}

            {c.reviews?.length ? (
              <section className="card p-6">
                <h2 className="mb-4 text-[16px] font-extrabold tracking-tight">
                  Valoraciones de marcas ({c.ratingCount})
                </h2>
                <div className="space-y-4">
                  {c.reviews.map((r) => (
                    <article key={r.id} className="border-b border-black/[0.06] pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <Avatar src={r.author?.avatarUrl} name={r.author?.name || '?'} size={34} rounded="rounded-lg" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-bold">{r.author?.name}</p>
                          <p className="text-[11.5px] font-medium text-ink/40">{formatRelative(r.createdAt)}</p>
                        </div>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={13}
                              className={i < r.rating ? 'text-amber-400' : 'text-black/12'}
                              fill="currentColor"
                            />
                          ))}
                        </div>
                      </div>
                      {r.comment ? <p className="mt-2.5 text-[14px] leading-relaxed text-ink/70">{r.comment}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <section className="card p-5">
              <h2 className="mb-3.5 text-[15px] font-extrabold tracking-tight">Tarifas orientativas</h2>
              <ul className="space-y-2.5">
                {[
                  ['Post en feed', c.rates.post],
                  ['Reel / video corto', c.rates.reel],
                  ['Pack de stories', c.rates.story],
                  ['Contenido UGC', c.rates.ugc],
                ].map(([label, value]) => (
                  <li key={label} className="flex items-center justify-between border-b border-black/[0.05] pb-2.5 last:border-0 last:pb-0">
                    <span className="text-[13.5px] font-medium text-ink/65">{label}</span>
                    <span className="text-[14px] font-black">{value ? formatEuro(value) : '—'}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3.5 rounded-xl bg-black/[0.03] px-3 py-2.5 text-[12px] leading-relaxed text-ink/50">
                Precio de partida. El importe final se acuerda en la campana y queda en garantia hasta que apruebas el
                contenido.
              </p>
            </section>

            <section className="card p-5">
              <h2 className="mb-3.5 text-[15px] font-extrabold tracking-tight">Audiencia</h2>
              <dl className="space-y-3">
                <div className="flex items-center justify-between">
                  <dt className="text-[13px] font-medium text-ink/55">Pais principal</dt>
                  <dd className="text-[13.5px] font-bold">{c.audience.country}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-[13px] font-medium text-ink/55">Edad predominante</dt>
                  <dd className="text-[13.5px] font-bold">{c.audience.ageRange}</dd>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <dt className="text-[13px] font-medium text-ink/55">Genero</dt>
                    <dd className="text-[13.5px] font-bold">
                      {c.audience.femalePct}% mujeres
                    </dd>
                  </div>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-sky-500">
                    <div className="h-full bg-pink-500" style={{ width: `${c.audience.femalePct}%` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-ink/40">
                    <span>Mujeres {c.audience.femalePct}%</span>
                    <span>Hombres {100 - c.audience.femalePct}%</span>
                  </div>
                </div>
              </dl>
            </section>

            {data.similar?.length ? (
              <section>
                <h2 className="mb-3 px-1 text-[15px] font-extrabold tracking-tight">Perfiles parecidos</h2>
                <div className="space-y-3">
                  {data.similar.slice(0, 2).map((s) => (
                    <CreatorCard key={s.id} creator={s} showSave={false} />
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>

      {isBrand ? (
        <InviteModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          creator={c}
          onDone={() => show.success('Invitacion enviada al creador')}
        />
      ) : null}

      <Toast toast={toast} onDismiss={dismiss} />
    </Layout>
  )
}
