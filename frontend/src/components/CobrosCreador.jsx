import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Check,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { api } from '../api/client'
import { Spinner } from './ui'

/**
 * Dónde cobra el creador.
 *
 * Sin esto no hay dinero que valga: una empresa puede pagar, pero si el
 * creador no tiene cuenta verificada no hay a dónde mandárselo. Por eso se
 * le avisa aquí y además se le bloquea a la empresa el pago de una
 * colaboración con alguien que no la tiene lista — enterarse después de
 * haber cobrado sería la peor forma de descubrirlo.
 *
 * El alta entera la hace Stripe en su propio formulario. Mikro no ve ni
 * guarda el DNI ni el IBAN de nadie, y eso se dice aquí porque es la
 * primera pregunta que se hace cualquiera al ver que le piden documentos.
 */
/** Una de las dos vías por las que puede llegarle el dinero. */
function Via({ activa, onClick, icono, titulo, detalle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-xl border p-3 text-left transition',
        activa
          ? 'border-brand-600 bg-brand-50/60 ring-1 ring-brand-600/20'
          : 'border-black/[0.08] hover:bg-black/[0.02]',
      )}
    >
      <span className="flex items-center gap-2 text-[13.5px] font-extrabold">
        <span className={activa ? 'text-brand-600' : 'text-ink/35'}>{icono}</span>
        {titulo}
        {activa ? <Check size={13} className="ml-auto text-brand-600" /> : null}
      </span>
      <span className="mt-1 block text-[12px] leading-relaxed text-ink/50">{detalle}</span>
    </button>
  )
}

export default function CobrosCreador({ show }) {
  const [estado, setEstado] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [via, setVia] = useState('STRIPE')
  const [correo, setCorreo] = useState('')
  const [params, setParams] = useSearchParams()

  const cargar = useCallback(async () => {
    try {
      const r = await api.miCuentaCobros()
      setEstado(r)
      setVia(r.paypal?.elegido ? 'PAYPAL' : 'STRIPE')
      setCorreo(r.paypal?.email || '')
    } catch (e) {
      show?.error(e.message)
    }
  }, [show])

  /**
   * Cambiar de vía se guarda al momento, sin botón de confirmar.
   *
   * Es una decisión reversible y de una sola pulsación; pedir además un
   * "guardar" es como se acaba con alguien que cree que ha elegido PayPal y
   * sigue cobrando por el banco.
   */
  const cambiarVia = async (nueva) => {
    if (nueva === via) return
    const anterior = via
    setVia(nueva)
    try {
      await api.updateCreator({ payoutMethod: nueva })
      await cargar()
    } catch (e) {
      setVia(anterior)
      show?.error(e.message)
    }
  }

  const guardarCorreo = async () => {
    setOcupado(true)
    try {
      await api.updateCreator({ paypalEmail: correo.trim(), payoutMethod: 'PAYPAL' })
      show?.success('Guardado. Tus pagos irán a ese PayPal.')
      await cargar()
    } catch (e) {
      show?.error(e.message)
    } finally {
      setOcupado(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [cargar])

  // Vuelta del formulario de Stripe. Se refresca en el momento porque el
  // creador está mirando la pantalla y el webhook tarda unos segundos.
  useEffect(() => {
    const vuelta = params.get('stripe')
    if (!vuelta) return
    params.delete('stripe')
    setParams(params, { replace: true })
    ;(async () => {
      try {
        setEstado(await api.refrescarCobros())
        if (vuelta === 'listo') show?.success('Cuenta de cobros actualizada')
      } catch {
        cargar()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ir = async (fn) => {
    setOcupado(true)
    try {
      const { url } = await fn()
      window.location.href = url
    } catch (e) {
      show?.error(e.message)
      setOcupado(false)
    }
  }

  const refrescar = async () => {
    setOcupado(true)
    try {
      setEstado(await api.refrescarCobros())
    } catch (e) {
      show?.error(e.message)
    } finally {
      setOcupado(false)
    }
  }

  if (!estado) {
    return (
      <section className="card flex justify-center p-10">
        <Spinner size={20} className="text-brand-600" />
      </section>
    )
  }

  // Sin pasarela en este entorno no se promete nada: se dice lo que hay.
  if (!estado.configurado) {
    return (
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-[16px] font-extrabold tracking-tight">
          <Banknote size={16} className="text-ink/35" /> Cobros
        </h2>
        <p className="mt-2 flex gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-[12.5px] leading-relaxed text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          En este entorno los pagos están en modo demostración: los importes se anotan pero no se
          mueve dinero de verdad. No hay nada que configurar todavía.
        </p>
      </section>
    )
  }

  const porPaypal = via === 'PAYPAL'
  const lista = porPaypal ? !!estado.paypal?.email : estado.puedeCobrar

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold tracking-tight">
            <Banknote size={16} className="text-ink/35" /> Dónde cobras
          </h2>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-ink/55">
            {porPaypal
              ? 'El dinero de tus colaboraciones va a tu cuenta de PayPal. Hasta que nos digas cuál, las empresas no pueden pagarte.'
              : 'El dinero de tus colaboraciones va a tu cuenta bancaria a través de Stripe. Hasta que esto esté verificado, las empresas no pueden pagarte.'}
          </p>
        </div>
        {lista ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[12px] font-bold text-emerald-800">
            <ShieldCheck size={13} /> Lista para cobrar
          </span>
        ) : null}
      </div>

      {/* Elegir via solo tiene sentido si hay dos. Con una, un selector de una
          opcion es ruido que hay que leer para descubrir que no decide nada. */}
      {estado.paypal?.disponible ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Via
            activa={!porPaypal}
            onClick={() => cambiarVia('STRIPE')}
            icono={<Banknote size={15} />}
            titulo="A mi cuenta bancaria"
            detalle="Llega en cuanto la empresa aprueba. Hay que verificar la cuenta una vez."
          />
          <Via
            activa={porPaypal}
            onClick={() => cambiarVia('PAYPAL')}
            icono={<Wallet size={15} />}
            titulo="A mi PayPal"
            detalle="Solo hace falta tu correo. Tarda unos días más: sale por lotes."
          />
        </div>
      ) : null}

      {porPaypal ? (
        <div className="mt-4">
          <label className="block text-[12px] font-bold uppercase tracking-[0.07em] text-ink/40">
            Tu correo de PayPal
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              className="field !mt-0 min-w-[240px] flex-1"
            />
            <button
              type="button"
              onClick={guardarCorreo}
              disabled={ocupado || !correo.trim() || correo === estado.paypal?.email}
              className="btn-primary"
            >
              {ocupado ? <Spinner size={14} /> : <Check size={14} />} Guardar
            </button>
          </div>

          <ul className="mt-4 space-y-1.5 text-[12px] leading-relaxed text-ink/45">
            <li className="flex gap-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
              Comprueba la dirección. El dinero va a quien tenga ese correo en PayPal, y si te
              equivocas no lo podemos recuperar nosotros.
            </li>
            <li className="flex gap-2">
              <Check size={13} className="mt-0.5 shrink-0 text-ink/25" />
              Los pagos por PayPal salen agrupados, no al instante: cuenta unos días desde que la
              empresa aprueba tu contenido. Por el banco es inmediato.
            </li>
            <li className="flex gap-2">
              <Check size={13} className="mt-0.5 shrink-0 text-ink/25" />
              Si no tienes cuenta de PayPal con ese correo, te llega un aviso para abrirla y
              tienes 30 días para reclamar el dinero.
            </li>
            <li className="flex gap-2">
              <Check size={13} className="mt-0.5 shrink-0 text-ink/25" />
              Cobras el 88% de lo acordado, igual que por el banco. Lo que cobra PayPal lo
              ponemos nosotros: a ti no se te descuenta nada más.
            </li>
          </ul>
        </div>
      ) : lista ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => ir(api.panelCobros)}
            disabled={ocupado}
            className="btn-ghost"
          >
            {ocupado ? <Spinner size={14} /> : <ArrowUpRight size={14} />} Ver mis cobros en Stripe
          </button>
          <button type="button" onClick={refrescar} disabled={ocupado} className="btn-ghost">
            <RefreshCw size={14} /> Comprobar estado
          </button>
        </div>
      ) : (
        <div className="mt-4">
          {estado.pendiente ? (
            <p className="mb-3 flex gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {estado.pendiente}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => ir(api.empezarAltaCobros)}
            disabled={ocupado}
            className="btn-primary"
          >
            {ocupado ? <Spinner size={14} /> : <Banknote size={14} />}
            {estado.estado === 'SIN_EMPEZAR' ? 'Configurar mis cobros' : 'Terminar el alta'}
          </button>

          {estado.estado !== 'SIN_EMPEZAR' ? (
            <button type="button" onClick={refrescar} disabled={ocupado} className="btn-ghost ml-2">
              <RefreshCw size={14} /> Ya lo he hecho
            </button>
          ) : null}
        </div>
      )}

      {porPaypal ? null : (
      <ul className="mt-4 space-y-1.5 text-[12px] leading-relaxed text-ink/45">
        <li className="flex gap-2">
          <Check size={13} className="mt-0.5 shrink-0 text-ink/25" />
          Te lo pide Stripe en su propio formulario: Mikro no ve ni guarda tu DNI ni tu IBAN.
        </li>
        <li className="flex gap-2">
          <Check size={13} className="mt-0.5 shrink-0 text-ink/25" />
          Son cinco minutos y hay que hacerlo una sola vez.
        </li>
        <li className="flex gap-2">
          <Check size={13} className="mt-0.5 shrink-0 text-ink/25" />
          Cobras el 88% de lo acordado. El 12% es la comisión de Mikro, y de ahí sale también lo
          que cobra la pasarela: a ti no se te descuenta nada más.
        </li>
      </ul>
      )}
    </section>
  )
}

/**
 * Aviso para la empresa cuando los pagos no son reales.
 *
 * Va donde se habla de dinero. Si no estuviera, la interfaz seguiría
 * diciendo "el pago queda retenido" sin que nada lo retenga, que es
 * exactamente lo que no puede pasar.
 */
export function AvisoPagosSimulados({ className }) {
  const [configurado, setConfigurado] = useState(null)

  useEffect(() => {
    let vivo = true
    api
      .stripeEstado()
      .then((r) => vivo && setConfigurado(r.configurado))
      .catch(() => vivo && setConfigurado(true)) // ante la duda, no alarmar
    return () => {
      vivo = false
    }
  }, [])

  if (configurado !== false) return null

  return (
    <p
      className={clsx(
        'flex gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-amber-900',
        className,
      )}
    >
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <span>
        <strong>Pagos en modo demostración.</strong> Los importes se anotan para que puedas probar
        el circuito, pero no se cobra ni se transfiere dinero de verdad.
      </span>
    </p>
  )
}
