import { useState } from 'react'
import { Check, MessageSquare, Receipt } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../store/auth'
import { Spinner } from './ui'

/**
 * Dos ajustes que no son glamurosos y quitan mucho dolor.
 *
 * **Avisos al movil.** Una pyme espanola no vive en el correo. El cuello de
 * botella no es que falten candidaturas, es que pasan dias hasta que alguien
 * las mira. La casilla viene desmarcada y se puede quitar: un canal personal
 * se quema en cuanto se usa para dar la lata, asi que solo avisamos de lo que
 * tiene dinero detras.
 *
 * **Datos fiscales.** Un creador que cobra es un autonomo que tiene que
 * emitir factura. Con estos tres campos se la generamos; sin ellos, se queda
 * haciendola a mano un domingo por la noche.
 */
export default function AvisosYFacturacion({ creator, onCreator, show }) {
  const { user, refresh } = useAuth()
  const esCreador = !!creator

  const [cuenta, setCuenta] = useState({
    phone: user?.phone || '',
    whatsappOptIn: !!user?.whatsappOptIn,
  })
  const [fiscal, setFiscal] = useState({
    taxId: creator?.taxId || '',
    billingAddress: creator?.billingAddress || '',
    irpfRate: creator?.irpfRate ?? 0,
  })
  const [guardando, setGuardando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    try {
      await api.updateAccount(cuenta)
      await refresh()
      if (esCreador) {
        const { creator: actualizado } = await api.updateCreator({
          taxId: fiscal.taxId.trim(),
          billingAddress: fiscal.billingAddress.trim(),
          irpfRate: Number(fiscal.irpfRate),
        })
        onCreator?.(actualizado)
      }
      show?.success('Guardado')
    } catch (err) {
      show?.error(err.details?.[0]?.message || err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="card space-y-6 p-6">
      <section>
        <h2 className="flex items-center gap-2 text-[16px] font-extrabold tracking-tight">
          <MessageSquare size={16} className="text-ink/35" /> Avisos al móvil
        </h2>
        <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-ink/55">
          Te avisamos por WhatsApp solo de lo que no puede esperar: una candidatura, una
          colaboración que avanza, un pago. Nada más, y puedes quitarlo cuando quieras.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Teléfono</label>
            <input
              type="tel"
              value={cuenta.phone}
              onChange={(e) => setCuenta({ ...cuenta, phone: e.target.value })}
              className="field"
              placeholder="600 123 456"
            />
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-black/[0.03] px-3.5 py-3">
              <input
                type="checkbox"
                checked={cuenta.whatsappOptIn}
                disabled={!cuenta.phone.trim()}
                onChange={(e) => setCuenta({ ...cuenta, whatsappOptIn: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-brand-600"
              />
              <span className="text-[13px] font-semibold leading-snug">
                Avisadme por WhatsApp
                <span className="block text-[12px] font-normal text-ink/45">
                  {cuenta.phone.trim() ? 'Puedes desactivarlo en cualquier momento.' : 'Pon antes un teléfono.'}
                </span>
              </span>
            </label>
          </div>
        </div>
      </section>

      {esCreador ? (
        <section className="border-t border-black/[0.06] pt-6">
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold tracking-tight">
            <Receipt size={16} className="text-ink/35" /> Para tus facturas
          </h2>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-ink/55">
            Con esto te generamos la factura de cada colaboración, con su IVA y su retención ya
            calculados. Solo lo ve la empresa con la que trabajas: no aparece en tu perfil público.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">NIF</label>
              <input
                value={fiscal.taxId}
                onChange={(e) => setFiscal({ ...fiscal, taxId: e.target.value })}
                className="field"
                placeholder="12345678Z"
              />
            </div>
            <div>
              <label className="label">Retención de IRPF</label>
              <select
                value={fiscal.irpfRate}
                onChange={(e) => setFiscal({ ...fiscal, irpfRate: e.target.value })}
                className="field"
              >
                <option value={0}>Sin retención</option>
                <option value={7}>7% — primeros tres años de actividad</option>
                <option value={15}>15% — lo habitual</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="label">Domicilio fiscal</label>
            <input
              value={fiscal.billingAddress}
              onChange={(e) => setFiscal({ ...fiscal, billingAddress: e.target.value })}
              className="field"
              placeholder="C/ Ejemplo 12, 46001 Valencia"
            />
          </div>

          <p className="mt-3 text-[12px] leading-relaxed text-ink/40">
            Te damos el documento con los importes bien calculados. No sustituye a tu asesoría ni
            lleva tu libro de facturas emitidas.
          </p>
        </section>
      ) : null}

      <button type="submit" disabled={guardando} className="btn-primary">
        {guardando ? <Spinner size={15} /> : <Check size={15} />} Guardar
      </button>
    </form>
  )
}
