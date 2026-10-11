import { useState } from 'react'
import clsx from 'clsx'
import { AlertTriangle, Download, ExternalLink, FileText, History } from 'lucide-react'
import { api } from '../api/client'
import { Spinner } from './ui'
import { formatEuro, formatRelative } from '../lib/format'

/**
 * Historial de entregas y facturas de una colaboracion.
 *
 * Las dos cosas van juntas porque pertenecen al mismo momento: el contenido se
 * entrega, se acepta y eso devenga la factura.
 *
 * El historial importa mas de lo que parece. El dinero retenido se libera
 * justo aqui, asi que la conversacion sobre si el contenido vale o no es
 * precisamente la que conviene tener por escrito y fechada. Antes solo habia
 * un enlace y un cambio de estado: si la empresa pedia un cambio, no quedaba
 * registro de que se pidio ni sobre que version.
 */

const ESTADOS = {
  PENDING: { texto: 'Pendiente de revisar', clase: 'bg-amber-50 text-amber-800' },
  CHANGES_REQUESTED: { texto: 'Cambios pedidos', clase: 'bg-rose-50 text-rose-700' },
  APPROVED: { texto: 'Aprobada', clase: 'bg-emerald-50 text-emerald-700' },
}

const TIPOS = {
  CREATOR_TO_BRAND: 'Del creador a la empresa',
  MIKRO_COMMISSION: 'De Mikro al creador, por la comisión',
}

/**
 * Descarga la factura como HTML imprimible.
 *
 * Se genera en el navegador a proposito: no hace falta un servicio de PDF
 * para un documento de doce lineas, y asi funciona sin conexion y sin
 * esperar. Imprimir a PDF lo hace cualquier navegador.
 */
function imprimir(f) {
  const euros = (n) => `${n.toFixed(2).replace('.', ',')} €`
  const fila = (etiqueta, valor, fuerte) =>
    `<tr><td>${etiqueta}</td><td style="text-align:right${fuerte ? ';font-weight:700' : ''}">${valor}</td></tr>`

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Factura ${f.number}</title>
<style>
 body{font:14px/1.6 system-ui,sans-serif;color:#15161a;max-width:720px;margin:40px auto;padding:0 24px}
 h1{font-size:22px;margin:0 0 4px} .gris{color:#6b6d76}
 .cab{display:flex;justify-content:space-between;gap:32px;margin:32px 0}
 table{width:100%;border-collapse:collapse;margin-top:24px}
 td{padding:7px 0;border-bottom:1px solid #ececed}
 .total td{border-top:2px solid #15161a;border-bottom:0;padding-top:12px;font-size:17px}
 .pie{margin-top:40px;font-size:12px;color:#8a8c94}
</style></head><body>
<h1>Factura ${f.number}</h1>
<p class="gris">Fecha de emisión: ${new Date(f.issuedAt).toLocaleDateString('es-ES')}</p>
<div class="cab">
 <div><strong>Emite</strong><br>${f.issuer.name}<br>${f.issuer.taxId || ''}<br>${f.issuer.address || ''}</div>
 <div><strong>Factura a</strong><br>${f.client.name}<br>${f.client.taxId || ''}<br>${f.client.address || ''}</div>
</div>
<table>
 ${fila(f.concept, euros(f.base))}
 ${fila(`IVA (${f.vatRate}%)`, euros(f.vat))}
 ${f.irpfRate ? fila(`Retención IRPF (${f.irpfRate}%)`, `−${euros(f.irpf)}`) : ''}
 <tr class="total">${`<td>Total</td><td style="text-align:right;font-weight:800">${euros(f.total)}</td>`}</tr>
</table>
<p class="pie">Documento generado por Mikro a partir de los datos de la colaboración.</p>
</body></html>`

  const v = window.open('', '_blank')
  if (!v) return false
  v.document.write(html)
  v.document.close()
  return true
}

function Entrega({ s }) {
  const estado = ESTADOS[s.status] || ESTADOS.PENDING
  return (
    <li className="border-l-2 border-black/[0.08] pl-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-extrabold">Versión {s.version}</span>
        <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-bold', estado.clase)}>
          {estado.texto}
        </span>
        <span className="text-[11.5px] text-ink/40">{formatRelative(s.createdAt)}</span>
        <a
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-[12px] font-bold text-brand-600 hover:underline"
        >
          Ver <ExternalLink size={11} />
        </a>
      </div>
      {s.note ? <p className="mt-1 text-[12.5px] text-ink/55">{s.note}</p> : null}
      {s.feedback ? (
        <p className="mt-1.5 rounded-lg bg-rose-50/70 px-2.5 py-1.5 text-[12.5px] leading-relaxed text-rose-900">
          <strong>La empresa pidió:</strong> {s.feedback}
        </p>
      ) : null}
    </li>
  )
}

export default function EntregasYFacturas({ deal, role, onCambio, show }) {
  const [emitiendo, setEmitiendo] = useState(false)
  const submissions = deal.submissions || []
  const invoices = deal.invoices || []
  const puedeFacturar = ['APPROVED', 'PAID'].includes(deal.status)

  async function emitir() {
    setEmitiendo(true)
    try {
      await api.issueInvoices(deal.id)
      show?.success('Facturas emitidas')
      onCambio?.()
    } catch (e) {
      show?.error(e.message)
    } finally {
      setEmitiendo(false)
    }
  }

  if (!submissions.length && !puedeFacturar) return null

  return (
    <div className="space-y-5">
      {submissions.length ? (
        <section>
          <h4 className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-ink/40">
            <History size={13} /> Entregas
          </h4>
          <ul className="mt-3 space-y-3">
            {submissions.map((s) => (
              <Entrega key={s.id} s={s} />
            ))}
          </ul>
        </section>
      ) : null}

      {puedeFacturar ? (
        <section>
          <h4 className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-ink/40">
            <FileText size={13} /> Facturas
          </h4>

          {invoices.length ? (
            <ul className="mt-3 space-y-2">
              {invoices.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-black/[0.07] px-3.5 py-2.5"
                >
                  <span className="font-mono text-[12.5px] font-bold">{f.number}</span>
                  <span className="text-[12px] text-ink/50">{TIPOS[f.kind]}</span>
                  <span className="ml-auto text-[13px] font-black tabular-nums">
                    {formatEuro(f.total, { decimals: 2 })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!imprimir(f)) show?.error('El navegador ha bloqueado la ventana de la factura')
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-black/[0.05] px-2.5 py-1.5 text-[12px] font-bold text-ink/70 transition hover:bg-black/10"
                  >
                    <Download size={12} /> Descargar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 rounded-xl bg-amber-50 px-3.5 py-3">
              <p className="flex gap-2 text-[12.5px] leading-relaxed text-amber-900">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Todavía no hay facturas. Suele ser porque faltaba el NIF o el domicilio en el perfil
                cuando se aprobó el contenido. Complétalo y vuelve a intentarlo.
              </p>
              <button
                type="button"
                onClick={emitir}
                disabled={emitiendo}
                className="btn-ghost mt-2 !px-3 !py-1.5 !text-[12px]"
              >
                {emitiendo ? <Spinner size={12} /> : <FileText size={12} />} Emitir facturas
              </button>
            </div>
          )}

          <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink/40">
            {role === 'CREATOR'
              ? 'La factura al cliente la emites tú como autónomo: aquí tienes el documento con los importes ya calculados. No sustituye a tu asesoría ni lleva tu libro de facturas emitidas.'
              : 'Guarda estos documentos para tu contabilidad. Los importes salen de la colaboración, con el IVA y la retención que corresponda.'}
          </p>
        </section>
      ) : null}
    </div>
  )
}
