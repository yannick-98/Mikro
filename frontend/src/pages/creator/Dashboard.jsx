import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, Briefcase, Check, Euro, Eye, Star, TrendingUp, Trophy } from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../store/auth'
import { DashboardShell, StatCard } from '../../components/Dashboard'
import { Delta, EmptyState, Spinner, useAsync } from '../../components/ui'
import { formatEuro, formatFollowers, formatPercent } from '../../lib/format'
import { CREATOR_NAV } from './nav'

export default function CreatorDashboard() {
  const { user } = useAuth()
  const { data, loading } = useAsync(() => api.creatorDashboard(), [])
  const { data: campaigns } = useAsync(() => api.campaigns({}), [])

  if (loading) {
    return (
      <DashboardShell title="Mi panel" nav={CREATOR_NAV}>
        <div className="flex justify-center py-20">
          <Spinner size={26} className="text-brand-600" />
        </div>
      </DashboardShell>
    )
  }

  const s = data.stats
  const completion = data.profileCompletion
  const best = (campaigns?.items || []).filter((c) => !c.applied).sort((a, b) => (b.match || 0) - (a.match || 0)).slice(0, 3)

  return (
    <DashboardShell
      title={`Hola, ${user?.name?.split(' ')[0]}`}
      subtitle="Tu resumen de ingresos, posicion y oportunidades."
      nav={CREATOR_NAV}
      actions={
        <Link to="/creador/oportunidades" className="btn-primary">
          <Briefcase size={16} /> Ver oportunidades
        </Link>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Ingresos cobrados"
            value={formatEuro(s.earned)}
            sub={s.pending ? `${formatEuro(s.pending)} pendientes de cobro` : 'sin pagos pendientes'}
            icon={Euro}
            accent="bg-emerald-50 text-emerald-600"
            tone="text-emerald-600"
          />
          <StatCard
            label="Posicion en el ranking"
            value={s.rankPosition ? `#${s.rankPosition}` : '—'}
            sub={<Delta value={s.rankDelta} />}
            icon={Trophy}
            accent="bg-amber-50 text-amber-600"
          />
          <StatCard
            label="Audiencia"
            value={formatFollowers(s.totalFollowers)}
            sub={`${formatPercent(s.engagementRate)} de engagement`}
            icon={TrendingUp}
            accent="bg-brand-50 text-brand-600"
          />
          <StatCard
            label="Valoracion"
            value={s.ratingCount ? `${s.ratingAvg}/5` : '—'}
            sub={s.ratingCount ? `${s.ratingCount} valoraciones` : 'aun sin valoraciones'}
            icon={Star}
            accent="bg-violet-50 text-violet-600"
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-5">
            {completion.percent < 100 ? (
              <section className="card p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-[16px] font-extrabold tracking-tight">Completa tu perfil</h2>
                  <span className="text-[15px] font-black text-brand-600">{completion.percent}%</span>
                </div>
                <p className="mt-1.5 text-[13.5px] text-ink/55">
                  Los perfiles completos reciben cuatro veces mas propuestas. Te faltan unos pocos datos.
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/[0.07]">
                  <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${completion.percent}%` }} />
                </div>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {completion.checks.map((c) => (
                    <li
                      key={c.id}
                      className={clsx(
                        'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold',
                        c.done ? 'bg-emerald-50 text-emerald-700' : 'bg-black/[0.03] text-ink/55',
                      )}
                    >
                      <span
                        className={clsx(
                          'flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full',
                          c.done ? 'bg-emerald-600 text-white' : 'border-2 border-black/15',
                        )}
                        style={{ width: 18, height: 18 }}
                      >
                        {c.done ? <Check size={11} strokeWidth={3.5} /> : null}
                      </span>
                      {c.label}
                    </li>
                  ))}
                </ul>
                <Link to="/creador/perfil" className="btn-dark mt-5">
                  Completar mi perfil
                  <ArrowRight size={15} />
                </Link>
              </section>
            ) : null}

            <section className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[16px] font-extrabold tracking-tight">Oportunidades que te encajan</h2>
                <Link to="/creador/oportunidades" className="text-[13px] font-bold text-brand-600 hover:text-brand-700">
                  Ver todas →
                </Link>
              </div>

              {best.length === 0 ? (
                <EmptyState
                  icon={Briefcase}
                  title="Ahora mismo no hay campanas nuevas"
                  description="Te avisaremos cuando una marca publique algo de tu nicho."
                />
              ) : (
                <div className="space-y-2.5">
                  {best.map((c) => (
                    <Link
                      key={c.id}
                      to="/creador/oportunidades"
                      className="flex items-center gap-4 rounded-xl border border-black/[0.06] px-4 py-3.5 transition hover:border-black/15 hover:shadow-card"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-extrabold tracking-tight">{c.title}</p>
                        <p className="mt-0.5 text-[12.5px] font-semibold text-ink/45">
                          {c.brand?.companyName} · {c.category} · {c.targetCity || 'Toda Espana'}
                        </p>
                      </div>
                      {c.match ? (
                        <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[12px] font-black text-emerald-600">
                          {c.match}%
                        </span>
                      ) : null}
                      <p className="whitespace-nowrap text-[13.5px] font-black">
                        {formatEuro(c.budgetMin)} – {formatEuro(c.budgetMax)}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-5">
            <section className="card p-5">
              <h2 className="mb-3.5 text-[15px] font-extrabold tracking-tight">Tu actividad</h2>
              <dl className="space-y-3 text-[13.5px]">
                {[
                  ['Colaboraciones activas', s.activeDeals],
                  ['Colaboraciones completadas', s.completedDeals],
                  ['Candidaturas pendientes', s.pendingApplications],
                  ['Invitaciones sin responder', s.invitations],
                  ['Campanas abiertas en Mikro', s.openCampaigns],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border-b border-black/[0.05] pb-3 last:border-0 last:pb-0">
                    <dt className="font-medium text-ink/55">{k}</dt>
                    <dd className="text-[15px] font-black">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <Link
              to={`/creador/${data.creator.handle}`}
              className="card block p-5 transition hover:border-black/15 hover:shadow-lift"
            >
              <div className="flex items-center gap-2.5">
                <Eye size={16} className="text-ink/40" />
                <p className="text-[14px] font-extrabold tracking-tight">Ver mi perfil publico</p>
              </div>
              <p className="mt-1.5 text-[13px] text-ink/50">Asi te ven las marcas cuando te encuentran.</p>
            </Link>

            <section className="relative overflow-hidden rounded-2xl bg-ink p-5 text-white">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(320px_180px_at_85%_0%,rgba(37,99,235,0.5),transparent_65%)]" />
              <div className="relative">
                <p className="text-[15px] font-extrabold leading-tight">Sube en el ranking</p>
                <p className="mt-2 text-[13px] leading-relaxed text-white/55">
                  Responde en menos de 24 horas y cierra colaboraciones: son los dos factores que mas te hacen subir.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
