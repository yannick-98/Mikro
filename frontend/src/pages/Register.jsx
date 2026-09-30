import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { Building2, Check, UserRound } from 'lucide-react'
import { homeFor, useAuth } from '../store/auth'
import { Logo, Spinner, useAsync } from '../components/ui'
import { api } from '../api/client'

const BENEFITS = {
  BRAND: [
    'Publica campanas gratis, sin cuota mensual',
    'Filtra por ciudad, nicho y engagement real',
    'Paga solo cuando el contenido esta aprobado',
    'Comision del 12%, sin letra pequena',
  ],
  CREATOR: [
    'Cobra por tu trabajo desde 60 euros',
    'El dinero queda en garantia antes de grabar',
    'Marcas locales que buscan tu nicho',
    'Tu reputacion viaja contigo',
  ],
}

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: facets } = useAsync(() => api.facets(), [])

  const [role, setRole] = useState(params.get('rol') === 'creador' ? 'CREATOR' : 'BRAND')
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    sector: '',
    category: 'Lifestyle',
    city: 'Madrid',
  })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const payload =
        role === 'BRAND'
          ? {
              role,
              name: form.name,
              email: form.email,
              password: form.password,
              companyName: form.companyName || form.name,
              sector: form.sector || 'Otros',
              city: form.city,
            }
          : {
              role,
              name: form.name,
              email: form.email,
              password: form.password,
              category: form.category,
              city: form.city,
            }
      const user = await register(payload)
      navigate(homeFor(user), { replace: true })
    } catch (err) {
      setError(err.details?.[0]?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_0.85fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <Logo tone="light" />

          <h1 className="mt-10 text-[30px] font-black leading-tight tracking-tight">Crea tu cuenta</h1>
          <p className="mt-2 text-[14.5px] text-ink/55">Tarda menos de un minuto y no pedimos tarjeta.</p>

          <div className="mt-7 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setRole('BRAND')}
              className={clsx(
                'rounded-2xl border-2 p-4 text-left transition',
                role === 'BRAND' ? 'border-ink bg-ink text-white' : 'border-black/[0.08] bg-white hover:border-black/20',
              )}
            >
              <Building2 size={19} className={role === 'BRAND' ? 'text-brand-400' : 'text-ink/40'} />
              <p className="mt-2.5 text-[14px] font-extrabold">Soy una empresa</p>
              <p className={clsx('mt-0.5 text-[12px]', role === 'BRAND' ? 'text-white/55' : 'text-ink/45')}>
                Quiero contratar creadores
              </p>
            </button>
            <button
              type="button"
              onClick={() => setRole('CREATOR')}
              className={clsx(
                'rounded-2xl border-2 p-4 text-left transition',
                role === 'CREATOR' ? 'border-ink bg-ink text-white' : 'border-black/[0.08] bg-white hover:border-black/20',
              )}
            >
              <UserRound size={19} className={role === 'CREATOR' ? 'text-brand-400' : 'text-ink/40'} />
              <p className="mt-2.5 text-[14px] font-extrabold">Soy creador</p>
              <p className={clsx('mt-0.5 text-[12px]', role === 'CREATOR' ? 'text-white/55' : 'text-ink/45')}>
                Quiero monetizar mi audiencia
              </p>
            </button>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label">{role === 'BRAND' ? 'Nombre de contacto' : 'Tu nombre'}</label>
              <input required value={form.name} onChange={set('name')} className="field" placeholder={role === 'BRAND' ? 'Marina Solis' : 'Marta Garcia'} />
            </div>

            {role === 'BRAND' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Empresa</label>
                  <input value={form.companyName} onChange={set('companyName')} className="field" placeholder="Panaderia La Espiga" />
                </div>
                <div>
                  <label className="label">Sector</label>
                  <input value={form.sector} onChange={set('sector')} className="field" placeholder="Alimentacion" />
                </div>
              </div>
            ) : (
              <div>
                <label className="label">Categoria principal</label>
                <select value={form.category} onChange={set('category')} className="field">
                  {(facets?.categories || ['Lifestyle']).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label">Ciudad</label>
              <select value={form.city} onChange={set('city')} className="field">
                {(facets?.cities || ['Madrid']).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Email</label>
              <input required type="email" value={form.email} onChange={set('email')} className="field" placeholder="tu@email.es" />
            </div>

            <div>
              <label className="label">Contrasena</label>
              <input
                required
                type="password"
                minLength={6}
                value={form.password}
                onChange={set('password')}
                className="field"
                placeholder="Minimo 6 caracteres"
              />
            </div>

            {error ? (
              <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-semibold text-rose-700">{error}</p>
            ) : null}

            <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
              {loading ? <Spinner size={16} /> : null}
              Crear cuenta gratis
            </button>

            <p className="text-center text-[12px] leading-relaxed text-ink/45">
              Al registrarte aceptas las condiciones de uso y la politica de privacidad de Mikro.
            </p>
          </form>

          <p className="mt-6 text-center text-[13.5px] text-ink/55">
            Ya tienes cuenta?{' '}
            <Link to="/entrar" className="font-bold text-brand-600 hover:text-brand-700">
              Inicia sesion
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(700px_460px_at_75%_5%,rgba(37,99,235,0.45),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(520px_380px_at_10%_100%,rgba(16,185,129,0.22),transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-center p-14 text-white">
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-white/40">
            {role === 'BRAND' ? 'Para empresas' : 'Para creadores'}
          </p>
          <h2 className="mt-4 max-w-sm text-[34px] font-black leading-tight tracking-tight">
            {role === 'BRAND' ? 'Publicidad que se nota, a precio de pyme.' : 'Tu comunidad vale dinero. Cobralo.'}
          </h2>
          <ul className="mt-8 space-y-3.5">
            {BENEFITS[role].map((b) => (
              <li key={b} className="flex items-start gap-3 text-[14.5px] text-white/70">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600">
                  <Check size={12} strokeWidth={3.5} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
