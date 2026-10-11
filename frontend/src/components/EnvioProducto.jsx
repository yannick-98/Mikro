import { useState } from 'react'
import clsx from 'clsx'
import { Check, MapPin, Package, Truck } from 'lucide-react'
import { api } from '../api/client'
import { Spinner } from './ui'
import { formatRelative } from '../lib/format'

/**
 * El envío del producto al creador.
 *
 * Dos partes y las dos hacen falta, porque la discusión clásica es «yo lo
 * mandé» contra «no me ha llegado». Que cada lado marque la suya deja
 * constancia de quién dijo qué y cuándo, y evita que el creador aparezca
 * como que no entrega cuando lo que pasa es que no ha recibido nada.
 *
 * La dirección la escribe el creador aquí y no en su perfil: es su casa, y
 * solo tiene que verla la empresa con la que ya ha cerrado un trato que
 * exige mandarle algo.
 */

const PASOS = [
  { id: 'PENDING', texto: 'Falta la dirección' },
  { id: 'SENT', texto: 'Enviado' },
  { id: 'RECEIVED', texto: 'Recibido' },
]

function Linea({ estado }) {
  const i = PASOS.findIndex((p) => p.id === estado)
  return (
    <div className="flex items-center gap-1.5">
      {PASOS.map((p, idx) => (
        <span key={p.id} className="flex items-center gap-1.5">
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 text-[11.5px] font-bold',
              idx < i
                ? 'bg-emerald-50 text-emerald-700'
                : idx === i
                  ? 'bg-ink text-white'
                  : 'bg-black/[0.05] text-ink/40',
            )}
          >
            {p.texto}
          </span>
          {idx < PASOS.length - 1 ? <span className="text-ink/20">›</span> : null}
        </span>
      ))}
    </div>
  )
}

export default function EnvioProducto({ deal, role, onCambio, show }) {
  const envio = deal.envio
  const [guardando, setGuardando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [dir, setDir] = useState({
    shippingName: envio?.nombre || '',
    shippingAddress: envio?.direccion || '',
    shippingPhone: envio?.telefono || '',
  })
  const [envioForm, setEnvioForm] = useState({ carrier: '', trackingCode: '', shipmentNote: '' })

  if (!envio || envio.estado === 'NONE') return null

  const esCreador = role === 'CREATOR'
  const hayDireccion = !!envio.direccion

  async function llamar(fn, exito) {
    setGuardando(true)
    try {
      await fn()
      show?.success(exito)
      onCambio?.()
      setEditando(false)
    } catch (e) {
      show?.error(e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="rounded-xl border border-black/[0.07] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-ink/40">
          <Package size={13} /> Envío del producto
        </h4>
        <Linea estado={envio.estado} />
      </div>

      {/* --- La dirección --- */}
      {hayDireccion && !editando ? (
        <div className="mt-3 flex flex-wrap items-start gap-2 text-[12.5px] text-ink/65">
          <MapPin size={13} className="mt-0.5 shrink-0 text-ink/30" />
          <span className="min-w-0">
            <strong>{envio.nombre}</strong> — {envio.direccion}
            {envio.telefono ? ` · ${envio.telefono}` : ''}
          </span>
          {esCreador && envio.estado !== 'RECEIVED' ? (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="ml-auto text-[12px] font-bold text-brand-600 hover:underline"
            >
              Cambiar
            </button>
          ) : null}
        </div>
      ) : esCreador ? (
        <form
          className="mt-3 space-y-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            llamar(() => api.setShipping(deal.id, dir), 'Dirección enviada a la empresa')
          }}
        >
          <p className="text-[12.5px] leading-relaxed text-ink/55">
            Dinos dónde mandarte el producto. Solo lo verá esta empresa, y solo mientras dure la
            colaboración: no se guarda en tu perfil público.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              required
              value={dir.shippingName}
              onChange={(e) => setDir({ ...dir, shippingName: e.target.value })}
              className="field !mt-0"
              placeholder="Nombre y apellidos"
            />
            <input
              value={dir.shippingPhone}
              onChange={(e) => setDir({ ...dir, shippingPhone: e.target.value })}
              className="field !mt-0"
              placeholder="Teléfono (para el repartidor)"
            />
          </div>
          <input
            required
            value={dir.shippingAddress}
            onChange={(e) => setDir({ ...dir, shippingAddress: e.target.value })}
            className="field !mt-0"
            placeholder="Calle, número, piso, código postal y ciudad"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={guardando} className="btn-primary !px-3.5 !py-2 !text-[12.5px]">
              {guardando ? <Spinner size={13} /> : <Check size={13} />} Guardar dirección
            </button>
            {editando ? (
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="btn-ghost !px-3.5 !py-2 !text-[12.5px]"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="mt-3 text-[12.5px] text-ink/45">
          Esperando a que el creador indique su dirección. Le hemos avisado.
        </p>
      )}

      {/* --- Marcar enviado (empresa) --- */}
      {!esCreador && hayDireccion && envio.estado === 'PENDING' ? (
        <form
          className="mt-3 space-y-2.5 border-t border-black/[0.06] pt-3"
          onSubmit={(e) => {
            e.preventDefault()
            llamar(() => api.markShipped(deal.id, envioForm), 'Envío marcado. El creador ya lo sabe.')
          }}
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              value={envioForm.carrier}
              onChange={(e) => setEnvioForm({ ...envioForm, carrier: e.target.value })}
              className="field !mt-0"
              placeholder="Transportista (Correos, SEUR…)"
            />
            <input
              value={envioForm.trackingCode}
              onChange={(e) => setEnvioForm({ ...envioForm, trackingCode: e.target.value })}
              className="field !mt-0"
              placeholder="Número de seguimiento"
            />
          </div>
          <button type="submit" disabled={guardando} className="btn-primary !px-3.5 !py-2 !text-[12.5px]">
            {guardando ? <Spinner size={13} /> : <Truck size={13} />} Marcar como enviado
          </button>
        </form>
      ) : null}

      {/* --- Lo enviado --- */}
      {envio.enviadoEl ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-black/[0.06] pt-3 text-[12.5px] text-ink/60">
          <span className="inline-flex items-center gap-1.5">
            <Truck size={13} className="text-ink/30" /> Enviado {formatRelative(envio.enviadoEl)}
          </span>
          {envio.transportista ? <span>{envio.transportista}</span> : null}
          {envio.seguimiento ? (
            <span className="font-mono text-[12px] font-bold">{envio.seguimiento}</span>
          ) : null}
        </p>
      ) : null}

      {/* --- Confirmar recibido (creador) --- */}
      {esCreador && envio.estado === 'SENT' ? (
        <button
          type="button"
          disabled={guardando}
          onClick={() => llamar(() => api.markReceived(deal.id), 'Confirmado. Ya puedes ponerte.')}
          className="btn-primary mt-3 !px-3.5 !py-2 !text-[12.5px]"
        >
          {guardando ? <Spinner size={13} /> : <Check size={13} />} Lo he recibido
        </button>
      ) : null}

      {envio.estado === 'RECEIVED' ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold text-emerald-700">
          <Check size={13} /> Recibido {formatRelative(envio.recibidoEl)}
        </p>
      ) : null}
    </section>
  )
}
