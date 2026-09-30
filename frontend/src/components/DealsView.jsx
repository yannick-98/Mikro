import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, Check, ExternalLink, Handshake, Link2, Send, ShieldCheck, Star, Wallet } from 'lucide-react'
import { api } from '../api/client'
import { Avatar, EmptyState, Modal, Spinner, Toast, useAsync, useToast } from './ui'
import { StatusPill } from './Dashboard'
import { DEAL_STATUS, formatEuro, formatRelative } from '../lib/format'

/** Acciones disponibles en cada estado, por rol. */
const ACTIONS = {
  BRAND: {
    ACCEPTED: { action: 'fund', label: 'Depositar importe', icon: Wallet, primary: true },
    SUBMITTED: { action: 'approve', label: 'Aprobar contenido', icon: Check, primary: true },
    APPROVED: { action: 'release', label: 'Liberar pago', icon: Wallet, primary: true },
  },
  CREATOR: {
    FUNDED: { action: 'start', label: 'Empezar a producir', icon: ArrowRight, primary: true },
    IN_PROGRESS: { action: 'submit', label: 'Entregar contenido', icon: Link2, primary: true, needsUrl: true },
  },
}

const STEPS = ['ACCEPTED', 'FUNDED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'PAID']

function Progress({ status }) {
  const index = STEPS.indexOf(status)
  if (status === 'CANCELLED') {
    return <p className="text-[12.5px] font-bold text-rose-600">Colaboracion cancelada</p>
  }
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => (
        <div
          key={s}
          className={clsx('h-1.5 flex-1 rounded-full transition', i <= index ? 'bg-brand-600' : 'bg-black/[0.08]')}
          title={DEAL_STATUS[s].label}
        />
      ))}
    </div>
  )
}

function Chat({ deal, messages, onSent, meId }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length])

  async function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    try {
      const { message } = await api.sendMessage(deal.id, text.trim())
      onSent(message)
      setText('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="max-h-72 flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink/40">
            Aun no hay mensajes. Escribe para acordar fechas y detalles.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === meId
            return (
              <div key={m.id} className={clsx('flex gap-2.5', mine && 'flex-row-reverse')}>
                <Avatar src={m.sender?.avatarUrl} name={m.sender?.name || '?'} size={30} rounded="rounded-lg" />
                <div className={clsx('max-w-[78%]', mine && 'text-right')}>
                  <div
                    className={clsx(
                      'rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed',
                      mine ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink',
                    )}
                  >
                    {m.body}
                  </div>
                  <p className="mt-1 px-1 text-[11px] font-medium text-ink/35">{formatRelative(m.createdAt)}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2 border-t border-black/[0.06] pt-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe un mensaje..."
          className="field !py-2.5"
        />
        <button type="submit" disabled={sending || !text.trim()} className="btn-dark !px-3.5">
          {sending ? <Spinner size={15} /> : <Send size={15} />}
        </button>
      </form>
    </div>
  )
}

function SubmitModal({ open, onClose, onSubmit }) {
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [sending, setSending] = useState(false)

  return (
    <Modal open={open} onClose={onClose} title="Entregar contenido">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setSending(true)
          try {
            await onSubmit({ contentUrl: url, notes })
            setUrl('')
            setNotes('')
          } finally {
            setSending(false)
          }
        }}
        className="space-y-4"
      >
        <div>
          <label className="label">Enlace al contenido publicado</label>
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="field"
            placeholder="https://instagram.com/p/..."
          />
        </div>
        <div>
          <label className="label">Notas para la marca (opcional)</label>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="field resize-none" />
        </div>
        <button type="submit" disabled={sending} className="btn-primary w-full !py-3">
          {sending ? <Spinner size={16} /> : null}
          Entregar y pedir aprobacion
        </button>
      </form>
    </Modal>
  )
}

function ReviewModal({ open, onClose, deal, onSubmit }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)

  return (
    <Modal open={open} onClose={onClose} title={`Valorar a ${deal?.creator?.displayName || ''}`}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setSending(true)
          try {
            await onSubmit({ rating, comment })
          } finally {
            setSending(false)
          }
        }}
        className="space-y-4"
      >
        <div>
          <label className="label">Puntuacion</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)} className="p-1">
                <Star size={28} className={n <= rating ? 'text-amber-400' : 'text-black/15'} fill="currentColor" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Comentario</label>
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="field resize-none"
            placeholder="Como ha sido la colaboracion? Tu valoracion es publica y ayuda a otras empresas."
          />
        </div>
        <button type="submit" disabled={sending} className="btn-primary w-full !py-3">
          {sending ? <Spinner size={16} /> : null}
          Publicar valoracion
        </button>
      </form>
    </Modal>
  )
}

/**
 * Lista y gestion de colaboraciones. La comparten empresa y creador: cambian
 * las acciones disponibles, no la informacion.
 */
export default function DealsView({ role, meId }) {
  const { toast, show, dismiss } = useToast()
  const { data, loading, reload } = useAsync(() => api.deals(), [])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [filter, setFilter] = useState('ACTIVE')
  const [filterTouched, setFilterTouched] = useState(false)

  useEffect(() => {
    if (!selected) return
    api.deal(selected).then(setDetail).catch(() => setDetail(null))
  }, [selected])

  // Si no queda nada en curso pero si hay historico, se abre en "Todas": una
  // pantalla vacia teniendo contenido a un clic es peor que no filtrar.
  useEffect(() => {
    if (filterTouched || !data?.items) return
    const active = data.items.filter((d) => !['PAID', 'CANCELLED'].includes(d.status)).length
    if (active === 0 && data.items.length > 0) setFilter('ALL')
  }, [data, filterTouched])

  const changeFilter = (id) => {
    setFilterTouched(true)
    setFilter(id)
  }

  async function act(deal, action, payload) {
    setBusy(true)
    try {
      await api.dealAction(deal.id, action, payload)
      const labels = {
        fund: 'Importe depositado en garantia',
        start: 'Colaboracion iniciada',
        submit: 'Contenido entregado',
        approve: 'Contenido aprobado',
        release: 'Pago liberado al creador',
        cancel: 'Colaboracion cancelada',
      }
      show.success(labels[action])
      reload()
      if (selected === deal.id) {
        const fresh = await api.deal(deal.id)
        setDetail(fresh)
      }
      return true
    } catch (e) {
      show.error(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const all = data?.items || []
  const items =
    filter === 'ACTIVE'
      ? all.filter((d) => !['PAID', 'CANCELLED'].includes(d.status))
      : filter === 'DONE'
        ? all.filter((d) => d.status === 'PAID')
        : all

  const totals = {
    active: all.filter((d) => !['PAID', 'CANCELLED'].includes(d.status)).length,
    done: all.filter((d) => d.status === 'PAID').length,
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size={26} className="text-brand-600" />
      </div>
    )
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { id: 'ACTIVE', label: `En curso (${totals.active})` },
          { id: 'DONE', label: `Completadas (${totals.done})` },
          { id: 'ALL', label: `Todas (${all.length})` },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => changeFilter(f.id)}
            className={clsx('chip !px-3.5 !py-1.5 !text-[12.5px] !font-bold', filter === f.id && 'chip-active')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No hay colaboraciones aqui"
          description={
            role === 'BRAND'
              ? 'Cuando aceptes una candidatura, la colaboracion aparecera en esta pantalla.'
              : 'Cuando una marca acepte tu candidatura, la colaboracion aparecera aqui.'
          }
          action={
            <Link to={role === 'BRAND' ? '/empresa/campanas' : '/creador/oportunidades'} className="btn-dark">
              {role === 'BRAND' ? 'Ver mis campanas' : 'Ver oportunidades'}
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((d) => {
            const counterpart = role === 'BRAND' ? d.creator : null
            const rule = ACTIONS[role]?.[d.status]

            return (
              <article key={d.id} className="card p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <Avatar
                    src={role === 'BRAND' ? d.creator.avatarUrl : d.brand.logoUrl}
                    name={role === 'BRAND' ? d.creator.displayName : d.brand.companyName}
                    size={50}
                    rounded="rounded-xl"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {role === 'BRAND' ? (
                        <Link to={`/creador/${d.creator.handle}`} className="text-[15px] font-extrabold tracking-tight hover:text-brand-600">
                          {d.creator.displayName}
                        </Link>
                      ) : (
                        <span className="text-[15px] font-extrabold tracking-tight">{d.brand.companyName}</span>
                      )}
                      <StatusPill status={d.status} map={DEAL_STATUS} />
                    </div>
                    <p className="mt-0.5 truncate text-[13px] font-semibold text-ink/50">{d.campaign.title}</p>

                    <div className="mt-3 max-w-md">
                      <Progress status={d.status} />
                      <p className="mt-1.5 text-[12px] font-medium text-ink/45">{DEAL_STATUS[d.status]?.hint}</p>
                    </div>

                    {d.contentUrl ? (
                      <a
                        href={d.contentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-brand-600 hover:text-brand-700"
                      >
                        <ExternalLink size={13} /> Ver contenido entregado
                      </a>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink/35">
                      {role === 'BRAND' ? 'Importe' : 'Recibes'}
                    </p>
                    <p className="text-[22px] font-black leading-none">
                      {formatEuro(role === 'BRAND' ? d.fee : d.netToCreator)}
                    </p>
                    {role === 'CREATOR' ? (
                      <p className="mt-1 text-[11.5px] text-ink/40">{formatEuro(d.fee)} − {formatEuro(d.feePlatform)} comision</p>
                    ) : (
                      <p className="mt-1 text-[11.5px] text-ink/40">comision incluida</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-4">
                  <button
                    type="button"
                    onClick={() => setSelected(selected === d.id ? null : d.id)}
                    className="btn-ghost !px-3.5 !py-2 !text-[12.5px]"
                  >
                    Mensajes{d.messagesCount ? ` (${d.messagesCount})` : ''}
                  </button>

                  {rule ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (rule.needsUrl) {
                          setSelected(d.id)
                          setSubmitOpen(true)
                        } else {
                          act(d, rule.action)
                        }
                      }}
                      className="btn-primary !px-3.5 !py-2 !text-[12.5px]"
                    >
                      <rule.icon size={14} /> {rule.label}
                    </button>
                  ) : null}

                  {role === 'CREATOR' && d.status === 'FUNDED' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setSelected(d.id)
                        setSubmitOpen(true)
                      }}
                      className="btn-ghost !px-3.5 !py-2 !text-[12.5px]"
                    >
                      <Link2 size={14} /> Entregar ya
                    </button>
                  ) : null}

                  {role === 'BRAND' && ['APPROVED', 'PAID'].includes(d.status) && !d.reviewed ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(d.id)
                        setReviewOpen(true)
                      }}
                      className="btn-soft !px-3.5 !py-2 !text-[12.5px]"
                    >
                      <Star size={14} /> Valorar
                    </button>
                  ) : null}

                  {['ACCEPTED', 'FUNDED', 'IN_PROGRESS'].includes(d.status) ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm('Seguro que quieres cancelar esta colaboracion?')) act(d, 'cancel')
                      }}
                      className="btn !px-3.5 !py-2 !text-[12.5px] text-rose-600 hover:bg-rose-50"
                    >
                      Cancelar
                    </button>
                  ) : null}

                  {d.status === 'ACCEPTED' && role === 'BRAND' ? (
                    <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink/45">
                      <ShieldCheck size={14} /> El pago queda retenido hasta que apruebes
                    </span>
                  ) : null}
                </div>

                {selected === d.id && detail ? (
                  <div className="mt-4 rounded-2xl border border-black/[0.06] bg-black/[0.015] p-4">
                    <Chat
                      deal={d}
                      meId={meId}
                      messages={detail.messages || []}
                      onSent={(m) => setDetail((prev) => ({ ...prev, messages: [...prev.messages, m] }))}
                    />
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      <SubmitModal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSubmit={async (payload) => {
          const deal = all.find((d) => d.id === selected)
          if (!deal) return
          // Si aun no ha empezado, se marca el inicio antes de entregar.
          if (deal.status === 'FUNDED') await api.dealAction(deal.id, 'start').catch(() => {})
          const ok = await act(deal, 'submit', payload)
          if (ok) setSubmitOpen(false)
        }}
      />

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        deal={all.find((d) => d.id === selected)}
        onSubmit={async (payload) => {
          try {
            await api.review(selected, payload)
            show.success('Valoracion publicada')
            setReviewOpen(false)
            reload()
          } catch (e) {
            show.error(e.message)
          }
        }}
      />

      <Toast toast={toast} onDismiss={dismiss} />
    </>
  )
}
