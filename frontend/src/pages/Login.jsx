import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, Sparkles, UserRound } from 'lucide-react'
import { homeFor, useAuth } from '../store/auth'
import { Logo, Spinner } from '../components/ui'

const DEMO = [
  { label: 'Empresa', email: 'hola@laespiga.es', icon: Building2, hint: 'Panaderia La Espiga' },
  { label: 'Creadora', email: 'martagarcia@creador.mikro.es', icon: UserRound, hint: 'Marta Garcia · Fitness' },
  { label: 'Admin', email: 'admin@mikro.es', icon: Sparkles, hint: 'Backoffice' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const user = await login(form)
      navigate(location.state?.from || homeFor(user), { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function useDemo(email) {
    setForm({ email, password: 'mikro1234' })
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Logo tone="light" />

          <h1 className="mt-10 text-[30px] font-black leading-tight tracking-tight">Bienvenido de nuevo</h1>
          <p className="mt-2 text-[14.5px] text-ink/55">Entra para gestionar tus campanas y colaboraciones.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="field"
                placeholder="tu@empresa.es"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Contrasena
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="field"
                placeholder="········"
              />
            </div>

            {error ? (
              <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-semibold text-rose-700">{error}</p>
            ) : null}

            <button type="submit" disabled={loading} className="btn-dark w-full !py-3">
              {loading ? <Spinner size={16} /> : null}
              Iniciar sesion
            </button>
          </form>

          <div className="mt-8 rounded-2xl border border-black/[0.07] bg-white p-4">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-wide text-ink/40">Cuentas de demostracion</p>
            <div className="space-y-1.5">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => useDemo(d.email)}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-black/[0.03]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/5 text-ink/50">
                    <d.icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-ink">{d.label}</span>
                    <span className="block truncate text-[11.5px] text-ink/45">{d.hint}</span>
                  </span>
                  <ArrowRight size={14} className="text-ink/30" />
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11.5px] text-ink/40">Contrasena para todas: mikro1234</p>
          </div>

          <p className="mt-8 text-center text-[13.5px] text-ink/55">
            No tienes cuenta?{' '}
            <Link to="/registro" className="font-bold text-brand-600 hover:text-brand-700">
              Registrate gratis
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(800px_500px_at_70%_10%,rgba(37,99,235,0.45),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(600px_400px_at_20%_95%,rgba(139,92,246,0.3),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <blockquote className="max-w-md">
            <p className="text-[27px] font-black leading-snug tracking-tight">
              "Con 400 euros hicimos mas ruido que con seis meses de anuncios."
            </p>
            <footer className="mt-5 text-[14px] font-semibold text-white/50">
              Marina Solis · Panaderia La Espiga, Valencia
            </footer>
          </blockquote>
          <div className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-8">
            <div>
              <p className="text-[26px] font-black">68</p>
              <p className="text-[12px] font-semibold text-white/45">creadores</p>
            </div>
            <div>
              <p className="text-[26px] font-black">12%</p>
              <p className="text-[12px] font-semibold text-white/45">comision unica</p>
            </div>
            <div>
              <p className="text-[26px] font-black">24h</p>
              <p className="text-[12px] font-semibold text-white/45">primera respuesta</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
