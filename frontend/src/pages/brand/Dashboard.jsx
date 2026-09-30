import { Link } from 'react-router-dom'
import { ArrowRight, Bookmark, Euro, Handshake, Megaphone, Plus, TrendingUp, Users } from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../store/auth'
import { DashboardShell, StatCard, StatusPill } from '../../components/Dashboard'
import { CreatorMini } from '../../components/CreatorRow'
import { EmptyState, Spinner, useAsync } from '../../components/ui'
import { CAMPAIGN_STATUS, formatEuro, formatFollowers, formatNumber } from '../../lib/format'
import { BRAND_NAV } from './nav'

export default function BrandDashboard() {
  const { user } = useAuth()
  const { data, loading } = useAsync(() => api.brandDashboard(), [])
  const { data: saved } = useAsync(() => api.savedCreators(), [])
  const { data: deals } = useAsync(() => api.deals(), [])

  const s = data?.stats
  const pending = (deals?.items || []).filter((d) => ['ACCEPTED', 'SUBMITTED'].includes(d.status))

  return (
    <DashboardShell
      title={`Hola, ${user?.brand?.companyName || user?.name}`}
      subtitle="Este es el estado de tus campanas y colaboraciones."
      nav={BRAND_NAV}
      actions={
        <Link to="/empresa/campanas?nueva=1" className="btn-primary">
          <Plus size={16} /> Nueva campana
        </Link>
      }
    >
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={26} className="text-brand-600" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Campanas abiertas"
              value={s.openCampaigns}
              sub={`${s.totalCampaigns} en total`}
              icon={Megaphone}
              accent="bg-brand-50 text-brand-600"
            />
            <StatCard
              label="Candidaturas nuevas"
              value={s.pendingApplications}
              sub="pendientes de revisar"
              icon={Users}
              accent="bg-amber-50 text-amber-600"
            />
            <StatCard
              label="Colaboraciones activas"
              value={s.activeDeals}
              sub={`${s.completedDeals} completadas`}
              icon={Handshake}
              accent="bg-violet-50 text-violet-600"
            />
            <StatCard
              label="Invertido"
              value={formatEuro(s.invested)}
              sub={s.avgCost ? `${formatEuro(s.avgCost)} por colaboracion` : 'aun sin cierres'}
              icon={Euro}
              accent="bg-emerald-50 text-emerald-600"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <section className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[16px] font-extrabold tracking-tight">Tus campanas</h2>
                <Link to="/empresa/campanas" className="text-[13px] font-bold text-brand-600 hover:text-brand-700">
                  Ver todas →
                </Link>
              </div>

              {data.campaigns.length === 0 ? (
                <EmptyState
                  icon={Megaphone}
                  title="Aun no has publicado ninguna campana"
                  description="Publicar es gratis. Describe lo que necesitas y recibe candidaturas de creadores en menos de 24 horas."
                  action={
                    <Link to="/empresa/campanas?nueva=1" className="btn-dark">
                      Crear mi primera campana
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-2.5">
                  {data.campaigns.map((c) => (
                    <Link
                      key={c.id}
                      to={`/empresa/campanas/${c.id}`}
                      className="flex items-center gap-4 rounded-xl border border-black/[0.06] px-4 py-3.5 transition hover:border-black/15 hover:shadow-card"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-extrabold tracking-tight">{c.title}</p>
                        <p className="mt-0.5 text-[12.5px] font-semibold text-ink/45">
                          {c.category} · {formatEuro(c.budgetMin)} – {formatEuro(c.budgetMax)}
                        </p>
                      </div>
                      <div className="hidden text-center sm:block">
                        <p className="text-[16px] font-black leading-none">{c.applications}</p>
                        <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-ink/35">candidaturas</p>
                      </div>
                      <div className="hidden text-center sm:block">
                        <p className="text-[16px] font-black leading-none">{c.deals}</p>
                        <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-ink/35">cerradas</p>
                      </div>
                      <StatusPill status={c.status} map={CAMPAIGN_STATUS} />
                      <ArrowRight size={16} className="shrink-0 text-ink/25" />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <div className="space-y-5">
              {pending.length ? (
                <section className="card p-5">
                  <h2 className="mb-3 text-[15px] font-extrabold tracking-tight">Requieren tu accion</h2>
                  <div className="space-y-2">
                    {pending.slice(0, 4).map((d) => (
                      <Link
                        key={d.id}
                        to="/empresa/colaboraciones"
                        className="block rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-3 transition hover:border-amber-300"
                      >
                        <p className="truncate text-[13px] font-extrabold">{d.creator.displayName}</p>
                        <p className="mt-0.5 truncate text-[12px] text-ink/55">{d.campaign.title}</p>
                        <p className="mt-1.5 text-[12px] font-bold text-amber-700">
                          {d.status === 'ACCEPTED' ? 'Falta depositar el importe' : 'Contenido pendiente de revisar'}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight">
                    <Bookmark size={15} className="text-brand-600" />
                    Guardados
                  </h2>
                  <Link to="/empresa/guardados" className="text-[12.5px] font-bold text-brand-600">
                    Ver todos
                  </Link>
                </div>
                {saved?.items?.length ? (
                  <div className="space-y-0.5">
                    {saved.items.slice(0, 4).map((c) => (
                      <CreatorMini
                        key={c.id}
                        creator={c}
                        right={<span className="text-[12px] font-bold text-ink/45">{formatFollowers(c.totalFollowers)}</span>}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-[13px] text-ink/45">
                    Guarda creadores desde el buscador para tenerlos a mano.
                  </p>
                )}
              </section>

              <section className="card p-5">
                <h2 className="mb-3 flex items-center gap-2 text-[15px] font-extrabold tracking-tight">
                  <TrendingUp size={15} className="text-emerald-600" />
                  Alcance contratado
                </h2>
                <p className="text-[30px] font-black leading-none tracking-tight">{formatFollowers(s.reach)}</p>
                <p className="mt-1.5 text-[12.5px] text-ink/50">
                  seguidores sumados de los creadores con los que has trabajado
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  )
}
