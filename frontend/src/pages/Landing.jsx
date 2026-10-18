import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, Minus, ShieldCheck } from 'lucide-react'
import { api } from '../api/client'
import { Avatar, Logo } from '../components/ui'
import DemoFace from '../components/landing/DemoFace'
import { formatEuro, formatFollowers, formatPercent } from '../lib/format'
import { WEIGHTS, estimateScore } from '../lib/score'

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)'
const VISITOR_ID = 'visitante'

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Acepta "18.000", "18000", "18k" o "1,2M". */
function parseFollowers(raw) {
  const v = String(raw).trim().toLowerCase().replace(/\s/g, '')
  const m = v.match(/^([\d.,]+)(k|m)?$/)
  if (!m) return NaN
  const mult = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1
  const num = m[2] ? Number(m[1].replace(',', '.')) : Number(m[1].replace(/[.,]/g, ''))
  return Math.round(num * mult)
}

const parsePercent = (raw) => Number(String(raw).trim().replace('%', '').replace(',', '.'))

function Header() {
  return (
    <header className="relative z-20">
      <div className="mx-auto flex h-[72px] max-w-[1360px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
        <Logo tone="dark" />
        <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-2">
          <Link to="/rankings" className="hidden rounded-xl px-3 py-2.5 text-[14px] font-semibold text-white/75 transition-colors hover:text-white md:block">
            Ranking completo
          </Link>
          <a href="#empresas" className="hidden rounded-xl px-3 py-2.5 text-[14px] font-semibold text-white/75 transition-colors hover:text-white sm:block">
            Para empresas
          </a>
          {/* Lo unico util que damos sin pedir cuenta: para una pyme que
              aterriza aqui sin saber que somos, es la puerta de entrada. */}
          <Link to="/analisis-web" className="hidden rounded-xl px-3 py-2.5 text-[14px] font-semibold text-white/75 transition-colors hover:text-white md:block">
            Analiza tu web
          </Link>
          <Link to="/entrar" className="rounded-xl px-3 py-2.5 text-[14px] font-semibold text-white/75 transition-colors hover:text-white">
            Entrar
          </Link>
          <Link to="/registro" className="rounded-xl bg-white px-4 py-2.5 text-[14px] font-bold text-ink transition-transform active:scale-[0.97]">
            Regístrate
          </Link>
        </nav>
      </div>
    </header>
  )
}

function Delta({ value }) {
  if (!value) {
    return (
      <span className="inline-flex items-center gap-1 text-white/45">
        <Minus size={14} aria-hidden="true" />
        <span className="sr-only">Sin cambios</span>
      </span>
    )
  }
  const up = value > 0
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span className={clsx('inline-flex items-center gap-0.5 font-bold', up ? 'text-emerald-400' : 'text-rose-400')}>
      <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
      {Math.abs(value)}
      <span className="sr-only">{up ? ' puestos arriba' : ' puestos abajo'}</span>
    </span>
  )
}

const ROW_GRID =
  'grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 sm:grid-cols-[3.25rem_minmax(0,1fr)_6rem_6rem_5.5rem_3.5rem] sm:gap-x-4'

function CreatorRow({ creator, position }) {
  return (
    <div className={clsx(ROW_GRID, 'rounded-2xl px-3 py-2.5 sm:px-4')}>
      <span className="text-[26px] font-black tabular-nums tracking-[-0.04em] text-white sm:text-[34px]">{position}</span>
      <span className="flex min-w-0 items-center gap-3">
        <Avatar src={creator.avatarUrl} name={creator.displayName} size={40} />
        <span className="min-w-0">
          <span className="flex items-center gap-1 truncate text-[15px] font-bold text-white">
            {creator.displayName}
          </span>
          <span className="block truncate text-[13px] text-white/60">
            {[creator.category, creator.city].filter(Boolean).join(' · ')}
            <span className="sm:hidden"> · {formatFollowers(creator.totalFollowers)}</span>
          </span>
        </span>
      </span>
      <span className="hidden text-[15px] tabular-nums text-white/80 sm:block">{formatFollowers(creator.totalFollowers)}</span>
      <span className="hidden text-[15px] tabular-nums text-white/80 sm:block">
        {creator.engagementRate != null ? formatPercent(creator.engagementRate) : '—'}
      </span>
      <span className="text-right text-[17px] font-black tabular-nums text-white">
        {Number(creator.score || 0).toFixed(1).replace('.', ',')}
      </span>
      <span className="hidden justify-end text-[13px] sm:flex">
        <Delta value={creator.rankDelta} />
      </span>
    </div>
  )
}

function VisitorForm({ onResult }) {
  const [form, setForm] = useState({ handle: '', followers: '', engagement: '' })
  const [errors, setErrors] = useState({})

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const submit = (e) => {
    e.preventDefault()
    const handle = form.handle.trim().replace(/^@/, '')
    const followers = parseFollowers(form.followers)
    const engagement = parsePercent(form.engagement)
    const next = {}
    if (!/^[\w.]{2,30}$/.test(handle)) next.handle = 'Escribe tu usuario, sin espacios'
    if (!Number.isFinite(followers) || followers < 100) next.followers = 'Pon tus seguidores, por ejemplo 18000'
    if (!Number.isFinite(engagement) || engagement <= 0 || engagement > 40) next.engagement = 'Un porcentaje, por ejemplo 5,2'
    if (Object.keys(next).length) {
      setErrors(next)
      return
    }
    onResult({ handle, followers, engagement, score: estimateScore({ followers, engagement }) })
  }

  const field =
    'w-full rounded-xl border border-white/15 bg-ink/70 px-3.5 py-3 text-[15px] font-medium text-white outline-none transition-colors placeholder:text-white/45 focus:border-brand-300 focus:ring-4 focus:ring-brand-500/20'

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto] sm:items-start">
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-white/80">Tu usuario</span>
        <input className={field} value={form.handle} onChange={set('handle')} placeholder="@tuusuario" autoComplete="off" aria-invalid={!!errors.handle} />
        {errors.handle ? <span className="mt-1 block text-[12.5px] font-semibold text-rose-300">{errors.handle}</span> : null}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-white/80">Seguidores</span>
        <input className={field} value={form.followers} onChange={set('followers')} placeholder="18000" inputMode="numeric" aria-invalid={!!errors.followers} />
        {errors.followers ? <span className="mt-1 block text-[12.5px] font-semibold text-rose-300">{errors.followers}</span> : null}
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-white/80">Engagement</span>
        <input className={field} value={form.engagement} onChange={set('engagement')} placeholder="5,2 %" inputMode="decimal" aria-invalid={!!errors.engagement} />
        {errors.engagement ? <span className="mt-1 block text-[12.5px] font-semibold text-rose-300">{errors.engagement}</span> : null}
      </label>
      <button
        type="submit"
        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-[15px] font-bold text-white transition-[transform,background-color] duration-150 hover:bg-brand-500 active:scale-[0.97] sm:mt-[26px]"
      >
        Ver mi puesto
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </form>
  )
}

function VisitorRow({ visitor, position, gap, onReset }) {
  const signup = `/registro?rol=creador&handle=${encodeURIComponent(visitor.handle)}`
  return (
    <div className="rounded-2xl bg-brand-600 px-3 py-3 shadow-[0_18px_40px_-18px_rgba(37,99,235,0.9)] sm:px-4">
      <div className={ROW_GRID}>
        <span className="text-[22px] font-black tabular-nums tracking-[-0.03em] text-white sm:text-[26px]">{position ?? '—'}</span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold text-white">@{visitor.handle} (tú)</span>
          <span className="block text-[13px] text-white/80">Estimación con los pesos del ranking</span>
        </span>
        <span className="hidden text-[15px] tabular-nums text-white sm:block">{formatFollowers(visitor.followers)}</span>
        <span className="hidden text-[15px] tabular-nums text-white sm:block">{formatPercent(visitor.engagement)}</span>
        <span className="text-right text-[17px] font-black tabular-nums text-white">{visitor.score.toFixed(1).replace('.', ',')}</span>
        <span className="hidden sm:block" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-white/20 pt-3">
        <p className="min-w-0 flex-1 text-[14px] leading-snug text-white" aria-live="polite">
          {position
            ? `Entrarías en el puesto ${position}. Valoraciones y colaboraciones aún cuentan como cero: con cada campaña bien hecha, subes.`
            : `Te faltan ${gap.toFixed(1).replace('.', ',')} puntos para el top 10. Las valoraciones de las marcas y las colaboraciones cerradas son lo que más rápido suma.`}
        </p>
        <button type="button" onClick={onReset} className="rounded-lg px-2 py-2 text-[13.5px] font-semibold text-white/85 underline underline-offset-4 hover:text-white">
          Cambiar datos
        </button>
        <Link to={signup} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-4 text-[14.5px] font-bold text-ink transition-transform active:scale-[0.97]">
          Reclama tu puesto
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

/**
 * La tabla. Cuando el visitante calcula su puesto, su fila entra en el sitio
 * que le toca y las demas se apartan: es el unico momento animado de la
 * portada. Animacion FLIP sobre transform, desactivada con reduced motion.
 */
function RankingTable({ creators, loading, failed, onRetry }) {
  const [visitor, setVisitor] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const nodes = useRef(new Map())
  const tops = useRef(new Map())

  const rows = useMemo(() => {
    const list = creators.map((c) => ({ kind: 'creator', id: c.id, score: c.score, creator: c }))
    if (!visitor) return { list, visitorPos: null, gap: 0 }
    const lowest = creators.length ? creators[creators.length - 1].score : 0
    const enters = creators.length < 10 || visitor.score > lowest
    if (!enters) return { list, visitorPos: null, gap: lowest - visitor.score }
    const merged = [...list, { kind: 'visitor', id: VISITOR_ID, score: visitor.score }]
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(10, list.length))
    return { list: merged, visitorPos: merged.findIndex((r) => r.id === VISITOR_ID) + 1, gap: 0 }
  }, [creators, visitor])

  const register = useCallback((id) => (el) => {
    if (el) nodes.current.set(id, el)
    else nodes.current.delete(id)
  }, [])

  useLayoutEffect(() => {
    const animate = !reducedMotion()
    // offsetTop no depende del scroll ni de las transformaciones en curso.
    const now = new Map()
    nodes.current.forEach((el, id) => now.set(id, el.offsetTop))
    nodes.current.forEach((el, id) => {
      const before = tops.current.get(id)
      const top = now.get(id)
      if (!animate) return
      if (before !== undefined && before !== top) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }], {
          duration: 700,
          easing: EASE,
        })
      } else if (before === undefined && id === VISITOR_ID) {
        el.animate(
          [
            { opacity: 0, transform: 'scale(0.96)', filter: 'blur(4px)' },
            { opacity: 1, transform: 'none', filter: 'blur(0)' },
          ],
          { duration: 520, easing: EASE },
        )
      }
    })
    tops.current = now
  }, [rows])

  return (
    <div className="mt-6">
      <div aria-hidden="true" className={clsx(ROW_GRID, 'hidden px-4 pb-2 text-[12.5px] font-semibold text-white/55 sm:grid')}>
        <span>Pos.</span>
        <span>Creador</span>
        <span>Seguidores</span>
        <span>Engagement</span>
        <span className="text-right">Puntos</span>
        <span className="text-right">Mov.</span>
      </div>

      {loading ? (
        <ol aria-label="Cargando ranking" className="space-y-1">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="h-[66px] animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </ol>
      ) : failed ? (
        <div className="rounded-2xl border border-white/10 px-5 py-6 text-[15px] text-white/80">
          No hemos podido cargar el ranking.{' '}
          <button type="button" onClick={onRetry} className="font-bold text-white underline underline-offset-4">
            Reintentar
          </button>
        </div>
      ) : (
        <ol aria-label="Ranking general de creadores" className="divide-y divide-white/[0.07]">
          {rows.list.slice(0, expanded ? rows.list.length : Math.max(5, rows.visitorPos || 0)).map((row, i) =>
            row.kind === 'visitor' ? (
              <li key={row.id} ref={register(row.id)} className="relative z-10 py-1.5">
                <VisitorRow visitor={visitor} position={i + 1} onReset={() => setVisitor(null)} />
              </li>
            ) : (
              <li key={row.id} ref={register(row.id)} className="bg-ink/0">
                <CreatorRow creator={row.creator} position={i + 1} />
              </li>
            ),
          )}
        </ol>
      )}

      {!loading && !failed && !expanded && rows.list.length > Math.max(5, rows.visitorPos || 0) ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 border-t border-white/[0.07] text-[14.5px] font-semibold text-white/80 transition-colors hover:bg-white/[0.03] hover:text-white"
        >
          Ver el top {rows.list.length}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      ) : null}

      <div className="mt-2">
        {visitor && !rows.visitorPos ? (
          <div ref={register(VISITOR_ID)}>
            <VisitorRow visitor={visitor} position={null} gap={rows.gap} onReset={() => setVisitor(null)} />
          </div>
        ) : null}
        {!visitor ? (
          <div className="rounded-2xl border border-dashed border-brand-300/60 bg-brand-600/[0.14] p-4 sm:p-5">
            <p className="mb-4 flex items-baseline gap-3 text-[16px] font-bold text-white">
              <span className="text-[26px] font-black text-brand-200">?</span>
              Tú, todavía sin clasificar
            </p>
            <VisitorForm onResult={setVisitor} />
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-[13px] text-white/55">Ranking con datos de demostración. Tu puesto es una estimación y no se guarda.</p>
    </div>
  )
}

function Campaigns() {
  const [state, setState] = useState({ loading: true, items: [] })

  useEffect(() => {
    let alive = true
    api
      .campaigns()
      .then((r) => alive && setState({ loading: false, items: (r.items || []).slice(0, 4) }))
      .catch(() => alive && setState({ loading: false, items: [] }))
    return () => {
      alive = false
    }
  }, [])

  const budget = (c) =>
    c.budgetMin && c.budgetMax && c.budgetMin !== c.budgetMax
      ? `${formatEuro(c.budgetMin)} a ${formatEuro(c.budgetMax)}`
      : formatEuro(c.budgetMax || c.budgetMin || 0)

  return (
    <aside aria-labelledby="fichando" className="self-start rounded-3xl border border-white/[0.08] bg-ink-soft/90 p-5 lg:mt-[6.5rem]">
      <h2 id="fichando" className="text-[19px] font-extrabold tracking-[-0.02em] text-white">
        Marcas buscando creadores
      </h2>
      <p className="mt-1 text-[13px] text-white/55">Campañas de demostración</p>
      {state.loading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-white/[0.05]" />
          ))}
        </div>
      ) : state.items.length ? (
        <ul className="mt-4 space-y-2">
          {state.items.map((c) => (
            <li key={c.id} className="rounded-2xl bg-white/[0.05] px-4 py-3">
              <span className="block truncate text-[14.5px] font-bold text-white">{c.brand?.companyName || c.title}</span>
              <span className="mt-0.5 block text-[13px] text-white/65">
                {[c.category, c.targetCity || c.brand?.city].filter(Boolean).join(' · ')}
              </span>
              <span className="mt-1 block text-[13.5px] font-semibold tabular-nums text-brand-200">{budget(c)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[14px] text-white/65">Ahora mismo no hay campañas abiertas. Las nuevas aparecen aquí.</p>
      )}
      <div className="mt-5 border-t border-white/10 pt-5">
        <p className="text-[15px] font-bold text-white">¿Tienes un negocio?</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-white/65">Publica lo que necesitas gratis y elige entre creadores de tu zona.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/registro?rol=empresa" className="inline-flex min-h-[44px] items-center rounded-xl bg-white px-4 text-[14px] font-bold text-ink transition-transform active:scale-[0.97]">
            Publicar campaña
          </Link>
          <a href="#empresas" className="inline-flex min-h-[44px] items-center rounded-xl px-3 text-[14px] font-semibold text-white/85 underline underline-offset-4 hover:text-white">
            Pedir una demo
          </a>
        </div>
      </div>
    </aside>
  )
}

const SHADES = ['bg-brand-500', 'bg-white/25', 'bg-brand-300', 'bg-brand-200', 'bg-brand-100', 'bg-brand-50']

function HowItCounts() {
  return (
    <section className="mx-auto max-w-[1360px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
      <h2 className="max-w-[18ch] text-balance text-[clamp(34px,4.4vw,60px)] font-black leading-[0.98] tracking-[-0.04em] text-white">
        Tus seguidores cuentan un 20%. El resto te lo ganas.
      </h2>
      <p className="mt-5 max-w-[60ch] text-[17px] leading-relaxed text-white/70">
        Una cuenta de 18K que mueve a su gente y cumple con las marcas adelanta a una de 200K que no. Así se reparten los puntos:
      </p>
      <div className="mt-12 hidden md:block" role="img" aria-label="Reparto de la puntuación del ranking">
        <div className="flex h-14 overflow-hidden rounded-2xl">
          {WEIGHTS.map((w, i) => (
            <span key={w.key} className={SHADES[i]} style={{ flexGrow: w.weight, flexBasis: 0 }} />
          ))}
        </div>
        <div className="mt-4 flex gap-3" aria-hidden="true">
          {WEIGHTS.map((w) => (
            <span key={w.key} className="min-w-0" style={{ flexGrow: w.weight, flexBasis: 0 }}>
              <span className="block text-[28px] font-black tabular-nums leading-none tracking-[-0.03em] text-white">{Math.round(w.weight * 100)}%</span>
              <span className="mt-1.5 block text-[14px] leading-snug text-white/75">{w.label}</span>
            </span>
          ))}
        </div>
      </div>
      <ul className="mt-10 space-y-3 md:sr-only">
        {WEIGHTS.map((w, i) => (
          <li key={w.key} className="flex items-center gap-4">
            <span className={clsx('h-3 shrink-0 rounded-full', SHADES[i])} style={{ width: `${Math.round(w.weight * 220)}px` }} aria-hidden="true" />
            <span className="text-[15px] text-white/80">
              <span className="font-black tabular-nums text-white">{Math.round(w.weight * 100)}%</span> {w.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

const DEAL = [
  { title: 'La marca deposita el importe', body: 'Antes de que grabes nada. El dinero queda retenido en Mikro.' },
  { title: 'Grabas y entregas', body: 'Lo acordado, en tus redes y con tu estilo.' },
  { title: 'Aprueba y cobras', body: 'Se libera el pago y la marca te valora. Esa nota sube tu puesto.' },
]

function PaidFirst() {
  return (
    <section className="mx-auto max-w-[1360px] px-4 pb-24 sm:px-6 lg:px-10 lg:pb-32">
      <div className="grid gap-12 rounded-[2rem] border border-white/[0.08] bg-ink-soft/70 p-6 sm:p-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:p-14">
        <div>
          <ShieldCheck size={32} className="text-brand-300" aria-hidden="true" />
          <h2 className="mt-5 text-balance text-[clamp(30px,3.6vw,48px)] font-black leading-[1.02] tracking-[-0.04em] text-white">
            Nunca grabas sin que el dinero esté puesto.
          </h2>
          <p className="mt-4 max-w-[48ch] text-[16.5px] leading-relaxed text-white/70">
            Las marcas de tu ciudad pagan desde 60 € por colaboración. Mikro se queda un 12% y tú decides a qué te presentas.
          </p>
          <Link
            to="/registro?rol=creador"
            className="mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-brand-600 px-5 text-[15px] font-bold text-white transition-[transform,background-color] duration-150 hover:bg-brand-500 active:scale-[0.97]"
          >
            Crear mi perfil de creador
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <ol className="relative space-y-8 border-l border-white/15 pl-8">
          {DEAL.map((step, i) => (
            <li key={step.title} className="relative">
              <span className="absolute -left-[45px] top-0 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-[14px] font-black text-white ring-1 ring-white/25">
                {i + 1}
              </span>
              <p className="text-[19px] font-extrabold tracking-[-0.02em] text-white">{step.title}</p>
              <p className="mt-1 text-[15px] leading-relaxed text-white/70">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default function Landing() {
  const [ranking, setRanking] = useState({ loading: true, failed: false, items: [] })
  const [stats, setStats] = useState(null)

  const load = useCallback(() => {
    setRanking((r) => ({ ...r, loading: true, failed: false }))
    api
      .rankings({ limit: 10 })
      .then((r) => setRanking({ loading: false, failed: false, items: r.items || [] }))
      .catch(() => setRanking({ loading: false, failed: true, items: [] }))
  }, [])

  useEffect(() => {
    load()
    api.homeStats().then(setStats).catch(() => {})
  }, [load])

  return (
    <div className="min-h-screen bg-ink text-white selection:bg-brand-500/40">
      <section className="relative overflow-clip">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-[-25%]">
            <div className="landing-aurora landing-aurora-1" />
            <div className="landing-aurora landing-aurora-2" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-b from-transparent to-ink" />
        </div>

        <Header />

        <div className="relative z-10 mx-auto grid max-w-[1360px] gap-10 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12 lg:px-10 lg:pt-6">
          <div className="min-w-0">
            <h1 className="text-balance text-[clamp(46px,6.6vw,92px)] font-black leading-[0.92] tracking-[-0.04em] text-white">
              El ranking de Mikro
            </h1>
            <p className="mt-4 max-w-[64ch] text-[17px] leading-relaxed text-white/75 sm:text-[18px]">
              Aquí no sube quien tiene más seguidores, sino quien mueve a su gente y cumple con las marcas. La temporada ya ha empezado: mira dónde estarías.
            </p>
            <RankingTable creators={ranking.items} loading={ranking.loading} failed={ranking.failed} onRetry={load} />
          </div>
          <Campaigns />
        </div>
      </section>

      <HowItCounts />
      <PaidFirst />

      <section id="empresas" className="scroll-mt-8 border-t border-white/[0.07]">
        <div className="mx-auto max-w-[1360px] px-4 py-24 sm:px-6 lg:px-10 lg:py-32">
          <DemoFace stats={stats} />
        </div>
      </section>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6 lg:px-10">
          <Logo tone="dark" />
          <nav aria-label="Pie" className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] font-semibold text-white/70">
            <Link to="/rankings" className="py-2 hover:text-white">Ranking completo</Link>
            <Link to="/recursos" className="py-2 hover:text-white">Recursos</Link>
            <Link to="/entrar" className="py-2 hover:text-white">Entrar</Link>
          </nav>
          <p className="text-[13px] text-white/55">© {new Date().getFullYear()} Mikro</p>
        </div>
      </footer>
    </div>
  )
}
