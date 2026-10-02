import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Bell, ChevronDown, LogOut, Menu, Search, X } from 'lucide-react'
import { api } from '../api/client'
import { homeFor, useAuth } from '../store/auth'
import { Avatar, Logo } from './ui'
import { formatRelative } from '../lib/format'

const NAV = [
  { to: '/descubrir', label: 'Descubrir' },
  { to: '/rankings', label: 'Rankings' },
  { to: '/recursos', label: 'Recursos' },
]

function NotificationBell({ dark }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState({ items: [], unread: 0 })
  const ref = useRef(null)

  useEffect(() => {
    api.notifications().then(setData).catch(() => {})
  }, [])

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && data.unread > 0) {
      await api.readNotifications().catch(() => {})
      setData((d) => ({ ...d, unread: 0 }))
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        className={clsx(
          'relative rounded-xl p-2 transition',
          dark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-ink/50 hover:bg-black/5 hover:text-ink',
        )}
        aria-label="Notificaciones"
      >
        <Bell size={19} />
        {data.unread > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
            {data.unread > 9 ? '9+' : data.unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-pop">
          <div className="border-b border-black/5 px-4 py-3 text-sm font-bold">Notificaciones</div>
          <div className="max-h-96 overflow-y-auto">
            {data.items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink/45">No tienes avisos todavia.</p>
            ) : (
              data.items.map((n) => (
                <Link
                  key={n.id}
                  to={n.link || '#'}
                  onClick={() => setOpen(false)}
                  className="block border-b border-black/[0.04] px-4 py-3 transition last:border-0 hover:bg-black/[0.02]"
                >
                  <p className="text-[13px] font-bold text-ink">{n.title}</p>
                  {n.body ? <p className="mt-0.5 line-clamp-2 text-[13px] text-ink/60">{n.body}</p> : null}
                  <p className="mt-1 text-[11px] font-medium text-ink/35">{formatRelative(n.createdAt)}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function UserMenu({ dark }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const links =
    user.role === 'BRAND'
      ? [
          { to: '/empresa', label: 'Panel de empresa' },
          { to: '/empresa/campanas', label: 'Mis campanas' },
          { to: '/empresa/colaboraciones', label: 'Colaboraciones' },
          { to: '/empresa/guardados', label: 'Creadores guardados' },
          { to: '/empresa/perfil', label: 'Datos de la empresa' },
        ]
      : user.role === 'CREATOR'
        ? [
            { to: '/creador', label: 'Mi panel' },
            { to: '/creador/oportunidades', label: 'Oportunidades' },
            { to: '/creador/candidaturas', label: 'Mis candidaturas' },
            { to: '/creador/colaboraciones', label: 'Colaboraciones' },
            { to: '/creador/perfil', label: 'Editar mi perfil' },
          ]
        : [{ to: '/admin', label: 'Backoffice' }]

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2.5 transition',
          dark ? 'hover:bg-white/10' : 'hover:bg-black/5',
        )}
      >
        <Avatar src={user.avatarUrl} name={user.name} size={30} />
        <span className={clsx('hidden text-[13px] font-bold sm:block', dark ? 'text-white' : 'text-ink')}>
          {user.name.split(' ')[0]}
        </span>
        <ChevronDown size={15} className={dark ? 'text-white/60' : 'text-ink/40'} />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-pop">
          <div className="border-b border-black/5 px-4 py-3">
            <p className="truncate text-sm font-bold">{user.name}</p>
            <p className="truncate text-[12px] text-ink/50">{user.email}</p>
          </div>
          <div className="py-1.5">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-[13px] font-semibold text-ink/75 transition hover:bg-black/[0.03] hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              logout()
              setOpen(false)
              navigate('/')
            }}
            className="flex w-full items-center gap-2 border-t border-black/5 px-4 py-3 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-50"
          >
            <LogOut size={15} /> Cerrar sesion
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function Header({ transparent = false }) {
  const { user } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMobileOpen(false), [location.pathname])

  // Sobre el hero oscuro la cabecera es transparente; al bajar se vuelve solida.
  const dark = transparent && !scrolled

  return (
    <header
      className={clsx(
        'sticky top-0 z-40 transition-colors duration-300',
        transparent ? (scrolled ? 'bg-white/95 shadow-card backdrop-blur' : 'bg-transparent') : 'border-b border-black/[0.07] bg-white/95 backdrop-blur',
      )}
    >
      <div className="mx-auto flex h-[68px] max-w-[1480px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Logo tone={dark ? 'dark' : 'light'} />

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'relative rounded-lg px-3 py-2 text-[14px] font-semibold transition',
                  dark
                    ? isActive
                      ? 'text-white after:absolute after:inset-x-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-brand-500 after:content-[""]'
                      : 'text-white/65 hover:text-white'
                    : isActive
                      ? 'text-brand-600 after:absolute after:inset-x-3 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-brand-600 after:content-[""]'
                      : 'text-ink/60 hover:text-ink',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/descubrir?focus=1')}
            className={clsx(
              'hidden rounded-xl p-2 transition sm:block',
              dark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-ink/50 hover:bg-black/5 hover:text-ink',
            )}
            aria-label="Buscar creadores"
          >
            <Search size={19} />
          </button>

          {user ? (
            <>
              <NotificationBell dark={dark} />
              <Link
                to={homeFor(user)}
                className={clsx(
                  'hidden rounded-xl px-3.5 py-2 text-[13px] font-bold transition md:block',
                  dark ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-ink/70 hover:bg-black/5 hover:text-ink',
                )}
              >
                {user.role === 'BRAND' ? 'Panel' : user.role === 'CREATOR' ? 'Mi panel' : 'Backoffice'}
              </Link>
              <UserMenu dark={dark} />
            </>
          ) : (
            <>
              <Link
                to="/entrar"
                className={clsx(
                  'rounded-xl border px-4 py-2 text-[13px] font-bold transition',
                  dark
                    ? 'border-white/25 text-white hover:bg-white/10'
                    : 'border-black/10 text-ink hover:bg-black/[0.04]',
                )}
              >
                Iniciar sesion
              </Link>
              <Link
                to="/registro"
                className="group inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-brand-700"
              >
                Registrate
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:translate-x-0.5">
                  <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className={clsx('rounded-xl p-2 transition lg:hidden', dark ? 'text-white' : 'text-ink')}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-black/5 bg-white px-4 py-3 lg:hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx('block rounded-lg px-3 py-2.5 text-sm font-semibold', isActive ? 'bg-brand-50 text-brand-700' : 'text-ink/70')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </header>
  )
}

export function Footer() {
  const year = new Date().getFullYear()
  const columns = [
    {
      title: 'Producto',
      links: [
        { to: '/descubrir', label: 'Descubrir creadores' },
        { to: '/rankings', label: 'Rankings' },
        { to: '/recursos', label: 'Guias y plantillas' },
      ],
    },
    {
      title: 'Recursos',
      links: [
        { to: '/recursos', label: 'Guias y plantillas' },
        { to: '/recursos#precios', label: 'Tarifas orientativas' },
        { to: '/recursos#legal', label: 'Publicidad y ley' },
        { to: '/recursos#faq', label: 'Preguntas frecuentes' },
      ],
    },
    {
      title: 'Empresa',
      links: [
        { to: '/recursos#sobre', label: 'Sobre Mikro' },
        { to: '/recursos#contacto', label: 'Contacto' },
        { to: '/recursos#legal', label: 'Aviso legal' },
        { to: '/recursos#legal', label: 'Privacidad' },
      ],
    },
  ]

  return (
    <footer className="mt-20 border-t border-black/[0.07] bg-white">
      <div className="mx-auto max-w-[1480px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo tone="light" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink/55">
              El marketplace que conecta pymes con micro-influencers. Publicidad que se nota, a precio de pyme.
            </p>
            <p className="mt-5 text-[13px] font-semibold text-ink/40">Hecho en Espana</p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="mb-3.5 text-[13px] font-bold uppercase tracking-wide text-ink/40">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-sm font-medium text-ink/65 transition hover:text-brand-600">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-black/[0.07] pt-6 sm:flex-row sm:items-center">
          <p className="text-[13px] text-ink/45">© {year} Mikro. Proyecto de demostracion.</p>
          <p className="text-[13px] text-ink/45">Los datos mostrados son ficticios.</p>
        </div>
      </div>
    </footer>
  )
}

export default function Layout({ children, transparentHeader = false }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header transparent={transparentHeader} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
