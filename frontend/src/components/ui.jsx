import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Imagenes con reserva local
// ---------------------------------------------------------------------------

const GRADIENTS = [
  'from-brand-500 to-brand-800',
  'from-sky-500 to-sky-800',
  'from-violet-500 to-violet-800',
  'from-pink-500 to-pink-800',
  'from-amber-500 to-amber-700',
  'from-emerald-500 to-emerald-800',
  'from-rose-500 to-rose-800',
  'from-teal-500 to-teal-800',
]

function hash(str = '') {
  let h = 0
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
}

/**
 * Avatar que nunca se ve roto: si la imagen remota falla (o no hay conexion)
 * cae a un degradado con las iniciales.
 */
export function Avatar({ src, name = '', size = 44, rounded = 'rounded-full', className }) {
  const [failed, setFailed] = useState(false)
  const gradient = GRADIENTS[hash(name) % GRADIENTS.length]
  const style = { width: size, height: size }

  if (!src || failed) {
    return (
      <div
        style={style}
        className={clsx(
          'flex shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white',
          gradient,
          rounded,
          className,
        )}
      >
        <span style={{ fontSize: size * 0.38 }}>{initials(name) || 'M'}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={name}
      style={style}
      loading="lazy"
      onError={() => setFailed(true)}
      className={clsx('shrink-0 object-cover', rounded, className)}
    />
  )
}

/** Miniatura de contenido con la misma politica de reserva que Avatar. */
export function Thumb({ src, seed = '', className, children }) {
  const [failed, setFailed] = useState(false)
  const gradient = GRADIENTS[hash(seed) % GRADIENTS.length]

  if (!src || failed) {
    return <div className={clsx('bg-gradient-to-br', gradient, className)}>{children}</div>
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={clsx('object-cover', className)}
    />
  )
}

// ---------------------------------------------------------------------------
// Iconos de plataforma
// ---------------------------------------------------------------------------

export function PlatformIcon({ platform, size = 14, className }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', className }
  // El degradado necesita un id propio por instancia: con uno compartido, al
  // desmontarse el primer icono el resto se queda sin relleno.
  const gradientId = useId()
  if (platform === 'instagram') {
    return (
      <svg {...common} aria-label="Instagram">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#f9ce34" />
            <stop offset="50%" stopColor="#ee2a7b" />
            <stop offset="100%" stopColor="#6228d7" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="6" fill={`url(#${gradientId})`} />
        <circle cx="12" cy="12" r="4.4" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="17.4" cy="6.6" r="1.2" fill="#fff" />
      </svg>
    )
  }
  if (platform === 'tiktok') {
    return (
      <svg {...common} aria-label="TikTok">
        <rect x="2" y="2" width="20" height="20" rx="6" fill="#010101" />
        <path
          d="M13.6 6v6.9a2.1 2.1 0 1 1-1.7-2.06V9.1a3.8 3.8 0 1 0 3.4 3.78V9.6c.63.44 1.4.7 2.2.72V8.62a2.94 2.94 0 0 1-2.2-2.62z"
          fill="#fff"
        />
      </svg>
    )
  }
  if (platform === 'youtube') {
    return (
      <svg {...common} aria-label="YouTube">
        <rect x="2" y="4.5" width="20" height="15" rx="4.5" fill="#ff0000" />
        <path d="M10.2 8.6l5.4 3.4-5.4 3.4z" fill="#fff" />
      </svg>
    )
  }
  return null
}

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

export function Badge({ children, className, tone = 'bg-black/5 text-ink/70' }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold', tone, className)}>
      {children}
    </span>
  )
}

export function VerifiedBadge({ size = 15, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={clsx('shrink-0', className)} aria-label="Perfil verificado">
      <path
        fill="#2563eb"
        d="M12 1.6l2.3 2.05 3.05-.3.95 2.92 2.82 1.2-1.05 2.9 1.05 2.9-2.82 1.2-.95 2.92-3.05-.3L12 19.14l-2.3-2.05-3.05.3-.95-2.92-2.82-1.2L3.93 10.37 2.88 7.47l2.82-1.2.95-2.92 3.05.3z"
      />
      <path fill="#fff" d="M10.9 13.6l-2-2-1.1 1.1 3.1 3.1 5.4-5.4-1.1-1.1z" />
    </svg>
  )
}

/** Variacion de posicion en el ranking. */
export function Delta({ value, className, showLabel = true }) {
  if (!value) {
    return <span className={clsx('text-[13px] font-semibold text-ink/30', className)}>=</span>
  }
  const up = value > 0
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[13px] font-bold', up ? 'text-emerald-600' : 'text-rose-500', className)}>
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
        <path d={up ? 'M6 1l5 7H1z' : 'M6 11L1 4h10z'} fill="currentColor" />
      </svg>
      {up ? `+${value}` : value}
      {showLabel ? <span className="sr-only">posiciones</span> : null}
    </span>
  )
}

export function Spinner({ className, size = 18 }) {
  return (
    <svg className={clsx('animate-spin', className)} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white/60 px-6 py-14 text-center">
      {Icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-black/5">
          <Icon size={22} className="text-ink/40" />
        </div>
      ) : null}
      <p className="text-[15px] font-bold text-ink">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-ink/55">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        className={clsx(
          'relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-pop animate-fade-up sm:rounded-3xl',
          width,
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-black/5 bg-white/95 px-6 py-5 backdrop-blur">
          <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink/40 transition hover:bg-black/5 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer ? <div className="sticky bottom-0 border-t border-black/5 bg-white px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  )
}

/** Aviso flotante breve. */
export function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(onDismiss, 4200)
    return () => clearTimeout(t)
  }, [toast, onDismiss])

  if (!toast) return null
  const tone =
    toast.type === 'error' ? 'bg-rose-600' : toast.type === 'info' ? 'bg-ink' : 'bg-emerald-600'
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <div className={clsx('pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-pop animate-fade-up', tone)}>
        {toast.message}
      </div>
    </div>
  )
}

export function Logo({ className, tone = 'dark' }) {
  return (
    <Link to="/" className={clsx('group inline-flex items-center gap-1', className)}>
      <span
        className={clsx(
          'text-[26px] font-black leading-none tracking-[-0.045em]',
          tone === 'dark' ? 'text-white' : 'text-ink',
        )}
      >
        mikro
      </span>
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        className="mt-[-9px] text-brand-600 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      >
        <path d="M7 17L17 7M17 7H8.5M17 7v8.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  )
}

/** Pestanas horizontales reutilizables. */
export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={clsx('flex items-center gap-6 overflow-x-auto border-b border-black/[0.07] no-scrollbar', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={clsx('tab', value === t.id && 'tab-active')}
        >
          {t.label}
          {t.count !== undefined ? (
            <span className="ml-1.5 rounded-full bg-black/5 px-1.5 py-0.5 text-[11px] text-ink/50">{t.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

export function Select({ value, onChange, options, className, ...rest }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={clsx('field appearance-none pr-9', className)} {...rest}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** Hook de carga de datos con estados de carga y error. */
export function useAsync(fn, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const [nonce, setNonce] = useState(0)
  const reload = () => setNonce((n) => n + 1)

  useEffect(() => {
    if (!immediate) return undefined
    let alive = true
    setLoading(true)
    setError(null)
    fnRef
      .current()
      .then((res) => alive && setData(res))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { data, loading, error, reload, setData }
}

/** Retrasa un valor: evita lanzar una peticion por pulsacion de tecla. */
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export function useToast() {
  const [toast, setToast] = useState(null)
  const show = useMemo(
    () => ({
      success: (message) => setToast({ message, type: 'success' }),
      error: (message) => setToast({ message, type: 'error' }),
      info: (message) => setToast({ message, type: 'info' }),
    }),
    [],
  )
  return { toast, show, dismiss: () => setToast(null) }
}
