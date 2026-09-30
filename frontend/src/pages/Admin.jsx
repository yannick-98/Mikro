import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Building2, Euro, RefreshCw, Star, Users } from 'lucide-react'
import { api } from '../api/client'
import Layout from '../components/Layout'
import { StatCard } from '../components/Dashboard'
import { Avatar, Spinner, Toast, VerifiedBadge, useAsync, useToast } from '../components/ui'
import { formatEuro, formatFollowers, formatNumber, formatPercent } from '../lib/format'

export default function Admin() {
  const { toast, show, dismiss } = useToast()
  const { data, loading, reload } = useAsync(() => api.adminOverview(), [])
  const [busy, setBusy] = useState(null)

  async function verify(creator) {
    setBusy(creator.id)
    try {
      await api.verifyCreator(creator.id, true)
      show.success(`${creator.displayName} verificado`)
      reload()
    } catch (e) {
      show.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function feature(creator) {
    setBusy(creator.id)
    try {
      await api.featureCreator(creator.id, !creator.featured)
      show.success(creator.featured ? 'Quitado de destacados' : 'Marcado como destacado')
      reload()
    } catch (e) {
      show.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function recompute() {
    try {
      const res = await api.recomputeRanking()
      show.success(`Ranking recalculado para ${res.creators} creadores`)
      reload()
    } catch (e) {
      show.error(e.message)
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-black tracking-tight">Backoffice</h1>
            <p className="mt-1 text-[14.5px] text-ink/55">Estado del marketplace y verificacion de perfiles.</p>
          </div>
          <button type="button" onClick={recompute} className="btn-dark">
            <RefreshCw size={15} /> Recalcular ranking
          </button>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size={26} className="text-brand-600" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Creadores" value={formatNumber(data.stats.creators)} icon={Users} accent="bg-brand-50 text-brand-600" />
              <StatCard label="Empresas" value={formatNumber(data.stats.brands)} icon={Building2} accent="bg-violet-50 text-violet-600" />
              <StatCard
                label="Volumen transaccionado"
                value={formatEuro(data.stats.gmv)}
                sub={`${data.stats.deals} colaboraciones`}
                icon={Euro}
                accent="bg-amber-50 text-amber-600"
              />
              <StatCard
                label="Ingresos por comision"
                value={formatEuro(data.stats.revenue)}
                sub="12% sobre pagos liberados"
                icon={Star}
                accent="bg-emerald-50 text-emerald-600"
                tone="text-emerald-600"
              />
            </div>

            <section className="card p-6">
              <h2 className="text-[16px] font-extrabold tracking-tight">Perfiles pendientes de verificar</h2>
              <p className="mt-1 text-[13.5px] text-ink/55">
                Ordenados por puntuacion. Verificar mejora su posicion y da confianza a las marcas.
              </p>

              <div className="mt-5 space-y-2.5">
                {data.pendingVerification.length === 0 ? (
                  <p className="py-8 text-center text-[14px] text-ink/45">No queda ningun perfil por revisar.</p>
                ) : (
                  data.pendingVerification.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center gap-4 rounded-xl border border-black/[0.06] px-4 py-3"
                    >
                      <Avatar src={c.avatarUrl} name={c.displayName} size={42} rounded="rounded-xl" />
                      <div className="min-w-0 flex-1">
                        <Link to={`/creador/${c.handle}`} className="flex items-center gap-1.5">
                          <span className="truncate text-[14px] font-extrabold tracking-tight hover:text-brand-600">
                            {c.displayName}
                          </span>
                          {c.verified ? <VerifiedBadge size={13} /> : null}
                        </Link>
                        <p className="text-[12.5px] font-semibold text-ink/50">
                          {c.category} · {c.city} · {formatFollowers(c.totalFollowers)} · {formatPercent(c.engagementRate)}
                        </p>
                      </div>
                      <p className="text-[13px] font-bold text-ink/45">score {c.score}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => feature(c)}
                          disabled={busy === c.id}
                          className={c.featured ? 'btn-soft !px-3 !py-2 !text-[12.5px]' : 'btn-ghost !px-3 !py-2 !text-[12.5px]'}
                        >
                          <Star size={14} fill={c.featured ? 'currentColor' : 'none'} />
                          {c.featured ? 'Destacado' : 'Destacar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => verify(c)}
                          disabled={busy === c.id}
                          className="btn-primary !px-3 !py-2 !text-[12.5px]"
                        >
                          <BadgeCheck size={14} /> Verificar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
      <Toast toast={toast} onDismiss={dismiss} />
    </Layout>
  )
}
