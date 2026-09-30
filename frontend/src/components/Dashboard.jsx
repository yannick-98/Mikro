import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import Layout from './Layout'

/** Barra lateral de navegacion de los paneles. */
export function DashboardShell({ title, subtitle, nav, actions, children }) {
  return (
    <Layout>
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-7 lg:grid-cols-[218px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav className="flex gap-1 overflow-x-auto no-scrollbar lg:flex-col">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    clsx(
                      'flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13.5px] font-bold transition',
                      isActive ? 'bg-ink text-white' : 'text-ink/55 hover:bg-black/[0.04] hover:text-ink',
                    )
                  }
                >
                  {item.icon ? <item.icon size={16} /> : null}
                  <span className="whitespace-nowrap">{item.label}</span>
                  {item.badge ? (
                    <span className="ml-auto rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-black text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </nav>
          </aside>

          <div className="min-w-0">
            <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-[26px] font-black tracking-tight">{title}</h1>
                {subtitle ? <p className="mt-1 text-[14.5px] text-ink/55">{subtitle}</p> : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </header>
            {children}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'text-ink', accent }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <p className="text-[12px] font-bold uppercase tracking-wide text-ink/40">{label}</p>
        {Icon ? (
          <span className={clsx('flex h-8 w-8 items-center justify-center rounded-xl', accent || 'bg-black/[0.04] text-ink/45')}>
            <Icon size={15} />
          </span>
        ) : null}
      </div>
      <p className={clsx('mt-3 text-[27px] font-black leading-none tracking-tight', tone)}>{value}</p>
      {sub ? <p className="mt-1.5 text-[12.5px] font-medium text-ink/45">{sub}</p> : null}
    </div>
  )
}

export function StatusPill({ status, map }) {
  const s = map[status] || { label: status, tone: 'bg-black/10 text-ink/60' }
  return <span className={clsx('inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-bold', s.tone)}>{s.label}</span>
}

export default DashboardShell
