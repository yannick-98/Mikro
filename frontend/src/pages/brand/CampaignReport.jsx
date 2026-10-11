import { Link, useParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  Heart,
  Info,
  MessageCircle,
  ShoppingBag,
  Users,
} from 'lucide-react'
import { api } from '../../api/client'
import { DashboardShell } from '../../components/Dashboard'
import { Avatar, EmptyState, Spinner, useAsync } from '../../components/ui'
import { formatEuro, formatFollowers, formatMoney, formatNumber } from '../../lib/format'
import { BRAND_NAV } from './nav'

/**
 * Que paso con la campana.
 *
 * Hasta ahora una pyme pagaba 250 EUR, recibia un reel y no sabia nada mas.
 * Esta pagina contesta esa pregunta, y por eso es la que hace que alguien
 * repita: nadie vuelve a gastar en algo que no puede mirar.
 *
 * Regla de la pantalla: **un hueco nunca se pinta como un cero**. Si una
 * publicacion no tiene cifras es porque su creador no ha conectado la cuenta,
 * y eso se dice; si no hay ventas es porque no hay tienda conectada, y eso
 * tambien. Un informe que rellena huecos con suposiciones no sirve para
 * decidir.
 */

function Cifra({ icono: Icono, label, valor, sub, tono }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.1em] text-ink/40">
        {Icono ? <Icono size={13} /> : null}
        {label}
      </div>
      <p className={clsx('mt-2 text-[26px] font-black leading-none tabular-nums', tono)}>
        {valor ?? '—'}
      </p>
      {sub ? <p className="mt-1.5 text-[12.5px] text-ink/45">{sub}</p> : null}
    </div>
  )
}

function Participacion({ p, moneda }) {
  const c = p.contenido
  return (
    <article className="flex flex-wrap items-start gap-4 border-t border-black/[0.05] py-4 first:border-0 first:pt-0">
      {c?.thumbnailUrl ? (
        <img
          src={c.thumbnailUrl}
          alt=""
          className="h-16 w-16 shrink-0 rounded-xl object-cover"
          loading="lazy"
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Avatar src={p.creator?.avatarUrl} name={p.creator?.displayName} size={22} />
          <Link
            to={`/creador/${p.creator?.handle}`}
            className="text-[14px] font-extrabold tracking-tight hover:underline"
          >
            {p.creator?.displayName || 'Sin creador'}
          </Link>
          <span className="text-[12.5px] text-ink/45">
            {formatFollowers(p.creator?.followers || 0)} seguidores
          </span>
          {p.creator?.metricsSource === 'CONNECTED' ? (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
              comprobado
            </span>
          ) : null}
          <span className="ml-auto text-[13px] font-black tabular-nums">{formatEuro(p.coste)}</span>
        </div>

        {c ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink/60">
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline"
            >
              Ver la publicación <ExternalLink size={11} />
            </a>
            {c.medido ? (
              <>
                <span className="inline-flex items-center gap-1">
                  <Heart size={12} /> {formatNumber(c.likes)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle size={12} /> {formatNumber(c.comments)}
                </span>
                {c.views ? (
                  <span className="inline-flex items-center gap-1">
                    <Eye size={12} /> {formatNumber(c.views)}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-ink/40">
                Sin cifras: este creador no tiene la cuenta conectada
              </span>
            )}
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] text-ink/40">Todavía no ha entregado contenido.</p>
        )}

        {p.ventas ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-[12.5px] font-bold text-brand-800">
            <ShoppingBag size={12} /> {p.ventas.pedidos} pedidos ·{' '}
            {formatMoney(p.ventas.neto, moneda)}
          </p>
        ) : null}
      </div>
    </article>
  )
}

export default function CampaignReport() {
  const { id } = useParams()
  const { data, loading, error } = useAsync(() => api.campaignReport(id), [id])

  if (loading) {
    return (
      <DashboardShell nav={BRAND_NAV} title="Informe">
        <div className="flex justify-center py-20">
          <Spinner size={24} className="text-brand-600" />
        </div>
      </DashboardShell>
    )
  }

  if (error || !data) {
    return (
      <DashboardShell nav={BRAND_NAV} title="Informe">
        <EmptyState
          icon={Info}
          title="No encontramos ese informe"
          description="La campaña no existe o no es de tu cuenta."
        />
      </DashboardShell>
    )
  }

  const { campaign, resumen, ventas, avisos, participaciones } = data
  const moneda = ventas?.moneda || 'EUR'

  return (
    <DashboardShell nav={BRAND_NAV} title={`Informe · ${campaign.title}`}>
      <Link
        to={`/empresa/campanas/${campaign.id}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink/50 hover:text-ink"
      >
        <ArrowLeft size={14} /> Volver a la campaña
      </Link>

      <header className="mt-3">
        <h1 className="text-[26px] font-black leading-tight tracking-[-0.03em]">{campaign.title}</h1>
        <p className="mt-1 text-[13.5px] text-ink/50">
          {resumen.creadores} {resumen.creadores === 1 ? 'creador' : 'creadores'} ·{' '}
          {resumen.candidaturas} candidaturas · {formatEuro(resumen.coste)} invertidos
        </p>
      </header>

      {/* Lo primero, lo que mide dinero. Si no hay tienda conectada esta fila
          no aparece: un retorno vacio no dice nada y confunde. */}
      {ventas ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <Cifra
            icono={ShoppingBag}
            label="Ventas atribuidas"
            valor={formatMoney(ventas.neto, moneda)}
            sub={
              ventas.devuelto
                ? `${formatMoney(ventas.bruto, moneda)} menos ${formatMoney(ventas.devuelto, moneda)} devueltos`
                : `${ventas.pedidos} pedidos`
            }
            tono="text-emerald-700"
          />
          <Cifra
            label="Por cada euro"
            valor={ventas.retorno != null ? `${ventas.retorno}×` : '—'}
            sub="vendido por euro invertido"
            tono={ventas.retorno >= 1 ? 'text-emerald-700' : undefined}
          />
          <Cifra label="Ticket medio" valor={formatMoney(ventas.ticketMedio || 0, moneda)} sub="por pedido" />
          <Cifra label="Coste" valor={formatEuro(resumen.coste)} sub={`${formatEuro(resumen.comision)} de comisión`} />
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Cifra
          icono={Users}
          label="Alcance potencial"
          valor={formatFollowers(resumen.alcancePotencial)}
          sub="suma de seguidores, no de personas alcanzadas"
        />
        <Cifra
          icono={Heart}
          label="Interacciones"
          valor={resumen.interacciones != null ? formatNumber(resumen.interacciones) : null}
          sub={
            resumen.contenidosMedidos
              ? `de ${resumen.contenidosMedidos} publicaciones medidas`
              : 'ninguna publicación medida todavía'
          }
        />
        <Cifra
          icono={Eye}
          label="Visualizaciones"
          valor={resumen.visualizaciones != null ? formatNumber(resumen.visualizaciones) : null}
          sub={resumen.costePorMil != null ? `${formatEuro(resumen.costePorMil)} por mil` : 'solo en vídeo'}
        />
        <Cifra
          label="Coste por interacción"
          valor={resumen.costePorInteraccion != null ? formatEuro(resumen.costePorInteraccion) : null}
          sub="lo que cuesta cada like o comentario"
        />
      </div>

      {avisos.length ? (
        <ul className="mt-4 space-y-2">
          {avisos.map((a) => (
            <li
              key={a.codigo}
              className="flex gap-2.5 rounded-xl border border-black/[0.06] bg-black/[0.02] px-4 py-3 text-[12.5px] leading-relaxed text-ink/60"
            >
              <Info size={14} className="mt-0.5 shrink-0 text-ink/35" />
              {a.texto}
            </li>
          ))}
        </ul>
      ) : null}

      <section className="card mt-5 p-6">
        <h2 className="text-[16px] font-extrabold tracking-tight">Quién participó</h2>
        {!participaciones.length ? (
          <p className="py-8 text-center text-[13.5px] text-ink/45">
            Todavía no hay ninguna colaboración cerrada en esta campaña.
          </p>
        ) : (
          <div className="mt-4">
            {participaciones.map((p) => (
              <Participacion key={p.dealId} p={p} moneda={moneda} />
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  )
}
