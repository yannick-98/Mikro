import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  Check,
  Copy,
  ExternalLink,
  Heart,
  MapPin,
  MessageCircle,
  Quote,
  ShieldCheck,
  ShoppingBag,
  Star,
} from 'lucide-react'
import { api } from '../api/client'
import { Avatar, EmptyState, PlatformIcon, Spinner, useAsync } from '../components/ui'
import { formatEuro, formatFollowers, formatNumber } from '../lib/format'

/**
 * La carta de presentacion publica de un creador.
 *
 * Resuelve algo que esta escrito en la tesis del negocio: el micro-influencer
 * "no tiene forma de demostrar su valor mas alla de una captura de pantalla
 * de sus estadisticas". Esto es esa forma, y ademas es portatil: se pega en
 * una bio, lo abre cualquiera sin cuenta, y cada vez que un creador lo
 * comparte trae gente a Mikro sin que cueste un euro de captacion.
 *
 * Lo que se ensena es lo que el creador ya tiene en su ficha, mas sus
 * resultados reales. Las tarifas se incluyen a proposito: el motivo de existir
 * de esta pagina es que una marca pueda decidir sin escribir un DM a ciegas.
 */

function Metrica({ valor, etiqueta, sufijo, nota }) {
  return (
    <div>
      <p className="text-[24px] font-black leading-none tabular-nums sm:text-[30px]">
        {valor}
        {sufijo ? <span className="text-[16px] text-ink/40">{sufijo}</span> : null}
      </p>
      <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.08em] text-ink/40">
        {etiqueta}
      </p>
      {nota ? <p className="mt-0.5 text-[11.5px] text-ink/35">{nota}</p> : null}
    </div>
  )
}

function Publicacion({ p }) {
  const contenido = (
    <>
      {p.thumbnailUrl ? (
        <img
          src={p.thumbnailUrl}
          alt=""
          className="aspect-square w-full rounded-xl object-cover transition group-hover:opacity-90"
          loading="lazy"
        />
      ) : (
        <div className="aspect-square w-full rounded-xl bg-black/[0.04]" />
      )}
      <div className="mt-2 flex items-center gap-3 text-[12px] font-semibold text-ink/55">
        <span className="inline-flex items-center gap-1">
          <Heart size={11} /> {formatNumber(p.likes)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle size={11} /> {formatNumber(p.comments)}
        </span>
        {p.views ? <span className="ml-auto text-ink/35">{formatNumber(p.views)} vistas</span> : null}
      </div>
    </>
  )

  return p.permalink ? (
    <a href={p.permalink} target="_blank" rel="noreferrer" className="group block">
      {contenido}
    </a>
  ) : (
    <div>{contenido}</div>
  )
}

function Compartir({ handle }) {
  const [copiado, setCopiado] = useState(false)
  const url = `${window.location.origin}/kit/${handle}`

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 2000)
        } catch {
          // Sin portapapeles la dirección sigue en la barra del navegador.
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[12.5px] font-bold text-white transition hover:bg-white/20"
    >
      {copiado ? <Check size={13} /> : <Copy size={13} />}
      {copiado ? 'Copiado' : 'Copiar enlace'}
    </button>
  )
}

export default function MediaKit() {
  const { handle } = useParams()
  const { data, loading, error } = useAsync(() => api.mediaKit(handle), [handle])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner size={26} className="text-brand-600" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-5">
        <EmptyState
          icon={Quote}
          title="No encontramos este perfil"
          description="Puede que el enlace esté mal escrito o que el creador ya no esté en Mikro."
          action={
            <Link to="/rankings" className="btn-primary">
              Ver el ranking
            </Link>
          }
        />
      </div>
    )
  }

  const { creator: c, publicaciones, resultados, opiniones } = data
  const comprobado = c.metricsSource === 'CONNECTED'
  const tarifas = Object.entries(c.rates || {}).filter(([, v]) => v > 0)

  return (
    <div className="min-h-screen bg-canvas">
      {/* Cabecera. Oscura y a sangre: esto se abre desde una bio de
          Instagram, y lo primero que se ve tiene que parecer una presentación
          y no un panel de administración. */}
      <header className="bg-ink px-5 pb-12 pt-10 text-white sm:px-8">
        <div className="mx-auto flex max-w-[880px] flex-wrap items-start justify-between gap-4">
          <Link to="/" className="text-[18px] font-black tracking-[-0.045em]">
            mikro<span className="align-super text-[10px] text-brand-400">↗</span>
          </Link>
          <Compartir handle={c.handle} />
        </div>

        <div className="mx-auto mt-8 flex max-w-[880px] flex-wrap items-end gap-5">
          <Avatar src={c.avatarUrl} name={c.displayName} size={88} className="ring-4 ring-white/10" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[30px] font-black leading-none tracking-[-0.035em] sm:text-[36px]">
                {c.displayName}
              </h1>
              {comprobado ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11.5px] font-bold text-emerald-300">
                  <ShieldCheck size={12} /> Datos comprobados
                </span>
              ) : null}
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-white/60">
              <span>@{c.handle}</span>
              <span>· {c.category}</span>
              <span className="inline-flex items-center gap-1">
                · <MapPin size={12} /> {c.city}
              </span>
            </p>
            {c.headline ? (
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/80">{c.headline}</p>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-6 max-w-[880px] px-5 pb-16 sm:px-8">
        {/* Las cifras, lo primero. Es lo que una marca viene a mirar. */}
        <section className="card p-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Metrica valor={formatFollowers(c.totalFollowers)} etiqueta="Seguidores" />
            <Metrica valor={c.engagementRate} sufijo="%" etiqueta="Engagement" />
            <Metrica
              valor={c.postsPerWeek || '—'}
              etiqueta="Publica"
              sufijo={c.postsPerWeek ? ' / sem' : null}
              nota={c.postsPerWeek ? null : 'al conectar sus redes'}
            />
            <Metrica
              valor={resultados.valoracion ? resultados.valoracion.toFixed(1) : '—'}
              etiqueta="Valoración"
              nota={resultados.valoraciones ? `${resultados.valoraciones} opiniones` : 'sin opiniones aún'}
            />
          </div>

          <p
            className={clsx(
              'mt-5 flex gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed',
              comprobado ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900',
            )}
          >
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            {comprobado ? (
              <>
                Estas cifras las trae Mikro directamente de las plataformas, no las escribe el
                creador. El engagement está calculado sobre sus últimas publicaciones reales.
              </>
            ) : (
              <>
                Estas cifras las ha declarado el creador y todavía no están comprobadas contra sus
                plataformas.
              </>
            )}
          </p>
        </section>

        {/* Ventas: para un micro-influencer esto no es una métrica más, es el
            único argumento que convierte "tengo 20.000 seguidores" en "traigo
            clientes". Solo aparece si hay algo que enseñar. */}
        {resultados.ventas ? (
          <section className="card mt-4 flex flex-wrap items-center gap-x-8 gap-y-4 bg-brand-50/60 p-6">
            <ShoppingBag size={20} className="text-brand-600" />
            <Metrica valor={formatEuro(resultados.ventas)} etiqueta="Vendido con sus códigos" />
            <Metrica
              valor={formatNumber(resultados.pedidos)}
              etiqueta={resultados.pedidos === 1 ? 'Pedido' : 'Pedidos'}
            />
            {/* Un cero aqui, al lado de ventas reales, se lee como un
                suspenso cuando solo significa que aun no ha cerrado ninguna
                colaboracion dentro de Mikro. */}
            {resultados.colaboraciones > 0 ? (
              <Metrica
                valor={resultados.colaboraciones}
                etiqueta={resultados.colaboraciones === 1 ? 'Colaboración' : 'Colaboraciones'}
              />
            ) : null}
            <p className="w-full text-[12.5px] leading-relaxed text-ink/55">
              Ventas reales atribuidas a sus códigos de descuento en tiendas que miden con Mikro.
              Descontadas las devoluciones.
            </p>
          </section>
        ) : null}

        {c.socialAccounts?.length ? (
          <section className="card mt-4 p-6">
            <h2 className="text-[15px] font-extrabold tracking-tight">Dónde publica</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {c.socialAccounts.map((a) => (
                <a
                  key={a.platform}
                  href={a.url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-black/[0.07] p-3.5 transition hover:border-black/20"
                >
                  <PlatformIcon platform={a.platform} size={20} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold">@{a.handle}</span>
                    <span className="block text-[12px] text-ink/50">
                      {formatFollowers(a.followers)} · {a.engagement}%
                    </span>
                  </span>
                  {a.source === 'CONNECTED' ? (
                    <ShieldCheck size={14} className="shrink-0 text-emerald-600" />
                  ) : null}
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {publicaciones?.length ? (
          <section className="card mt-4 p-6">
            <h2 className="text-[15px] font-extrabold tracking-tight">Lo que mejor le funciona</h2>
            <p className="mt-1 text-[13px] text-ink/50">
              Sus publicaciones con más interacción, tal y como están en su perfil.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {publicaciones.map((p) => (
                <Publicacion key={p.permalink || p.thumbnailUrl} p={p} />
              ))}
            </div>
          </section>
        ) : c.portfolio?.length ? (
          <section className="card mt-4 p-6">
            <h2 className="text-[15px] font-extrabold tracking-tight">Su trabajo</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {c.portfolio.slice(0, 6).map((p) => (
                <img
                  key={p.id}
                  src={p.imageUrl}
                  alt={p.caption || ''}
                  className="aspect-square w-full rounded-xl object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          </section>
        ) : null}

        {opiniones?.length ? (
          <section className="card mt-4 p-6">
            <h2 className="text-[15px] font-extrabold tracking-tight">Lo que dicen las marcas</h2>
            <div className="mt-4 space-y-4">
              {opiniones.map((o, i) => (
                <blockquote key={i} className="border-l-2 border-brand-300 pl-4">
                  <div className="flex gap-0.5 text-amber-500">
                    {Array.from({ length: o.rating }, (_, j) => (
                      <Star key={j} size={12} fill="currentColor" />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/70">“{o.comment}”</p>
                </blockquote>
              ))}
            </div>
          </section>
        ) : null}

        {tarifas.length ? (
          <section className="card mt-4 p-6">
            <h2 className="text-[15px] font-extrabold tracking-tight">Sus tarifas</h2>
            <p className="mt-1 text-[13px] text-ink/50">
              Punto de partida. El precio final se acuerda en la propuesta.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {tarifas.map(([tipo, valor]) => (
                <div key={tipo} className="rounded-xl border border-black/[0.07] px-4 py-3">
                  <p className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink/40">
                    {tipo === 'ugc' ? 'UGC' : tipo}
                  </p>
                  <p className="mt-0.5 text-[17px] font-black tabular-nums">{formatEuro(valor)}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-5 rounded-2xl bg-ink p-7 text-center text-white">
          <p className="text-[18px] font-black tracking-tight">
            ¿Quieres trabajar con {c.displayName.split(' ')[0]}?
          </p>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-white/60">
            En Mikro acordáis el precio antes de empezar y el dinero queda retenido hasta que
            apruebas el contenido. Sin agencia y sin pagar por adelantado a un desconocido.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <Link to={`/creador/${c.handle}`} className="btn-primary !bg-white !text-ink">
              Ver su perfil completo
            </Link>
            <Link
              to="/registro?rol=empresa"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2.5 text-[13.5px] font-bold transition hover:bg-white/20"
            >
              Crear cuenta gratis <ExternalLink size={13} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
