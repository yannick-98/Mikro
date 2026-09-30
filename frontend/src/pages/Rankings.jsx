import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { MapPin, Trophy } from 'lucide-react'
import { api } from '../api/client'
import Layout from '../components/Layout'
import { CreatorRow, CreatorRowSkeleton, CreatorMini } from '../components/CreatorRow'
import { Delta, PlatformIcon, useAsync } from '../components/ui'
import { formatNumber } from '../lib/format'

const SCOPES = [
  { id: 'global', label: 'Ranking global' },
  { id: 'category', label: 'Por categoria' },
  { id: 'city', label: 'Por ciudad' },
  { id: 'platform', label: 'Por plataforma' },
]

export default function Rankings() {
  const [scope, setScope] = useState('global')
  const [value, setValue] = useState(null)

  const { data: facets } = useAsync(() => api.facets(), [])
  const { data: movers } = useAsync(() => api.movers(8), [])
  const { data, loading } = useAsync(() => api.rankings({ scope, value, limit: 25 }), [scope, value])

  const options =
    scope === 'category' ? facets?.categories : scope === 'city' ? facets?.cities : scope === 'platform' ? facets?.platforms : null

  function changeScope(next) {
    setScope(next)
    setValue(next === 'global' ? null : null)
  }

  return (
    <Layout>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(760px_420px_at_78%_-10%,rgba(37,99,235,0.42),transparent_62%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(520px_340px_at_8%_110%,rgba(245,158,11,0.18),transparent_60%)]" />
        </div>
        <div className="relative mx-auto max-w-[1180px] px-4 py-14 sm:px-6 lg:px-8">
          <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-white/45">Actualizado cada dia</p>
          <h1 className="mt-3 text-[40px] font-black leading-[1.05] tracking-[-0.035em] sm:text-[52px]">
            Top <span className="text-brand-500">creadores</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-white/60">
            Ordenamos por engagement real, reputacion y actividad en la plataforma, no solo por numero de seguidores. Un
            perfil de 12K con comunidad viva puede estar por delante de uno de 400K.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => changeScope(s.id)}
              className={clsx('chip !px-4 !py-2 !text-[13px] !font-bold', scope === s.id && 'chip-active')}
            >
              {s.label}
            </button>
          ))}
        </div>

        {options ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setValue(value === o ? null : o)}
                className={clsx('chip !px-3 !py-1.5 !text-[12.5px]', value === o && 'chip-active')}
              >
                {scope === 'platform' ? <PlatformIcon platform={o} size={14} /> : null}
                <span className="capitalize">{o}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[19px] font-extrabold tracking-tight">
                {scope === 'global'
                  ? 'Ranking global'
                  : value
                    ? `Top ${value}`
                    : `Elige ${scope === 'category' ? 'una categoria' : scope === 'city' ? 'una ciudad' : 'una plataforma'}`}
              </h2>
              <p className="text-[12.5px] font-semibold text-ink/45">
                {loading ? 'Cargando...' : `${data?.items?.length || 0} perfiles`}
              </p>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <CreatorRowSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(data?.items || []).map((c, i) => (
                  <CreatorRow key={c.id} creator={c} position={i + 1} showSave={false} />
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="card p-4">
              <h3 className="mb-2 flex items-center gap-2 px-1 text-[14px] font-extrabold tracking-tight">
                <Trophy size={15} className="text-amber-500" />
                Mayores movimientos
              </h3>
              <div className="space-y-0.5">
                {(movers?.items || []).map((c) => (
                  <CreatorMini key={c.id} creator={c} right={<Delta value={c.rankDelta} />} />
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="mb-3 text-[14px] font-extrabold tracking-tight">Como calculamos el ranking</h3>
              <ul className="space-y-2.5 text-[13px] leading-relaxed text-ink/60">
                <li className="flex gap-2.5">
                  <span className="font-black text-brand-600">34%</span> Engagement real de la comunidad
                </li>
                <li className="flex gap-2.5">
                  <span className="font-black text-brand-600">20%</span> Alcance total (escala logaritmica)
                </li>
                <li className="flex gap-2.5">
                  <span className="font-black text-brand-600">18%</span> Valoraciones de las marcas
                </li>
                <li className="flex gap-2.5">
                  <span className="font-black text-brand-600">12%</span> Colaboraciones completadas
                </li>
                <li className="flex gap-2.5">
                  <span className="font-black text-brand-600">16%</span> Verificacion y tiempo de respuesta
                </li>
              </ul>
              <p className="mt-4 rounded-xl bg-black/[0.03] px-3 py-2.5 text-[12px] leading-relaxed text-ink/50">
                El alcance pesa en escala logaritmica a proposito: un creador con 20K comprometidos vale mas para una
                pyme que uno de 500K con audiencia fria.
              </p>
            </div>

            <Link
              to="/registro?rol=creador"
              className="block overflow-hidden rounded-2xl bg-ink p-5 text-white transition hover:bg-ink-soft"
            >
              <p className="text-[16px] font-extrabold leading-tight">Quieres aparecer aqui?</p>
              <p className="mt-1.5 text-[13px] text-white/55">
                Crea tu perfil, conecta tus redes y entra en el ranking.
              </p>
              <span className="mt-3 inline-block text-[13px] font-bold text-brand-400">Crear perfil gratis →</span>
            </Link>
          </aside>
        </div>
      </div>
    </Layout>
  )
}
