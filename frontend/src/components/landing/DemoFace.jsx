import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { CalendarCheck, CheckCircle2, Clock3, Loader2, Sparkles, Users2 } from 'lucide-react'
import { api } from '../../api/client'

const AGENDA = [
  {
    icon: Clock3,
    title: 'Veinte minutos, por videollamada',
    body: 'Sin presentación corporativa. Abrimos la plataforma y trabajamos sobre tu caso.',
  },
  {
    icon: Users2,
    title: 'Cinco creadores de tu sector',
    body: 'Los buscamos en directo, con sus métricas y su precio real delante.',
  },
  {
    icon: CalendarCheck,
    title: 'Una campaña lista para publicar',
    body: 'Te la dejamos redactada en tu cuenta. Si no te encaja, no la publicas y ya está.',
  },
]

const TEAM_SIZES = [
  { value: '1-5', label: '1 a 5 personas' },
  { value: '6-20', label: '6 a 20' },
  { value: '21-50', label: '21 a 50' },
  { value: '50+', label: 'Más de 50' },
]

const BUDGETS = [
  { value: 'menos-300', label: 'Menos de 300 € / mes' },
  { value: '300-800', label: '300 - 800 € / mes' },
  { value: '800-2000', label: '800 - 2.000 € / mes' },
  { value: 'mas-2000', label: 'Más de 2.000 € / mes' },
  { value: 'por-decidir', label: 'Todavía no lo sé' },
]

const EMPTY = {
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  sector: '',
  city: '',
  teamSize: '',
  monthlyBudget: '',
  goal: '',
  consent: false,
}

const field =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13.5px] font-semibold text-white placeholder:text-white/25 outline-none transition focus:border-brand-400/70 focus:bg-white/[0.07]'

function Field({ label, error, children, className }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1 block text-[11.5px] font-bold uppercase tracking-[0.1em] text-white/40">
        {label}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[11.5px] font-semibold text-rose-300">{error}</span> : null}
    </label>
  )
}

/**
 * Cuarta seccion: el texto comercial a la izquierda y la peticion de demo a la
 * derecha.
 *
 * El formulario no pide cuenta. Una pyme que esta decidiendo si esto le sirve
 * no deberia tener que registrarse para que alguien se lo explique.
 */
export default function DemoFace({ stats }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [state, setState] = useState('idle') // idle | sending | done
  const [failure, setFailure] = useState(null)

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (state === 'sending') return

    // Se valida aqui tambien para no gastar un viaje al servidor en un email
    // mal escrito; el servidor vuelve a validarlo, que es quien decide.
    const next = {}
    if (form.companyName.trim().length < 2) next.companyName = 'Indica el nombre de tu empresa'
    if (form.contactName.trim().length < 2) next.contactName = 'Indica tu nombre'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Email no válido'
    if (!form.consent) next.consent = 'Necesitamos tu permiso para poder escribirte'
    if (Object.keys(next).length) {
      setErrors(next)
      return
    }

    setState('sending')
    setFailure(null)
    try {
      await api.requestDemo({ ...form, email: form.email.trim().toLowerCase() })
      setState('done')
    } catch (err) {
      setState('idle')
      // El detalle por campo que devuelve el servidor se pinta donde toca.
      if (err.details?.length) {
        setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])))
      } else {
        setFailure(err.message || 'No hemos podido enviar la peticion')
      }
    }
  }

  return (
    <div className="grid w-full items-center gap-10 lg:grid-cols-[1fr_1.02fr] lg:gap-14">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
          <Sparkles size={12} className="text-brand-300" />
          Demo para empresas
        </span>

        <h2 className="mt-4 text-[30px] font-black leading-[1.05] tracking-[-0.04em] text-white sm:text-[40px]">
          Te lo enseñamos con{' '}
          <span className="bg-gradient-to-r from-brand-400 to-cyan-300 bg-clip-text text-transparent">
            tu marca delante
          </span>
        </h2>

        <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-white/55">
          Nada de cuestionarios ni de presupuestos cerrados. Nos cuentas qué vendes y a quién, y en
          la misma llamada te montamos tu primera campaña con creadores reales de tu zona.
        </p>

        <ul className="mt-7 space-y-4">
          {AGENDA.map((item) => (
            <li key={item.title} className="flex gap-3.5">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
                <item.icon size={16} />
              </span>
              <span>
                <span className="block text-[14px] font-extrabold text-white">{item.title}</span>
                <span className="mt-0.5 block max-w-sm text-[12.5px] leading-relaxed text-white/45">
                  {item.body}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/[0.07] pt-5 text-[12px] font-semibold text-white/35">
          <span>Respondemos en 24 h laborables</span>
          <span className="hidden sm:inline">·</span>
          <span>Sin compromiso ni tarjeta</span>
          {stats ? (
            <>
              <span className="hidden sm:inline">·</span>
              <span>{stats.creators} creadores esperando campañas</span>
            </>
          ) : null}
        </div>
      </div>

      {/* El formulario */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.9)] sm:p-7">
        {state === 'done' ? (
          <div className="py-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
              <CheckCircle2 size={26} />
            </span>
            <p className="mt-4 text-[20px] font-black tracking-[-0.02em] text-white">
              Recibido, {form.contactName.split(' ')[0]}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-white/50">
              Te escribimos a <span className="font-bold text-white/75">{form.email}</span> en menos
              de 24 horas laborables con dos huecos para la llamada.
            </p>
            <p className="mt-6 text-[12.5px] text-white/35">
              Si quieres ir mirando mientras,{' '}
              <Link to="/registro?rol=empresa" className="font-bold text-brand-300 hover:text-brand-200">
                crea la cuenta
              </Link>{' '}
              — es gratis.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className="text-[17px] font-black tracking-[-0.02em] text-white">Pide tu demo</p>
            <p className="mt-1 text-[12.5px] text-white/40">
              Lo marcado con * es lo único imprescindible.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Empresa *" error={errors.companyName}>
                <input
                  className={field}
                  value={form.companyName}
                  onChange={set('companyName')}
                  placeholder="Panadería La Espiga"
                  autoComplete="organization"
                />
              </Field>
              <Field label="Tu nombre *" error={errors.contactName}>
                <input
                  className={field}
                  value={form.contactName}
                  onChange={set('contactName')}
                  placeholder="Marina Solís"
                  autoComplete="name"
                />
              </Field>
              <Field label="Email *" error={errors.email}>
                <input
                  className={field}
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="marina@laespiga.es"
                  autoComplete="email"
                />
              </Field>
              <Field label="Teléfono" error={errors.phone}>
                <input
                  className={field}
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="600 000 000"
                  autoComplete="tel"
                />
              </Field>
              <Field label="Sector" error={errors.sector}>
                <input
                  className={field}
                  value={form.sector}
                  onChange={set('sector')}
                  placeholder="Alimentación"
                />
              </Field>
              <Field label="Ciudad" error={errors.city}>
                <input
                  className={field}
                  value={form.city}
                  onChange={set('city')}
                  placeholder="Valencia"
                  autoComplete="address-level2"
                />
              </Field>
              <Field label="Tamaño del equipo" error={errors.teamSize}>
                <select className={field} value={form.teamSize} onChange={set('teamSize')}>
                  <option value="">Sin especificar</option>
                  {TEAM_SIZES.map((o) => (
                    <option key={o.value} value={o.value} className="bg-ink">
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Presupuesto" error={errors.monthlyBudget}>
                <select className={field} value={form.monthlyBudget} onChange={set('monthlyBudget')}>
                  <option value="">Sin especificar</option>
                  {BUDGETS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-ink">
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Qué quieres conseguir" error={errors.goal} className="sm:col-span-2">
                <textarea
                  className={clsx(field, 'min-h-[64px] resize-none leading-relaxed')}
                  value={form.goal}
                  onChange={set('goal')}
                  placeholder="Abrimos una segunda tienda en marzo y queremos que se note en el barrio."
                />
              </Field>
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={set('consent')}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-white/10 accent-brand-500"
              />
              <span className="text-[12px] leading-relaxed text-white/45">
                Acepto que Mikro guarde estos datos para contactarme sobre la demo. Nada más, y los
                borramos si lo pides.
                {errors.consent ? (
                  <span className="mt-0.5 block font-semibold text-rose-300">{errors.consent}</span>
                ) : null}
              </span>
            </label>

            {failure ? (
              <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] font-semibold text-rose-200">
                {failure}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={state === 'sending'}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 py-3 text-[15px] font-black text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === 'sending' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Enviando…
                </>
              ) : (
                <>
                  Pedir la demo
                  <span aria-hidden="true">→</span>
                </>
              )}
            </button>

            <p className="mt-3 text-center text-[11.5px] text-white/30">
              ¿Prefieres probarlo tú?{' '}
              <Link to="/registro?rol=empresa" className="font-bold text-white/55 hover:text-white">
                Crea la cuenta gratis
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
