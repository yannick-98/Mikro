import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Heart, Send } from 'lucide-react'
import { Avatar, Thumb, VerifiedBadge } from '../ui'
import { formatFollowers } from '../../lib/format'

/** Un degradado propio por categoria: la portada nunca se ve vacia. */
const TONES = {
  Fitness: 'from-rose-500/80 via-orange-500/40 to-ink',
  Moda: 'from-violet-500/80 via-fuchsia-500/35 to-ink',
  Gastronomia: 'from-amber-500/80 via-orange-600/40 to-ink',
  Viajes: 'from-sky-500/80 via-cyan-400/35 to-ink',
  Gaming: 'from-fuchsia-600/80 via-purple-600/40 to-ink',
  Tecnologia: 'from-slate-400/70 via-brand-600/40 to-ink',
  Lifestyle: 'from-emerald-500/80 via-teal-500/35 to-ink',
  Belleza: 'from-pink-500/80 via-rose-400/35 to-ink',
  Humor: 'from-yellow-400/80 via-amber-500/40 to-ink',
  Musica: 'from-indigo-500/80 via-violet-500/40 to-ink',
  Hogar: 'from-teal-500/80 via-emerald-500/35 to-ink',
  Mascotas: 'from-lime-500/80 via-green-500/35 to-ink',
  Familia: 'from-cyan-500/80 via-sky-500/35 to-ink',
  Finanzas: 'from-blue-500/80 via-indigo-600/40 to-ink',
}

/**
 * Tarjeta de publicacion del carrusel.
 *
 * Los botones de me gusta y enviar llevan a registro: sin cuenta no se puede
 * guardar nada de verdad, y fingirlo seria mentir al visitante.
 */
export default function PostCard({ creator, live = false, hours = 2, className, style, innerRef }) {
  const cover = creator.portfolio?.[0]
  const tone = TONES[creator.category] || 'from-brand-500/80 via-brand-700/40 to-ink'

  return (
    <article
      ref={innerRef}
      style={style}
      className={clsx(
        'landing-card group absolute left-1/2 top-1/2 flex flex-col overflow-hidden rounded-[22px] border border-white/12 bg-ink text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]',
        className,
      )}
    >
      <div className={clsx('absolute inset-0 bg-gradient-to-br', tone)} />
      {cover ? <Thumb src={cover.imageUrl} seed={creator.id} className="absolute inset-0 h-full w-full opacity-60 mix-blend-luminosity" /> : null}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />

      <div className="relative flex items-start justify-between p-3">
        <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold backdrop-blur">{creator.category}</span>
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
            EN DIRECTO
          </span>
        ) : (
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold backdrop-blur">{hours} h</span>
        )}
      </div>

      <div className="relative mt-auto p-2.5">
        <div className="flex items-center gap-2.5 rounded-2xl bg-black/55 p-2 backdrop-blur-md">
          <Avatar src={creator.avatarUrl} name={creator.displayName} size={34} className="ring-2 ring-white/20" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-[13px] font-extrabold leading-tight">
              {creator.displayName}
              {creator.verified ? <VerifiedBadge size={12} /> : null}
            </p>
            <p className="text-[11px] font-semibold text-white/55">
              {formatFollowers(creator.totalFollowers)} seguidores
            </p>
          </div>
          <Link
            to="/registro"
            aria-label={`Guardar a ${creator.displayName}: necesitas una cuenta`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-rose-500"
          >
            <Heart size={14} />
          </Link>
          <Link
            to="/registro"
            aria-label={`Escribir a ${creator.displayName}: necesitas una cuenta`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-ink transition hover:bg-white/85"
          >
            <Send size={14} />
          </Link>
        </div>
      </div>
    </article>
  )
}
