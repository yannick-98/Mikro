import { useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import { PlatformIcon } from './ui'
import { formatFollowers } from '../lib/format'

/** Estado inicial de los filtros de busqueda. */
export const EMPTY_FILTERS = {
  categories: [],
  cities: [],
  platforms: [],
  minFollowers: undefined,
  maxFollowers: undefined,
  minEngagement: undefined,
  audienceCountry: '',
  language: '',
}

export function countActiveFilters(f) {
  return (
    f.categories.length +
    f.cities.length +
    f.platforms.length +
    (f.minFollowers != null || f.maxFollowers != null ? 1 : 0) +
    (f.minEngagement ? 1 : 0) +
    (f.audienceCountry ? 1 : 0) +
    (f.language ? 1 : 0)
  )
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-black/[0.06] py-4 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-[13px] font-bold text-ink"
      >
        {title}
        <ChevronDown size={15} className={clsx('text-ink/35 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  )
}

const TIERS = [
  { id: 'all', label: 'Cualquier tamano', min: undefined, max: undefined },
  { id: 'nano', label: 'Nano · 1K – 10K', min: 1000, max: 10000 },
  { id: 'micro', label: 'Micro · 10K – 50K', min: 10000, max: 50000 },
  { id: 'mid', label: 'Medio · 50K – 250K', min: 50000, max: 250000 },
  { id: 'macro', label: 'Macro · +250K', min: 250000, max: undefined },
]

const ENGAGEMENT = [
  { value: '', label: 'Cualquiera' },
  { value: '2', label: '+2%' },
  { value: '3', label: '+3%' },
  { value: '5', label: '+5%' },
  { value: '7', label: '+7%' },
]

/**
 * Panel lateral de filtros. Los cambios se aplican al instante: en un
 * marketplace de descubrimiento, obligar a pulsar "aplicar" corta la
 * exploracion.
 */
export default function Filters({ value, onChange, facets, className, onClose }) {
  const f = value
  const categories = facets?.categories || []
  const cities = facets?.cities || []
  const languages = facets?.languages || []
  const audienceCountries = facets?.audienceCountries || []

  const toggle = (key, item) => {
    const list = f[key]
    onChange({ ...f, [key]: list.includes(item) ? list.filter((x) => x !== item) : [...list, item] })
  }

  const activeTier =
    TIERS.find((t) => t.min === f.minFollowers && t.max === f.maxFollowers)?.id || (f.minFollowers || f.maxFollowers ? 'custom' : 'all')

  const active = countActiveFilters(f)

  return (
    <aside className={clsx('card p-5', className)}>
      <div className="flex items-center justify-between pb-1">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight">
          <SlidersHorizontal size={16} className="text-ink/40" />
          Filtros
          {active > 0 ? (
            <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-black text-white">{active}</span>
          ) : null}
        </h2>
        <button
          type="button"
          onClick={() => onChange({ ...EMPTY_FILTERS })}
          className="text-[12.5px] font-bold text-brand-600 transition hover:text-brand-700"
        >
          Limpiar todo
        </button>
      </div>

      <Section title="Categoria">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggle('categories', c)}
              className={clsx('chip !px-2.5 !py-1 !text-[12px]', f.categories.includes(c) && 'chip-active')}
            >
              {c}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Ubicacion">
        <div className="flex flex-wrap gap-1.5">
          {cities.slice(0, 10).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggle('cities', c)}
              className={clsx('chip !px-2.5 !py-1 !text-[12px]', f.cities.includes(c) && 'chip-active')}
            >
              {c}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Seguidores">
        <div className="space-y-1.5">
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange({ ...f, minFollowers: t.min, maxFollowers: t.max })}
              className={clsx(
                'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[12.5px] font-semibold transition',
                activeTier === t.id ? 'bg-ink text-white' : 'text-ink/65 hover:bg-black/[0.04]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {f.minFollowers || f.maxFollowers ? (
          <p className="mt-2 text-[11.5px] font-semibold text-ink/40">
            {formatFollowers(f.minFollowers || 0)} – {f.maxFollowers ? formatFollowers(f.maxFollowers) : 'sin limite'}
          </p>
        ) : null}
      </Section>

      <Section title="Plataforma">
        <div className="space-y-1">
          {(facets?.platforms || []).map((p) => (
            <label
              key={p}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-black/[0.03]"
            >
              <input
                type="checkbox"
                checked={f.platforms.includes(p)}
                onChange={() => toggle('platforms', p)}
                className="h-4 w-4 rounded border-black/20 text-brand-600 focus:ring-brand-500/30"
              />
              <PlatformIcon platform={p} size={17} />
              <span className="text-[13px] font-semibold capitalize text-ink/75">{p}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Audiencia" defaultOpen={false}>
        <select
          value={f.audienceCountry}
          onChange={(e) => onChange({ ...f, audienceCountry: e.target.value })}
          className="field !py-2 !text-[13px]"
        >
          <option value="">Cualquier pais</option>
          {audienceCountries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Section>

      <Section title="Engagement minimo" defaultOpen={false}>
        <div className="flex flex-wrap gap-1.5">
          {ENGAGEMENT.map((e) => (
            <button
              key={e.value}
              type="button"
              onClick={() => onChange({ ...f, minEngagement: e.value ? Number(e.value) : undefined })}
              className={clsx(
                'chip !px-3 !py-1 !text-[12px]',
                String(f.minEngagement ?? '') === e.value && 'chip-active',
              )}
            >
              {e.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Idioma" defaultOpen={false}>
        <select
          value={f.language}
          onChange={(e) => onChange({ ...f, language: e.target.value })}
          className="field !py-2 !text-[13px]"
        >
          <option value="">Cualquier idioma</option>
          {languages.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </Section>

      {onClose ? (
        <button type="button" onClick={onClose} className="btn-dark mt-4 w-full">
          Ver resultados
        </button>
      ) : null}
    </aside>
  )
}
