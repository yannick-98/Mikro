import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Crown, Sparkles } from 'lucide-react'
import { Avatar, VerifiedBadge } from '../ui'
import { formatPercent } from '../../lib/format'

/** Oro, plata y bronce: el anillo del avatar y el numero del bloque. */
const METALS = {
  1: { ring: 'ring-amber-400/45', glow: '', num: 'text-amber-300', bar: 'from-amber-300/18 to-transparent' },
  2: { ring: 'ring-slate-400/35', glow: '', num: 'text-slate-200', bar: 'from-slate-300/10 to-transparent' },
  3: { ring: 'ring-orange-400/35', glow: '', num: 'text-orange-300', bar: 'from-orange-400/10 to-transparent' },
}

function Delta({ value }) {
  if (!value) return <span className="text-[11px] font-bold text-white/30">—</span>
  const up = value > 0
  return (
    <span className={clsx('text-[11px] font-bold', up ? 'text-emerald-400' : 'text-rose-400')}>
      {up ? '▲' : '▼'} {Math.abs(value)}
    </span>
  )
}

function PodiumStep({ creator, place, slotRef }) {
  const metal = METALS[place]
  const height = place === 1 ? 'h-[100px]' : place === 2 ? 'h-[86px]' : 'h-[76px]'

  return (
    <div className={clsx('flex flex-col items-center', place === 1 ? 'order-2' : place === 2 ? 'order-1' : 'order-3')}>
      <div className="relative">
        {place === 1 ? <Crown size={23} className="absolute -top-8 left-1/2 -translate-x-1/2 text-amber-300" fill="currentColor" /> : null}
        <Avatar
          src={creator?.avatarUrl}
          name={creator?.displayName || '—'}
          size={place === 1 ? 64 : 54}
          className={clsx('ring-2', metal.ring, metal.glow)}
        />
        <span className={clsx('absolute -bottom-1 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-ink bg-ink text-[11px] font-black', metal.num)}>
          {place}
        </span>
      </div>

      <p className="mt-2 flex items-center gap-1 text-[13.5px] font-extrabold text-white">
        {creator?.displayName || '—'}
        {creator?.verified ? <VerifiedBadge size={13} /> : null}
      </p>
      <p className="text-[11.5px] font-semibold text-white/40">@{creator?.handle || '—'}</p>

      <div
        ref={slotRef}
        className={clsx(
          'mt-2 flex w-[158px] flex-col items-center justify-center gap-0.5 rounded-2xl border border-white/[0.07] bg-gradient-to-b px-2 py-2.5',
          height,
          metal.bar,
        )}
      >
        <span className={clsx('text-[24px] font-black leading-none', metal.num)}>{place}</span>
        <span className="text-[14px] font-black leading-none text-white">
          {Math.round(creator?.score || 0)}
          <span className="ml-1 text-[11px] font-bold text-white/40">pts</span>
        </span>
        <Delta value={creator?.rankDelta} />
      </div>
    </div>
  )
}

function Row({ creator, place, slotRef, max }) {
  const width = max ? Math.max(12, Math.round((creator.score / max) * 100)) : 60
  return (
    <div
      ref={slotRef}
      className="flex items-center gap-3 rounded-xl px-3.5 py-[3px] transition hover:bg-white/[0.04]"
    >
      <span className="w-6 text-[13px] font-black text-white/25">{String(place).padStart(2, '0')}</span>
      <Avatar src={creator.avatarUrl} name={creator.displayName} size={26} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-[12.5px] font-extrabold leading-tight text-white">
          {creator.displayName}
          {creator.verified ? <VerifiedBadge size={11} /> : null}
        </p>
        <p className="truncate text-[10.5px] font-semibold leading-tight text-white/35">@{creator.handle}</p>
      </div>
      <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-white/10 sm:block lg:w-52">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-400" style={{ width: `${width}%` }} />
      </div>
      <span className="w-14 text-right text-[12.5px] font-black text-white">
        {Math.round(creator.score)}
        <span className="ml-0.5 text-[10px] font-bold text-white/35">pts</span>
      </span>
      <span className="w-8 text-right">
        <Delta value={creator.rankDelta} />
      </span>
    </div>
  )
}

/**
 * Cara frontal del panel: el podio y la lista.
 *
 * Los slots (slotRefs) son los huecos a los que vuelan las tarjetas del
 * carrusel durante la absorcion; se miden en el DOM para que manden las
 * posiciones reales y no numeros inventados.
 */
export default function Podium({ creators = [], slotRefs }) {
  const top3 = creators.slice(0, 3)
  const rest = creators.slice(3, 10)
  const max = creators[0]?.score || 100

  return (
    <div className="w-full">
      <div className="mb-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Ranking en vivo
        </span>
        <h2 className="mt-2.5 text-[26px] font-black leading-tight tracking-[-0.04em] text-white sm:text-[33px]">
          Aquí se mide quién <span className="bg-gradient-to-r from-brand-400 to-cyan-300 bg-clip-text text-transparent">mueve de verdad</span>
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-relaxed text-white/50">
          No ordenamos por seguidores. Un perfil de 20K con comunidad viva está por delante de uno de
          500K con audiencia fría.
        </p>
      </div>

      <div className="mt-12 flex items-end justify-center gap-7 sm:gap-14">
        {[2, 1, 3].map((place) => (
          <PodiumStep
            key={place}
            place={place}
            creator={top3[place - 1]}
            slotRef={(el) => slotRefs && (slotRefs.current[place - 1] = el)}
          />
        ))}
      </div>

      <div className="mx-auto mt-4 max-w-4xl rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
        {rest.map((c, i) => (
          <Row
            key={c.id}
            creator={c}
            place={i + 4}
            max={max}
            slotRef={(el) => slotRefs && (slotRefs.current[i + 3] = el)}
          />
        ))}

        {/* La fila espejo: el visitante se ve a si mismo en la lista. */}
        <Link
          to="/registro?rol=creador"
          className="group mt-1 flex items-center gap-3.5 rounded-xl border border-dashed border-brand-400/40 bg-brand-500/[0.07] px-3.5 py-1.5 transition hover:border-brand-400/70 hover:bg-brand-500/[0.12]"
        >
          <span className="w-6 text-[13px] font-black text-brand-300/60">11</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-brand-400/50 text-brand-300">
            <Sparkles size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-extrabold text-white">Tu nombre aquí</span>
            <span className="block text-[11px] font-semibold text-white/40">
              Crea tu perfil y entra en el ranking
            </span>
          </span>
          <span className="text-[12px] font-bold text-brand-300 transition group-hover:translate-x-0.5">
            Empezar →
          </span>
        </Link>
      </div>

      <div className="mt-4 flex justify-center">
        <Link
          to="/registro?rol=creador"
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-7 py-3 text-[14.5px] font-black text-ink transition hover:bg-white/90"
        >
          Soy creador
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  )
}
