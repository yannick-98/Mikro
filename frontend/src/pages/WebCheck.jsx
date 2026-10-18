import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import {
  AlertTriangle, ArrowRight, Check, ChevronDown, Copy, Eye, Globe, Info, Search, X,
} from 'lucide-react'
import Layout from '../components/Layout'
import { Spinner } from '../components/ui'
import { api } from '../api/client'

/**
 * Diagnostico de la web de una empresa.
 *
 * Es publica y no pide cuenta: una pyme que no nos conoce escribe su
 * direccion y se lleva algo util antes de que le pidamos nada. De ahi sale la
 * conversacion que nos interesa, porque el informe termina contestando la
 * pregunta que de verdad nos incumbe: si su web aguanta el trafico que le
 * traeria un creador.
 *
 * Dos decisiones de pantalla que vienen del informe y no de la estetica:
 *
 *  - **Lo primero que se ve no es la nota, es el semaforo de campana.** La
 *    nota es un numero bonito; lo accionable es «esto lo arreglas antes de
 *    pagar a nadie».
 *  - **Un dato y una suposicion no se pintan igual.** Lo que no hemos podido
 *    comprobar tiene su propia caja, en gris, al final y con el motivo. No se
 *    esconde ni se mezcla con los fallos.
 *
 * La direccion viaja en la URL (?url=) a proposito: quien pide el informe casi
 * nunca es quien va a tocar la web, y lo primero que hace es reenviarlo.
 */

const SEMAFORO = {
  si: { fondo: 'bg-emerald-50 border-emerald-200', punto: 'bg-emerald-500', texto: 'text-emerald-900' },
  reparos: { fondo: 'bg-amber-50 border-amber-200', punto: 'bg-amber-500', texto: 'text-amber-900' },
  no: { fondo: 'bg-rose-50 border-rose-200', punto: 'bg-rose-500', texto: 'text-rose-900' },
}

const ESTADO = {
  ok: { Icono: Check, color: 'text-emerald-600', fondo: 'bg-emerald-50' },
  aviso: { Icono: AlertTriangle, color: 'text-amber-600', fondo: 'bg-amber-50' },
  fallo: { Icono: X, color: 'text-rose-600', fondo: 'bg-rose-50' },
  'no-comprobado': { Icono: Eye, color: 'text-ink/30', fondo: 'bg-black/[0.03]' },
  'no-aplica': { Icono: Eye, color: 'text-ink/30', fondo: 'bg-black/[0.03]' },
}

const ESFUERZO = {
  minutos: 'Cinco minutos',
  rato: 'Un rato',
  tarde: 'Una tarde',
  encargo: 'Para quien lleve la web',
}

const colorNota = (n) =>
  n >= 88 ? 'text-emerald-600' : n >= 74 ? 'text-brand-600' : n >= 58 ? 'text-amber-600' : 'text-rose-600'

/** La nota, grande y con su letra. Lo unico que se mira de lejos. */
function Nota({ nota }) {
  if (nota.total === null) return null
  return (
    <div className="flex items-baseline gap-2">
      <span className={clsx('text-[56px] font-black leading-none tabular-nums', colorNota(nota.total))}>
        {nota.total}
      </span>
      <span className="text-[15px] font-bold text-ink/35">/100</span>
      <span className={clsx('ml-1 rounded-lg px-2 py-0.5 text-[15px] font-black', colorNota(nota.total), 'bg-black/[0.04]')}>
        {nota.letra}
      </span>
    </div>
  )
}

/** Una comprobacion: lo que se ha mirado, la prueba y, si falla, qué hacer. */
function Comprobacion({ c }) {
  const { Icono, color, fondo } = ESTADO[c.estado] || ESTADO['no-comprobado']
  return (
    <li className="flex gap-3 py-3">
      <span className={clsx('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md', fondo)}>
        <Icono size={13} className={color} strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-ink/85">{c.titulo}</p>
        {c.dice && <p className="mt-0.5 text-[13px] leading-relaxed text-ink/60">{c.dice}</p>}
        {c.porque && <p className="mt-0.5 text-[13px] leading-relaxed text-ink/45">{c.porque}</p>}
        {c.dato && (
          <p className="mt-1 break-words rounded-md bg-black/[0.03] px-2 py-1 font-mono text-[11.5px] text-ink/55">
            {c.dato}
          </p>
        )}
        {c.arregla && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink/75">
            <span className="font-semibold">Qué hacer: </span>
            {c.arregla}
            {c.esfuerzo && <span className="text-ink/40"> · {ESFUERZO[c.esfuerzo] || c.esfuerzo}</span>}
          </p>
        )}
      </div>
    </li>
  )
}

/** Un area, plegada por defecto: el desglose es para quien lo pida. */
function Area({ area }) {
  const [abierta, setAbierta] = useState(false)
  return (
    <div className="border-b border-black/[0.07] last:border-0">
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        className="flex w-full items-center gap-3 py-3.5 text-left"
      >
        <span className={clsx('w-11 shrink-0 text-[17px] font-black tabular-nums', area.nota === null ? 'text-ink/25' : colorNota(area.nota))}>
          {area.nota === null ? '—' : area.nota}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-bold text-ink/85">{area.nombre}</span>
          <span className="block text-[12.5px] text-ink/45">
            {area.fallos > 0 && `${area.fallos} ${area.fallos === 1 ? 'fallo' : 'fallos'} · `}
            {area.avisos > 0 && `${area.avisos} ${area.avisos === 1 ? 'aviso' : 'avisos'} · `}
            {area.correctas} bien
            {area.sinMirar > 0 && ` · ${area.sinMirar} sin comprobar`}
          </span>
        </span>
        <ChevronDown size={16} className={clsx('shrink-0 text-ink/30 transition-transform', abierta && 'rotate-180')} />
      </button>
      {abierta && (
        <ul className="divide-y divide-black/[0.05] pb-3 pl-14">
          {area.comprobaciones.map((c) => (
            <Comprobacion key={c.id} c={c} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default function WebCheck() {
  const [params, setParams] = useSearchParams()
  const inicial = params.get('url') || ''
  const [valor, setValor] = useState(inicial)
  const [informe, setInforme] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const pedida = useRef(null)

  async function analizar(url) {
    if (!url.trim() || cargando) return
    setCargando(true)
    setError(null)
    setInforme(null)
    try {
      setInforme(await api.analizarWeb(url.trim()))
    } catch (e) {
      setError(e.message)
    } finally {
      setCargando(false)
    }
  }

  // Si se llega con ?url=, el informe sale solo: un enlace compartido tiene
  // que enseñar el informe, no un formulario que hay que volver a rellenar.
  useEffect(() => {
    if (inicial && pedida.current !== inicial) {
      pedida.current = inicial
      analizar(inicial)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial])

  function enviar(e) {
    e.preventDefault()
    const limpia = valor.trim()
    if (!limpia) return
    pedida.current = limpia
    setParams({ url: limpia })
    analizar(limpia)
  }

  function copiarEnlace() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  const sem = informe ? SEMAFORO[informe.campana.semaforo] || SEMAFORO.reparos : null

  return (
    <Layout>
      <section className="bg-ink px-5 pb-14 pt-16 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold uppercase tracking-[0.07em] text-white/70">
            <Globe size={13} /> Gratis y sin cuenta
          </span>
          <h1 className="mt-5 text-[34px] font-black leading-[1.1] sm:text-[44px]">
            ¿Tu web aguanta la visita de dos mil personas de golpe?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed text-white/60">
            Es lo que pasa cuando un creador habla de ti. Escribe tu dirección y te decimos qué se encontrarán,
            qué se te está escapando y qué arreglar antes de gastarte un euro en una campaña.
          </p>

          <form onSubmit={enviar} className="mx-auto mt-8 flex max-w-xl gap-2">
            <div className="relative flex-1">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="tupanaderia.es"
                inputMode="url"
                autoComplete="url"
                className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-10 pr-4 text-[15px] text-white placeholder:text-white/30 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={cargando || !valor.trim()}
              className="shrink-0 rounded-xl bg-brand-600 px-5 py-3 text-[14.5px] font-bold text-white transition hover:bg-brand-500 disabled:opacity-40"
            >
              {cargando ? <Spinner size={16} className="text-white" /> : 'Analizar'}
            </button>
          </form>
          <p className="mt-3 text-[12.5px] text-white/35">
            Leemos lo que tu servidor entrega, igual que lo haría Google. No tocamos nada.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-10">
        {cargando && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Spinner size={24} className="text-brand-600" />
            <p className="text-[14px] text-ink/50">Mirando tu web, tu robots.txt y cómo se comparte tu enlace…</p>
          </div>
        )}

        {error && !cargando && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4">
            <p className="text-[14px] font-semibold text-rose-900">{error}</p>
          </div>
        )}

        {informe && !cargando && (
          <div className="animate-fade-up space-y-8">
            {/* Lo primero: puedo lanzar una campaña o no. */}
            <div className={clsx('rounded-2xl border px-6 py-5', sem.fondo)}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.07em] text-ink/40">
                    <span className={clsx('h-2 w-2 rounded-full', sem.punto)} />
                    Para una campaña
                  </span>
                  <h2 className={clsx('mt-2 text-[21px] font-black leading-tight', sem.texto)}>
                    {informe.campana.titular}
                  </h2>
                  <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink/70">{informe.campana.texto}</p>
                </div>
                <Nota nota={informe.nota} />
              </div>
              {informe.nota.veredicto && (
                <p className="mt-4 border-t border-black/[0.07] pt-3 text-[13px] text-ink/55">
                  {informe.nota.veredicto}{' '}
                  <span className="text-ink/40">
                    {informe.resumen.fallos} fallos · {informe.resumen.avisos} avisos · {informe.resumen.correctas} correctas
                    {informe.resumen.sinMirar > 0 && ` · ${informe.resumen.sinMirar} sin comprobar`}
                  </span>
                </p>
              )}
            </div>

            {/* La ficha: qué hemos mirado exactamente. */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px] text-ink/45">
              <span className="font-mono text-ink/70">{informe.ficha.url}</span>
              {informe.ficha.plataforma && <span>Hecha con {informe.ficha.plataforma}</span>}
              {informe.ficha.servidor && <span>Servida por {informe.ficha.servidor}</span>}
              {informe.ficha.respuestaMs != null && <span>Contesta en {informe.ficha.respuestaMs} ms</span>}
              <button
                type="button"
                onClick={copiarEnlace}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-semibold text-brand-600 transition hover:bg-brand-50"
              >
                <Copy size={12} /> {copiado ? 'Enlace copiado' : 'Copiar enlace del informe'}
              </button>
            </div>

            {informe.prioridades.length > 0 && (
              <div>
                <h3 className="text-[18px] font-black">Lo primero que arreglaría</h3>
                <p className="mt-1 text-[13.5px] text-ink/50">
                  Por orden de lo que recupera cada arreglo, no por orden de gravedad.
                </p>
                <ol className="mt-4 space-y-3">
                  {informe.prioridades.map((p, i) => (
                    <li key={p.id} className="rounded-xl border border-black/[0.07] bg-white p-4 shadow-card">
                      <div className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-ink text-[12px] font-black text-white">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h4 className="text-[14.5px] font-bold">{p.titulo}</h4>
                            <span
                              className={clsx(
                                'rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide',
                                p.estado === 'fallo' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700',
                              )}
                            >
                              {p.estado === 'fallo' ? 'Fallo' : 'Mejorable'}
                            </span>
                            <span className="text-[11.5px] font-semibold text-ink/35">
                              {p.areaNombre} · +{p.impacto} puntos
                            </span>
                          </div>
                          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/70">{p.dice}</p>
                          {p.dato && (
                            <p className="mt-2 break-words rounded-md bg-black/[0.03] px-2 py-1 font-mono text-[11.5px] text-ink/55">
                              {p.dato}
                            </p>
                          )}
                          <p className="mt-2 text-[13.5px] leading-relaxed">
                            <span className="font-semibold">Qué hacer: </span>
                            {p.arregla}
                          </p>
                          <p className="mt-1 text-[12px] font-semibold text-ink/40">{ESFUERZO[p.esfuerzo] || p.esfuerzo}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {informe.areas.length > 0 && (
              <div>
                <h3 className="text-[18px] font-black">Todo lo que hemos mirado</h3>
                <div className="mt-2 rounded-xl border border-black/[0.07] bg-white px-5 shadow-card">
                  {informe.areas.map((a) => (
                    <Area key={a.id} area={a} />
                  ))}
                </div>
              </div>
            )}

            {informe.bienHecho.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-5 py-4">
                <h3 className="text-[14px] font-bold text-emerald-900">Esto ya está bien, no lo toques</h3>
                <ul className="mt-2 space-y-1">
                  {informe.bienHecho.map((c) => (
                    <li key={c.id} className="flex gap-2 text-[13px] text-ink/70">
                      <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3} />
                      <span>{c.titulo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {informe.sinMirar.length > 0 && (
              <div className="rounded-xl border border-black/[0.07] bg-black/[0.02] px-5 py-4">
                <h3 className="text-[14px] font-bold text-ink/70">Lo que no hemos podido mirar</h3>
                <p className="mt-1 text-[12.5px] text-ink/45">Nada de esto resta puntos: no lo hemos visto, así que no lo juzgamos.</p>
                <ul className="mt-2 space-y-1.5">
                  {informe.sinMirar.map((s) => (
                    <li key={s.id} className="text-[13px] text-ink/55">
                      <span className="font-semibold text-ink/70">{s.titulo}:</span> {s.porque}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2.5 rounded-xl border border-black/[0.07] px-5 py-4 text-[12.5px] leading-relaxed text-ink/50">
              <Info size={15} className="mt-0.5 shrink-0 text-ink/30" />
              <ul className="space-y-1">
                {informe.advertencias.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-ink px-6 py-7 text-white">
              <h3 className="text-[20px] font-black leading-tight">
                {informe.campana.semaforo === 'si'
                  ? 'Tu web está lista. Lo que le falta son visitas.'
                  : 'Cuando la web esté lista, lo siguiente es que entre alguien.'}
              </h3>
              <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-white/60">
                Mikro conecta pymes con micro-influencers de su ciudad y su nicho. Publicar una campaña es gratis
                y el dinero queda retenido hasta que apruebas el contenido.
              </p>
              <Link
                to="/registro"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-[14.5px] font-bold transition hover:bg-brand-500"
              >
                Publicar una campaña <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}

        {!informe && !cargando && !error && (
          <div className="rounded-xl border border-black/[0.07] bg-white px-6 py-6 shadow-card">
            <h2 className="text-[16px] font-black">Qué miramos</h2>
            <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {[
                ['Si convierte', 'Si se te puede llamar, reservar, comprar o escribir. Y si se ve un precio.'],
                ['Confianza y ley', 'El candado, el aviso legal, la privacidad y si pides permiso antes de rastrear.'],
                ['Cuánto tarda', 'Lo que tarda tu servidor y lo que estorba antes de pintar nada.'],
                ['En el móvil', 'Donde va a entrar nueve de cada diez visitas de una campaña.'],
                ['Lista para una campaña', 'Si tu enlace se comparte con imagen, si mides y si conservas las etiquetas.'],
                ['Que te encuentren', 'Si Google puede verte y qué entiende de ti.'],
              ].map(([t, d]) => (
                <div key={t}>
                  <p className="text-[13.5px] font-bold">{t}</p>
                  <p className="text-[13px] leading-relaxed text-ink/55">{d}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 border-t border-black/[0.07] pt-4 text-[12.5px] leading-relaxed text-ink/45">
              46 comprobaciones, cada una con la prueba delante. Lo que no podamos comprobar lo decimos y no cuenta
              para la nota.
            </p>
          </div>
        )}
      </section>
    </Layout>
  )
}
