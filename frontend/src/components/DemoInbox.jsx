import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Building2, Globe, Mail, MapPin, Phone, Trash2, Wallet } from 'lucide-react'
import { api } from '../api/client'
import { Select, Spinner, Tabs, useAsync } from './ui'
import { formatRelative } from '../lib/format'

/** Los estados en orden de embudo: así se lee la lista de un vistazo. */
const STATUSES = [
  { value: 'NEW', label: 'Sin atender', tone: 'bg-brand-50 text-brand-700' },
  { value: 'CONTACTED', label: 'Contactada', tone: 'bg-amber-50 text-amber-700' },
  { value: 'SCHEDULED', label: 'Demo agendada', tone: 'bg-violet-50 text-violet-700' },
  { value: 'WON', label: 'Cliente', tone: 'bg-emerald-50 text-emerald-700' },
  { value: 'LOST', label: 'Perdida', tone: 'bg-black/5 text-ink/50' },
]

const TABS = [{ id: '', label: 'Todas' }, ...STATUSES.map((s) => ({ id: s.value, label: s.label }))]

const BUDGETS = {
  'menos-300': 'Menos de 300 €/mes',
  '300-800': '300 - 800 €/mes',
  '800-2000': '800 - 2.000 €/mes',
  'mas-2000': 'Más de 2.000 €/mes',
  'por-decidir': 'Presupuesto por decidir',
}

const TEAMS = {
  '1-5': '1-5 personas',
  '6-20': '6-20 personas',
  '21-50': '21-50 personas',
  '50+': 'Más de 50 personas',
}

const statusOf = (value) => STATUSES.find((s) => s.value === value) || STATUSES[0]

function Dato({ icon: Icon, children, href }) {
  if (!children) return null
  const content = (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink/55">
      <Icon size={13} className="shrink-0 text-ink/35" />
      {children}
    </span>
  )
  return href ? (
    <a href={href} className="hover:text-brand-600 [&>span]:hover:text-brand-600">
      {content}
    </a>
  ) : (
    content
  )
}

function Peticion({ request, onChange, onError }) {
  const [status, setStatus] = useState(request.status)
  const [notes, setNotes] = useState(request.notes || '')
  const [saving, setSaving] = useState(false)
  const [savedNotes, setSavedNotes] = useState(request.notes || '')
  const [confirmando, setConfirmando] = useState(false)

  // Borrar pide confirmacion en el propio boton: no hay papelera de la que
  // recuperarlo, y una fila de la bandeja esta a un clic de distancia de otra.
  const borrar = async () => {
    if (!confirmando) {
      setConfirmando(true)
      return
    }
    setSaving(true)
    try {
      await api.deleteDemoRequest(request.id)
      onChange?.()
    } catch (e) {
      onError?.(e.message)
      setSaving(false)
      setConfirmando(false)
    }
  }

  const save = async (payload, { reload = false } = {}) => {
    setSaving(true)
    try {
      await api.updateDemoRequest(request.id, payload)
      if (reload) onChange?.()
      return true
    } catch (e) {
      onError?.(e.message)
      return false
    } finally {
      setSaving(false)
    }
  }

  // Las notas se guardan solas al dejar de escribir. Esperar al blur parecia
  // suficiente hasta que la lista se recarga por otro motivo, desmonta la fila
  // y se lleva por delante lo que habia escrito sin guardar.
  useEffect(() => {
    if (notes === savedNotes) return undefined
    const id = setTimeout(async () => {
      const texto = notes
      if (await save({ notes: texto })) setSavedNotes(texto)
    }, 700)
    return () => clearTimeout(id)
  }, [notes]) // eslint-disable-line react-hooks/exhaustive-deps

  const tone = statusOf(status)

  return (
    <article className="rounded-xl border border-black/[0.06] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[14.5px] font-extrabold tracking-tight">
            {request.companyName}
            <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-bold', tone.tone)}>{tone.label}</span>
          </p>
          <p className="mt-0.5 text-[12.5px] font-semibold text-ink/50">
            {request.contactName} · {formatRelative(request.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={status}
            onChange={(v) => {
              setStatus(v)
              // El estado si recarga: cambia el contador y puede sacar la
              // ficha del filtro en el que estamos mirando.
              save({ status: v }, { reload: true })
            }}
            options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            disabled={saving}
            className="!w-auto !py-2 !text-[12.5px]"
          />
          <button
            type="button"
            onClick={borrar}
            onBlur={() => setConfirmando(false)}
            disabled={saving}
            title="Borrar la peticion y sus datos"
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12.5px] font-bold transition',
              confirmando ? 'bg-rose-600 text-white' : 'text-ink/40 hover:bg-rose-50 hover:text-rose-600',
            )}
          >
            <Trash2 size={14} />
            {confirmando ? 'Confirmar' : null}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <Dato icon={Mail} href={`mailto:${request.email}`}>
          {request.email}
        </Dato>
        <Dato icon={Phone} href={request.phone ? `tel:${request.phone.replace(/\s/g, '')}` : undefined}>
          {request.phone}
        </Dato>
        <Dato icon={Building2}>{[request.sector, TEAMS[request.teamSize]].filter(Boolean).join(' · ')}</Dato>
        <Dato icon={MapPin}>{request.city}</Dato>
        <Dato icon={Wallet}>{BUDGETS[request.monthlyBudget]}</Dato>
        <Dato icon={Globe} href={request.website || undefined}>
          {request.website}
        </Dato>
      </div>

      {request.goal ? (
        <p className="mt-3 rounded-lg bg-black/[0.03] px-3.5 py-2.5 text-[13px] leading-relaxed text-ink/70">
          «{request.goal}»
        </p>
      ) : null}

      {/* Las notas se guardan al salir del campo: quien llama no quiere pulsar
          un boton despues de cada linea que apunta. */}
      <div className="relative mt-3">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas de la llamada…"
          className="field min-h-[44px] resize-y !py-2 !text-[13px]"
        />
        {notes !== savedNotes ? (
          <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] font-semibold text-ink/30">
            guardando…
          </span>
        ) : null}
      </div>
    </article>
  )
}

/**
 * Bandeja de peticiones de demo.
 *
 * Un lead que nadie ve es un lead perdido, asi que esto vive en el backoffice
 * junto a lo demas y no en un correo que se entierra.
 */
export default function DemoInbox({ onError }) {
  const [filter, setFilter] = useState('')
  const { data, loading, reload } = useAsync(() => api.demoRequests(filter ? { status: filter } : {}), [filter])
  // Se recuerda lo ultimo servido: al recargar tras cambiar un estado, la
  // bandeja no debe quedarse en blanco delante de quien la estaba leyendo.
  const ultimo = useRef(null)
  if (data) ultimo.current = data
  const vista = data || ultimo.current

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-extrabold tracking-tight">Peticiones de demo</h2>
          <p className="mt-1 text-[13.5px] text-ink/55">
            {vista?.pending
              ? `${vista.pending} sin atender. Cada una aceptó que le escribiéramos.`
              : 'Llegan desde la landing. Cada una aceptó que le escribiéramos.'}
          </p>
        </div>
      </div>

      <Tabs tabs={TABS} value={filter} onChange={setFilter} className="mt-4" />

      {loading && !vista ? (
        <div className="flex justify-center py-12">
          <Spinner size={22} className="text-brand-600" />
        </div>
      ) : !vista?.items?.length ? (
        <p className="py-10 text-center text-[14px] text-ink/45">
          {filter ? 'Ninguna petición en este estado.' : 'Todavía no ha llegado ninguna petición.'}
        </p>
      ) : (
        <div className={clsx('mt-4 space-y-2.5 transition-opacity', loading && 'opacity-60')}>
          {vista.items.map((r) => (
            <Peticion key={r.id} request={r} onChange={reload} onError={onError} />
          ))}
        </div>
      )}
    </section>
  )
}
