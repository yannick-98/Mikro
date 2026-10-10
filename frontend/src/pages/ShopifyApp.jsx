import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { Check, Copy, Link2, Loader2, Plus, Store, TrendingUp } from 'lucide-react'
import { Spinner } from '../components/ui'
import { formatEuro, formatNumber } from '../lib/format'

/**
 * La app de Mikro dentro del admin de Shopify.
 *
 * Vive en la misma aplicacion de React para no mantener dos despliegues, pero
 * no comparte nada con el resto: aqui no hay sesion de usuario de Mikro, la
 * identidad la pone Shopify con un token que caduca en un minuto y que hay
 * que pedir de nuevo en cada llamada.
 */

const API_KEY = import.meta.env.VITE_SHOPIFY_API_KEY || ''

/** Carga App Bridge una sola vez y espera a que exista window.shopify. */
function useAppBridge() {
  const [estado, setEstado] = useState({ listo: false, error: null })

  useEffect(() => {
    if (window.shopify?.idToken) {
      setEstado({ listo: true, error: null })
      return undefined
    }
    if (!API_KEY) {
      setEstado({ listo: false, error: 'Falta VITE_SHOPIFY_API_KEY en el entorno.' })
      return undefined
    }

    let script = document.querySelector('script[data-mikro-app-bridge]')
    if (!script) {
      script = document.createElement('script')
      script.src = 'https://cdn.shopify.com/shopifycloud/app-bridge.js'
      script.setAttribute('data-api-key', API_KEY)
      script.setAttribute('data-mikro-app-bridge', '')
      document.head.appendChild(script)
    }

    let vivo = true
    // App Bridge no avisa con un evento: se comprueba hasta que aparece.
    const limite = Date.now() + 8000
    const esperar = () => {
      if (!vivo) return
      if (window.shopify?.idToken) return setEstado({ listo: true, error: null })
      if (Date.now() > limite) {
        return setEstado({
          listo: false,
          error: 'Esta pagina tiene que abrirse desde el panel de tu tienda en Shopify.',
        })
      }
      setTimeout(esperar, 120)
    }
    script.addEventListener('error', () => vivo && setEstado({ listo: false, error: 'No se pudo cargar App Bridge.' }))
    esperar()

    return () => {
      vivo = false
    }
  }, [])

  return estado
}

function Boton({ children, className, loading, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-bold transition disabled:cursor-not-allowed disabled:opacity-60',
        className || 'bg-ink text-white hover:bg-ink/90',
      )}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
      {children}
    </button>
  )
}

function Codigo({ code }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1800)
        } catch {
          // Sin permiso de portapapeles el codigo sigue a la vista: no pasa nada.
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-black/5 px-2.5 py-1 font-mono text-[12.5px] font-bold tracking-tight transition hover:bg-black/10"
      title="Copiar el codigo"
    >
      {code}
      {copiado ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} className="opacity-45" />}
    </button>
  )
}

/** Vincular la tienda con la cuenta de empresa de Mikro. */
function Vincular({ onLink, error }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [enviando, setEnviando] = useState(false)

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-black/[0.08] bg-white p-7">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Link2 size={19} />
      </span>
      <h2 className="mt-4 text-[19px] font-black tracking-tight">Conecta tu cuenta de Mikro</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/55">
        Para ver aquí tus campañas y las ventas que generan, entra con la cuenta de empresa que ya
        usas en Mikro.
      </p>

      <form
        className="mt-5 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault()
          setEnviando(true)
          await onLink(form)
          setEnviando(false)
        }}
      >
        <input
          className="field"
          type="email"
          required
          placeholder="tu@empresa.es"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <input
          className="field"
          type="password"
          required
          placeholder="Tu contraseña de Mikro"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        />
        {error ? <p className="text-[12.5px] font-semibold text-rose-600">{error}</p> : null}
        <Boton type="submit" loading={enviando} className="w-full bg-brand-600 text-white hover:bg-brand-700">
          Conectar
        </Boton>
      </form>

      <p className="mt-4 text-[12.5px] text-ink/45">
        ¿Todavía no tienes cuenta?{' '}
        <a
          href="https://mikro-marketplace.netlify.app/registro?rol=empresa"
          target="_blank"
          rel="noreferrer"
          className="font-bold text-brand-600 hover:underline"
        >
          Créala gratis
        </a>
        , es un minuto.
      </p>
    </div>
  )
}

export default function ShopifyApp() {
  const bridge = useAppBridge()
  const [sesion, setSesion] = useState(null)
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  const [errorVinculo, setErrorVinculo] = useState(null)
  const [creando, setCreando] = useState(null)

  /**
   * Llama al API con un token recien pedido.
   *
   * El token de sesion dura alrededor de un minuto, asi que no se guarda: se
   * pide uno en cada llamada, que es justo para lo que esta pensado.
   */
  const llamar = useCallback(
    async (path, { method = 'GET', body, shopToken } = {}) => {
      const token = shopToken || sesion?.token
      const res = await fetch(`/api/shopify${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      return data
    },
    [sesion],
  )

  // Apertura: token de App Bridge -> sesion de tienda.
  useEffect(() => {
    if (!bridge.listo) return
    let vivo = true
    ;(async () => {
      try {
        const sessionToken = await window.shopify.idToken()
        const res = await fetch('/api/shopify/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'No se pudo abrir la sesion')
        if (vivo) setSesion(data)
      } catch (e) {
        if (vivo) setError(e.message)
      }
    })()
    return () => {
      vivo = false
    }
  }, [bridge.listo])

  const cargar = useCallback(async () => {
    try {
      setDatos(await llamar('/overview'))
    } catch (e) {
      setError(e.message)
    }
  }, [llamar])

  useEffect(() => {
    if (sesion?.shop?.linked) cargar()
  }, [sesion, cargar])

  const vincular = async (credenciales) => {
    setErrorVinculo(null)
    try {
      const { shop } = await llamar('/link', { method: 'POST', body: credenciales })
      setSesion((s) => ({ ...s, shop }))
    } catch (e) {
      setErrorVinculo(e.message)
    }
  }

  const crearCodigo = async (campaignId) => {
    setCreando(campaignId)
    try {
      await llamar('/attributions', { method: 'POST', body: { campaignId, percentage: 10 } })
      await cargar()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreando(null)
    }
  }

  // -------------------------------------------------------------------------

  if (bridge.error) {
    return (
      <Marco>
        <p className="text-[14px] text-ink/60">{bridge.error}</p>
      </Marco>
    )
  }

  if (!sesion) {
    return (
      <Marco>
        {error ? (
          <p className="text-[14px] font-semibold text-rose-600">{error}</p>
        ) : (
          <div className="flex items-center gap-3 text-[14px] text-ink/55">
            <Spinner size={18} className="text-brand-600" /> Conectando con tu tienda…
          </div>
        )}
      </Marco>
    )
  }

  if (!sesion.shop.linked) {
    return (
      <Marco shop={sesion.shop}>
        <Vincular onLink={vincular} error={errorVinculo} />
      </Marco>
    )
  }

  const totals = datos?.totals

  return (
    <Marco shop={sesion.shop}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Cifra
          icono={TrendingUp}
          label="Ventas atribuidas"
          valor={totals ? formatEuro(totals.salesTotal) : '—'}
          sub="con códigos de Mikro"
        />
        <Cifra label="Pedidos" valor={totals ? formatNumber(totals.ordersCount) : '—'} sub="desde colaboraciones" />
        <Cifra label="Códigos activos" valor={totals ? formatNumber(totals.activeCodes) : '—'} sub="uno por creador" />
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="mt-5 rounded-2xl border border-black/[0.08] bg-white p-6">
        <h2 className="text-[16px] font-extrabold tracking-tight">Tus campañas</h2>
        <p className="mt-1 text-[13.5px] text-ink/55">
          Cada creador recibe su propio código. Cuando alguien lo usa, la venta se cuenta aquí.
        </p>

        {!datos ? (
          <div className="flex justify-center py-10">
            <Spinner size={20} className="text-brand-600" />
          </div>
        ) : !datos.campaigns.length ? (
          <p className="py-10 text-center text-[14px] text-ink/45">
            Todavía no tienes campañas. Publica una en Mikro y aparecerá aquí.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {datos.campaigns.map((c) => (
              <article key={c.id} className="rounded-xl border border-black/[0.06] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-extrabold tracking-tight">{c.title}</p>
                    <p className="mt-0.5 text-[12.5px] font-semibold text-ink/50">
                      {c.applications} candidaturas · {c.deals} colaboraciones
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-[15px] font-black tabular-nums">{formatEuro(c.salesTotal)}</p>
                      <p className="text-[11.5px] font-semibold text-ink/45">{c.ordersCount} pedidos</p>
                    </div>
                    <Boton onClick={() => crearCodigo(c.id)} loading={creando === c.id}>
                      <Plus size={14} /> Código
                    </Boton>
                  </div>
                </div>

                {c.attributions.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2 border-t border-black/[0.05] pt-3">
                    {c.attributions.map((a) => (
                      <li key={a.id} className="flex items-center gap-2 text-[12.5px] text-ink/60">
                        <Codigo code={a.code} />
                        <span>
                          {a.creator?.displayName || 'sin asignar'} · {a.ordersCount} ped. ·{' '}
                          {formatEuro(a.salesTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </Marco>
  )
}

function Cifra({ icono: Icono, label, valor, sub }) {
  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-5">
      <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-ink/40">
        {Icono ? <Icono size={13} /> : null}
        {label}
      </div>
      <p className="mt-2 text-[26px] font-black leading-none tabular-nums">{valor}</p>
      <p className="mt-1.5 text-[12.5px] text-ink/45">{sub}</p>
    </div>
  )
}

function Marco({ children, shop }) {
  return (
    <div className="min-h-screen bg-[#f6f6f7] px-5 py-7">
      <div className="mx-auto max-w-[900px]">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[22px] font-black leading-none tracking-[-0.045em] text-ink">
            mikro<span className="align-super text-[11px] text-brand-600">↗</span>
          </span>
          {shop ? (
            <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[12.5px] font-semibold text-ink/60">
              <Store size={13} />
              {shop.name || shop.domain}
            </span>
          ) : null}
        </header>
        {children}
      </div>
    </div>
  )
}
