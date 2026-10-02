import { Link } from 'react-router-dom'
import { Coins, FileCheck2, Megaphone, ShieldCheck, TrendingUp, Users2 } from 'lucide-react'
import { formatFollowers, formatNumber } from '../../lib/format'

const BENEFITS = [
  { icon: Coins, title: 'Desde 60 €', body: 'Una colaboración cuesta menos que dos días de anuncios.' },
  { icon: TrendingUp, title: 'Engagement real', body: 'Comunidades pequeñas y fieles, no audiencias infladas.' },
  { icon: ShieldCheck, title: 'Pago en garantía', body: 'El dinero no se mueve hasta que apruebas el contenido.' },
  { icon: FileCheck2, title: 'El contenido es tuyo', body: 'Reutilízalo en tus redes, tu web y tus anuncios.' },
]

const STEPS = [
  { icon: Megaphone, title: 'Publicas la campaña', body: 'Qué buscas, para cuándo y cuánto pagas. Gratis.' },
  { icon: Users2, title: 'Eliges entre quienes se postulan', body: 'Con sus métricas y su afinidad con tu brief delante.' },
  { icon: ShieldCheck, title: 'Pagas al aprobar', body: 'Depositas el importe y se libera cuando das el visto bueno.' },
]

/**
 * Cara trasera del panel.
 *
 * El reverso de un ranking es, literalmente, lo que hay detras de esos
 * numeros: lo que una marca compra cuando contrata a esa gente.
 */
export default function BrandsFace({ stats }) {
  return (
    <div className="w-full">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
          Para empresas
        </span>
        <h2 className="mt-2.5 text-[27px] font-black leading-tight tracking-[-0.04em] text-white sm:text-[33px]">
          Al otro lado del ranking está{' '}
          <span className="bg-gradient-to-r from-brand-400 to-violet-300 bg-clip-text text-transparent">tu campaña</span>
        </h2>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.12fr_1fr] lg:gap-8">
        <div className="grid gap-3.5 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 transition hover:border-white/15 hover:bg-white/[0.06]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
                <b.icon size={15} />
              </span>
              <p className="mt-3 text-[14px] font-extrabold text-white">{b.title}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-white/50">{b.body}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">Cómo funciona</p>
            <ol className="space-y-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/12 text-[11px] font-black text-white/60">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-[13px] font-extrabold text-white">{s.title}</span>
                    <span className="block text-[12px] leading-relaxed text-white/45">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Una pyme real contandolo pesa mas que cualquier adjetivo nuestro. */}
          <blockquote className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-brand-500/[0.09] to-transparent p-5">
            <p className="text-[14px] font-semibold leading-snug text-white/85">
              «Con 400 euros hicimos más ruido que con seis meses de anuncios.»
            </p>
            <footer className="mt-2.5 text-[12px] font-semibold text-white/40">
              Marina Solís · Panadería La Espiga, Valencia
            </footer>
          </blockquote>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-5 border-t border-white/[0.07] pt-4">
        {stats ? (
          <div className="flex gap-9 lg:gap-14">
            <div>
              <p className="text-[19px] font-black leading-none text-white">{formatNumber(stats.creators)}</p>
              <p className="mt-1 text-[11px] font-semibold text-white/40">creadores</p>
            </div>
            <div>
              <p className="text-[19px] font-black leading-none text-white">{formatFollowers(stats.totalReach)}</p>
              <p className="mt-1 text-[11px] font-semibold text-white/40">de alcance</p>
            </div>
            <div>
              <p className="text-[19px] font-black leading-none text-white">{stats.avgEngagement}%</p>
              <p className="mt-1 text-[11px] font-semibold text-white/40">engagement medio</p>
            </div>
            <div>
              <p className="text-[19px] font-black leading-none text-white">12%</p>
              <p className="mt-1 text-[11px] font-semibold text-white/40">comisión única</p>
            </div>
          </div>
        ) : (
          <span />
        )}

        <div className="flex flex-col items-start gap-1.5">
          <Link
            to="/registro?rol=empresa"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-6 py-3 text-[14.5px] font-black text-white transition hover:bg-brand-700"
          >
            Soy empresa
            <span aria-hidden="true">→</span>
          </Link>
          <p className="text-[11.5px] text-white/30">Publicar es gratis. Sin cuota ni permanencia.</p>
        </div>
      </div>
    </div>
  )
}
