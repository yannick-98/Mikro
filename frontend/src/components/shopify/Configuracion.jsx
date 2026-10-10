import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { AlertTriangle, Check, Link2, Link2Off, RefreshCw, ShieldCheck, Unplug } from 'lucide-react'
import { Spinner } from '../ui'
import { formatMoney } from '../../lib/format'

/**
 * Pantalla de configuracion de la app incrustada.
 *
 * Reune lo que la tienda puede cambiar y lo que tiene derecho a comprobar: con
 * que cuenta esta vinculada, como se crean sus codigos, si la conexion con
 * Shopify sigue en pie y que datos guardamos. Lo ultimo no es relleno legal:
 * quien instala una app que lee sus pedidos merece leerlo sin salir de aqui.
 */

const ESTADOS = {
  ACTIVE: { texto: 'Activo', clase: 'bg-emerald-50 text-emerald-700' },
  PAUSED: { texto: 'Pausado', clase: 'bg-amber-50 text-amber-700' },
  ENDED: { texto: 'Retirado', clase: 'bg-black/[0.06] text-ink/50' },
}

const TEMAS = {
  ORDERS_CREATE: 'Pedidos nuevos',
  ORDERS_PAID: 'Pedidos pagados',
  REFUNDS_CREATE: 'Devoluciones',
  APP_UNINSTALLED: 'Desinstalación',
}

const campo =
  'w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-[13.5px] font-semibold text-ink outline-none transition focus:border-brand-500'
const etiqueta = 'mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-ink/40'

function Seccion({ titulo, descripcion, children, aviso }) {
  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
      <h2 className="text-[16px] font-extrabold tracking-tight">{titulo}</h2>
      {descripcion ? <p className="mt-1 text-[13.5px] leading-relaxed text-ink/55">{descripcion}</p> : null}
      {aviso ? (
        <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {aviso}
        </p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  )
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
      {loading ? <Spinner size={14} /> : null}
      {children}
    </button>
  )
}

/**
 * Un codigo con su enlace y su destino.
 *
 * El enlace se ensena entero aunque sea largo: quien lo va a pegar en una bio
 * tiene derecho a ver a donde lleva antes de darselo a un creador.
 */
function FilaCodigo({ a, host, money, ocupado, confirmando, onConfirmar, onRetirar, onDestino }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(a.landingUrl || '')
  const estado = ESTADOS[a.status] || ESTADOS.ACTIVE

  const guardar = async () => {
    const ok = await onDestino(a.id, valor.trim() || null)
    if (ok) setEditando(false)
  }

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-lg bg-black/[0.05] px-2 py-1 font-mono text-[12.5px] font-bold">
          {a.code}
        </span>
        <span className="rounded bg-black/[0.05] px-1.5 py-0.5 text-[12px] font-bold">
          {a.percentage}%
        </span>
        <span className={clsx('rounded-full px-2 py-0.5 text-[11.5px] font-bold', estado.clase)}>
          {estado.texto}
        </span>
        <span className="text-[12.5px] text-ink/55">
          {a.creator?.displayName || 'sin asignar'}
          {a.campaign ? ` · ${a.campaign}` : ''}
        </span>
        <span className="ml-auto text-[12.5px] font-bold tabular-nums">
          {a.ordersCount} ped. · {money(a.netTotal)}
        </span>
        {a.status !== 'ENDED' ? (
          confirmando ? (
            <span className="flex items-center gap-1.5">
              <Boton
                onClick={() => onConfirmar(null)}
                className="!px-2.5 !py-1.5 !text-[12px] bg-black/[0.06] text-ink hover:bg-black/10"
              >
                No
              </Boton>
              <Boton
                onClick={() => onRetirar(a.id)}
                loading={ocupado}
                className="!px-2.5 !py-1.5 !text-[12px] bg-rose-600 text-white hover:bg-rose-700"
              >
                Retirar
              </Boton>
            </span>
          ) : (
            <Boton
              onClick={() => onConfirmar(a.id)}
              className="!px-2.5 !py-1.5 !text-[12px] bg-black/[0.06] text-ink hover:bg-black/10"
            >
              Retirar
            </Boton>
          )
        ) : null}
      </div>

      {a.shareUrl ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link2 size={12} className="shrink-0 text-ink/30" />
          <code className="min-w-0 break-all text-[11.5px] text-ink/50">{a.shareUrl}</code>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(a.shareUrl).catch(() => {})}
            className="rounded-md bg-black/[0.05] px-2 py-0.5 text-[11.5px] font-bold text-ink/60 transition hover:bg-black/10"
          >
            Copiar
          </button>
          {a.status !== 'ENDED' && !editando ? (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="text-[11.5px] font-bold text-brand-600 hover:underline"
            >
              {a.landingUrl ? 'Cambiar destino' : 'Elegir destino'}
            </button>
          ) : null}
        </div>
      ) : null}

      {editando ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[260px] flex-1 items-center rounded-lg border border-black/15 bg-white focus-within:border-brand-500">
            <span className="shrink-0 pl-2.5 text-[12.5px] font-semibold text-ink/35">{host}</span>
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="/products/mi-producto"
              className="w-full bg-transparent px-1.5 py-1.5 text-[12.5px] font-semibold text-ink outline-none"
            />
          </div>
          <Boton
            onClick={guardar}
            loading={ocupado}
            className="!px-2.5 !py-1.5 !text-[12px] bg-brand-600 text-white hover:bg-brand-700"
          >
            Guardar
          </Boton>
          <Boton
            onClick={() => {
              setValor(a.landingUrl || '')
              setEditando(false)
            }}
            className="!px-2.5 !py-1.5 !text-[12px] bg-black/[0.06] text-ink hover:bg-black/10"
          >
            Cancelar
          </Boton>
        </div>
      ) : null}
    </div>
  )
}

export default function Configuracion({ llamar, shop, onShopChange, onError }) {
  const [datos, setDatos] = useState(null)
  const [form, setForm] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [ocupado, setOcupado] = useState(null)
  const [confirmando, setConfirmando] = useState(null)

  const cargar = useCallback(async () => {
    try {
      const d = await llamar('/settings')
      setDatos(d)
      setForm((actual) => actual || { ...d.shop.settings })
    } catch (e) {
      onError?.(e.message)
    }
  }, [llamar, onError])

  useEffect(() => {
    cargar()
  }, [cargar])

  const guardar = async () => {
    setGuardando(true)
    setGuardado(false)
    try {
      const { shop: actualizado } = await llamar('/settings', {
        method: 'PATCH',
        body: {
          codePrefix: form.codePrefix,
          defaultPercentage: Number(form.defaultPercentage),
          defaultOncePerCustomer: form.defaultOncePerCustomer,
        },
      })
      onShopChange?.(actualizado)
      setForm({ ...actualizado.settings })
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
      await cargar()
    } catch (e) {
      onError?.(e.message)
    } finally {
      setGuardando(false)
    }
  }

  /** Reapunta el enlace de un codigo a otra pagina de la tienda. */
  const destino = async (id, landingUrl) => {
    setOcupado(id)
    try {
      await llamar(`/attributions/${id}`, { method: 'PATCH', body: { landingUrl } })
      await cargar()
      return true
    } catch (e) {
      onError?.(e.message)
      return false
    } finally {
      setOcupado(null)
    }
  }

  const retirar = async (id) => {
    setOcupado(id)
    try {
      await llamar(`/attributions/${id}/end`, { method: 'POST' })
      await cargar()
    } catch (e) {
      onError?.(e.message)
    } finally {
      setOcupado(null)
      setConfirmando(null)
    }
  }

  const reparar = async () => {
    setOcupado('webhooks')
    try {
      await llamar('/settings/webhooks', { method: 'POST' })
      await cargar()
    } catch (e) {
      onError?.(e.message)
    } finally {
      setOcupado(null)
    }
  }

  const desvincular = async () => {
    setOcupado('desvincular')
    try {
      const { shop: actualizado } = await llamar('/unlink', { method: 'POST' })
      onShopChange?.(actualizado)
    } catch (e) {
      onError?.(e.message)
    } finally {
      setOcupado(null)
      setConfirmando(null)
    }
  }

  if (!datos || !form) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={22} className="text-brand-600" />
      </div>
    )
  }

  const money = (n) => formatMoney(n, shop.currency)
  const caidos = datos.webhooks?.filter((w) => !w.activo) || []

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------------ */}
      <Seccion
        titulo="Cuenta de Mikro"
        descripcion="La cuenta de empresa con la que se comparten campañas y ventas."
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-extrabold">{shop.brand?.companyName || 'Sin vincular'}</p>
            <p className="mt-0.5 text-[12.5px] text-ink/50">{shop.domain}</p>
          </div>
          {confirmando === 'desvincular' ? (
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] text-ink/60">
                Dejarás de ver tus campañas aquí. Los códigos y las ventas se conservan.
              </span>
              <Boton onClick={() => setConfirmando(null)} className="bg-black/[0.06] text-ink hover:bg-black/10">
                Cancelar
              </Boton>
              <Boton
                onClick={desvincular}
                loading={ocupado === 'desvincular'}
                className="bg-rose-600 text-white hover:bg-rose-700"
              >
                Desvincular
              </Boton>
            </div>
          ) : (
            <Boton
              onClick={() => setConfirmando('desvincular')}
              className="bg-black/[0.06] text-ink hover:bg-black/10"
            >
              <Link2Off size={14} /> Desvincular
            </Boton>
          )}
        </div>
      </Seccion>

      {/* ------------------------------------------------------------------ */}
      <Seccion
        titulo="Cómo se crean tus códigos"
        descripcion="Valores con los que llega el formulario cada vez. Siempre puedes cambiarlos al crear uno."
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className={etiqueta}>Prefijo</span>
            <input
              value={form.codePrefix}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  codePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12),
                }))
              }
              className={clsx(campo, 'font-mono')}
            />
          </label>
          <label className="block">
            <span className={etiqueta}>Descuento por defecto</span>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={60}
                value={form.defaultPercentage}
                onChange={(e) => setForm((f) => ({ ...f, defaultPercentage: e.target.value }))}
                className={clsx(campo, 'pr-7 tabular-nums')}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-ink/40">
                %
              </span>
            </div>
          </label>
          <Boton
            onClick={guardar}
            loading={guardando}
            className={guardado ? 'bg-emerald-600 text-white' : 'bg-brand-600 text-white hover:bg-brand-700'}
          >
            {guardado ? <Check size={14} /> : null}
            {guardado ? 'Guardado' : 'Guardar'}
          </Boton>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={form.defaultOncePerCustomer}
            onChange={(e) => setForm((f) => ({ ...f, defaultOncePerCustomer: e.target.checked }))}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-600"
          />
          <span className="text-[12.5px] leading-relaxed text-ink/60">
            Limitar cada código a un uso por cliente.{' '}
            <span className="text-ink/45">
              Evita que una misma persona lo use varias veces, pero obliga a identificar al comprador
              y no se puede aplicar a pedidos creados desde el admin.
            </span>
          </span>
        </label>
      </Seccion>

      {/* ------------------------------------------------------------------ */}
      <Seccion
        titulo="Tus códigos"
        descripcion="Cada código tiene un enlace que ya lo aplica, para que el creador lo pegue en su bio. Retirar un código lo desactiva en tu tienda; las ventas que ya trajo se conservan."
      >
        {!datos.attributions.length ? (
          <p className="py-6 text-center text-[13.5px] text-ink/45">Todavía no has creado ninguno.</p>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {datos.attributions.map((a) => (
              <FilaCodigo
                key={a.id}
                a={a}
                host={datos.shop.storefrontHost}
                money={money}
                ocupado={ocupado === a.id}
                confirmando={confirmando === a.id}
                onConfirmar={setConfirmando}
                onRetirar={retirar}
                onDestino={destino}
              />
            ))}
          </div>
        )}
      </Seccion>

      {/* ------------------------------------------------------------------ */}
      <Seccion
        titulo="Conexión con Shopify"
        descripcion="Si algún aviso se cae, dejaríamos de contar ventas sin avisarte. Aquí se ve."
        aviso={
          caidos.length
            ? `Faltan ${caidos.length} avisos. Pulsa Reparar para volver a suscribirlos.`
            : undefined
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {datos.webhooks === null ? (
              <span className="text-[13px] text-ink/50">No se pudo consultar el estado ahora mismo.</span>
            ) : (
              datos.webhooks.map((w) => (
                <span
                  key={w.topic}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-semibold',
                    w.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
                  )}
                >
                  {w.activo ? <Check size={12} /> : <Unplug size={12} />}
                  {TEMAS[w.topic] || w.topic}
                </span>
              ))
            )}
          </div>
          <Boton onClick={reparar} loading={ocupado === 'webhooks'} className="bg-black/[0.06] text-ink hover:bg-black/10">
            <RefreshCw size={14} /> Reparar
          </Boton>
        </div>

        <dl className="mt-4 grid gap-x-8 gap-y-2 border-t border-black/[0.06] pt-4 text-[12.5px] sm:grid-cols-2">
          <div className="flex justify-between gap-4">
            <dt className="text-ink/45">Versión de la API</dt>
            <dd className="font-semibold tabular-nums">{datos.apiVersion}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink/45">Permisos</dt>
            <dd className="truncate font-semibold" title={datos.scopes || ''}>
              {datos.scopes || '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink/45">Instalada</dt>
            <dd className="font-semibold">
              {new Date(datos.installedAt).toLocaleDateString('es-ES')}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink/45">Acceso renovado hasta</dt>
            <dd className="font-semibold">
              {datos.tokenExpires
                ? new Date(datos.tokenExpires).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
                : '—'}
            </dd>
          </div>
        </dl>
      </Seccion>

      {/* ------------------------------------------------------------------ */}
      <Seccion titulo="Qué datos guardamos">
        <div className="flex gap-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <div className="space-y-2 text-[13px] leading-relaxed text-ink/65">
            <p>
              De tu tienda: el dominio, el nombre, el correo y las credenciales de acceso. De cada
              pedido con un código de Mikro: <strong>el importe, la moneda, la fecha y el código</strong>.
              Nada más.
            </p>
            <p>
              <strong>No pedimos ni guardamos datos de tus clientes.</strong> La app no solicita
              permiso sobre ellos, así que ni su nombre, ni su correo, ni su dirección llegan a
              Mikro en ningún momento.
            </p>
            <p className="text-ink/50">
              Al desinstalar, el acceso se revoca al instante y Shopify nos pide borrar los datos de
              tu tienda 48 horas después. Lo hacemos.{' '}
              <a
                href="https://mikro-marketplace.netlify.app/privacidad"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-brand-600 hover:underline"
              >
                Política de privacidad
              </a>
              .
            </p>
          </div>
        </div>
      </Seccion>
    </div>
  )
}
