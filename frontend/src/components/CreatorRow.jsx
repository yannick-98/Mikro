import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Bookmark, Crown } from 'lucide-react'
import { Avatar, Badge, Delta, PlatformIcon, Thumb, VerifiedBadge } from './ui'
import { formatEuro, formatFollowers, formatPercent } from '../lib/format'

function SocialPills({ accounts = [], className }) {
  return (
    <div className={clsx('flex flex-wrap items-center gap-x-3.5 gap-y-1', className)}>
      {accounts.map((a) => (
        <span key={a.platform} className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink/60">
          <PlatformIcon platform={a.platform} size={15} />
          {formatFollowers(a.followers)}
        </span>
      ))}
    </div>
  )
}

function RankBadge({ position, featured }) {
  const top3 = position <= 3
  return (
    <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-1">
      {top3 ? (
        <Crown
          size={20}
          className={clsx(position === 1 ? 'text-amber-400' : position === 2 ? 'text-slate-400' : 'text-orange-400')}
          fill="currentColor"
        />
      ) : null}
      <span
        className={clsx(
          'font-black tabular-nums leading-none tracking-tight',
          top3 ? 'text-[30px]' : 'text-[26px] text-ink/25',
          position === 1 && 'text-amber-500',
          position === 2 && 'text-slate-400',
          position === 3 && 'text-orange-400',
        )}
      >
        {String(position).padStart(2, '0')}
      </span>
      {featured ? (
        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">
          Destacado
        </span>
      ) : null}
    </div>
  )
}

/**
 * Fila del ranking de creadores: la pieza principal de la pagina Descubrir.
 */
export function CreatorRow({ creator, position, onToggleSave, saving = false, showSave = true }) {
  const rank = position ?? creator.listPosition ?? creator.rankPosition
  const portfolio = (creator.portfolio || []).slice(0, 3)

  return (
    <article
      className={clsx(
        'creator-row group relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-white px-4 py-4 transition-all sm:px-5',
        creator.featured
          ? 'border-amber-200/80 bg-gradient-to-r from-amber-50/60 to-white'
          : 'border-black/[0.06]',
        'hover:border-black/10 hover:shadow-lift lg:flex-row lg:items-center lg:gap-5',
      )}
    >
      <div className="flex items-center gap-3.5 lg:gap-4">
        <RankBadge position={rank} featured={creator.featured} />

        <Link to={`/creador/${creator.handle}`} className="shrink-0">
          <Avatar src={creator.avatarUrl} name={creator.displayName} size={68} rounded="rounded-2xl" className="ring-1 ring-black/5" />
        </Link>

        <div className="min-w-0 flex-1 lg:w-[228px] lg:flex-none lg:pr-3">
          <Link to={`/creador/${creator.handle}`} className="flex items-center gap-1.5">
            <h3 className="truncate text-[15.5px] font-extrabold tracking-tight text-ink hover:text-brand-600">
              {creator.displayName}
            </h3>
            {creator.verified ? <VerifiedBadge /> : null}
          </Link>
          <p className="mt-0.5 truncate text-[12.5px] font-semibold text-ink/50">
            {creator.category} · {creator.city}
          </p>
          {creator.headline ? <p className="mt-1 truncate text-[12.5px] text-ink/45">{creator.headline}</p> : null}
          <SocialPills accounts={creator.socialAccounts} className="mt-2" />
        </div>
      </div>

      <div className="flex items-center gap-5 lg:gap-7">
        {/* Sin criterios de busqueda no hay afinidad que mostrar: en su lugar se
            ensena la puntuacion que ordena el ranking. */}
        {creator.match != null ? (
          <div className="text-center">
            <p className="text-[19px] font-black leading-none text-emerald-600">{creator.match}%</p>
            <p className="mt-1 text-[9.5px] font-bold uppercase tracking-wider text-ink/35">Match</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-[19px] font-black leading-none text-brand-600">{Math.round(creator.score)}</p>
            <p className="mt-1 text-[9.5px] font-bold uppercase tracking-wider text-ink/35">Puntos</p>
          </div>
        )}
        <div className="text-center">
          <p className="text-[19px] font-black leading-none text-ink">{formatPercent(creator.engagementRate)}</p>
          <p className="mt-1 text-[9.5px] font-bold uppercase tracking-wider text-ink/35">Engagement</p>
        </div>
        <div className="text-center">
          <Delta value={creator.rankDelta} className="text-[15px]" />
          <p className="mt-1 whitespace-nowrap text-[9.5px] font-bold uppercase tracking-wider text-ink/35">esta semana</p>
        </div>
      </div>

      {portfolio.length ? (
        <div className="creator-row-thumbs shrink-0 gap-1.5">
          {portfolio.map((p) => (
            <Thumb key={p.id} src={p.imageUrl} seed={p.id} className="h-[54px] w-[54px] rounded-lg" />
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2 lg:ml-auto">
        <Link
          to={`/creador/${creator.handle}`}
          className="group/btn inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-ink-soft lg:flex-none"
        >
          Ver perfil
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover/btn:translate-x-0.5">
            <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        {showSave ? (
          <button
            type="button"
            onClick={() => onToggleSave?.(creator)}
            disabled={saving}
            aria-label={creator.saved ? 'Quitar de guardados' : 'Guardar creador'}
            className={clsx(
              'rounded-xl border p-2.5 transition',
              creator.saved
                ? 'border-brand-200 bg-brand-50 text-brand-600'
                : 'border-black/10 text-ink/35 hover:border-black/20 hover:text-ink',
            )}
          >
            <Bookmark size={17} fill={creator.saved ? 'currentColor' : 'none'} />
          </button>
        ) : null}
      </div>
    </article>
  )
}

/** Version compacta en formato tarjeta. */
export function CreatorCard({ creator, onToggleSave, showSave = true }) {
  const portfolio = (creator.portfolio || []).slice(0, 3)

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white transition hover:shadow-lift">
      <div className="relative flex gap-1 p-1">
        {portfolio.length ? (
          portfolio.map((p, i) => (
            <Thumb
              key={p.id}
              src={p.imageUrl}
              seed={p.id}
              className={clsx('h-24 flex-1 object-cover', i === 0 ? 'rounded-l-xl' : '', i === portfolio.length - 1 ? 'rounded-r-xl' : '')}
            />
          ))
        ) : (
          <div className="h-24 flex-1 rounded-xl bg-gradient-to-br from-brand-500 to-brand-800" />
        )}
        {creator.rankPosition ? (
          <span className="absolute left-3 top-3 rounded-lg bg-black/70 px-2 py-1 text-[11px] font-black text-white backdrop-blur">
            #{creator.rankPosition}
          </span>
        ) : null}
        {showSave ? (
          <button
            type="button"
            onClick={() => onToggleSave?.(creator)}
            aria-label={creator.saved ? 'Quitar de guardados' : 'Guardar creador'}
            className={clsx(
              'absolute right-3 top-3 rounded-lg p-1.5 backdrop-blur transition',
              creator.saved ? 'bg-brand-600 text-white' : 'bg-white/85 text-ink/50 hover:text-ink',
            )}
          >
            <Bookmark size={15} fill={creator.saved ? 'currentColor' : 'none'} />
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <div className="flex items-start gap-3">
          <Avatar src={creator.avatarUrl} name={creator.displayName} size={46} rounded="rounded-xl" />
          <div className="min-w-0 flex-1">
            <Link to={`/creador/${creator.handle}`} className="flex items-center gap-1.5">
              <h3 className="truncate text-[14.5px] font-extrabold tracking-tight hover:text-brand-600">{creator.displayName}</h3>
              {creator.verified ? <VerifiedBadge size={14} /> : null}
            </Link>
            <p className="truncate text-[12px] font-semibold text-ink/50">
              {creator.category} · {creator.city}
            </p>
          </div>
          {creator.match ? (
            <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[12px] font-black text-emerald-600">{creator.match}%</span>
          ) : null}
        </div>

        <SocialPills accounts={creator.socialAccounts} className="mt-3" />

        <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-3">
          <div>
            <p className="text-[11px] font-semibold text-ink/40">Engagement</p>
            <p className="text-[14px] font-black text-ink">{formatPercent(creator.engagementRate)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold text-ink/40">Desde</p>
            <p className="text-[14px] font-black text-ink">{creator.rates?.post ? formatEuro(creator.rates.post) : '—'}</p>
          </div>
        </div>

        <Link
          to={`/creador/${creator.handle}`}
          className="mt-3.5 inline-flex items-center justify-center rounded-xl bg-ink px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-ink-soft"
        >
          Ver perfil
        </Link>
      </div>
    </article>
  )
}

/** Fila reducida para los widgets laterales. */
export function CreatorMini({ creator, right }) {
  return (
    <Link to={`/creador/${creator.handle}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-black/[0.03]">
      <Avatar src={creator.avatarUrl} name={creator.displayName} size={36} rounded="rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-ink">{creator.displayName}</p>
        <p className="truncate text-[11.5px] font-medium text-ink/45">{creator.category}</p>
      </div>
      {right}
    </Link>
  )
}

export function CreatorRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-white px-5 py-4">
      <div className="skeleton h-9 w-9" />
      <div className="skeleton h-[68px] w-[68px] rounded-2xl" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-40" />
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-3 w-52" />
      </div>
      <div className="skeleton hidden h-10 w-16 lg:block" />
      <div className="skeleton hidden h-10 w-16 lg:block" />
      <div className="skeleton h-10 w-28 rounded-xl" />
    </div>
  )
}

export default CreatorRow
