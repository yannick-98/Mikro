import { Link } from 'react-router-dom'
import { Coins, FileCheck2, ShieldCheck, TrendingUp } from 'lucide-react'
import { formatFollowers, formatNumber } from '../../lib/format'

const BENEFITS = [
  {
    icon: Coins,
    title: 'Desde 60 €',
    body: 'Una colaboración cuesta menos que dos días de anuncios.',
  },
  {
    icon: TrendingUp,
    title: 'Engagement real',
    body: 'Comunidades pequeñas y fieles, no audiencias infladas.',
  },
  {
    icon: ShieldCheck,
    title: 'Pago en garantía',
    body: 'El dinero no se mueve hasta que apruebas el contenido.',
  },
  {
    icon: FileCheck2,
    title: 'El contenido es tuyo',
    body: 'Reutilízalo en tus redes, tu web y tus anuncios.',
  },
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
        <h2 className="mt-4 text-[32px] font-black leading-tight tracking-[-0.04em] text-white sm:text-[40px]">
          Al otro lado del ranking
          <br />
          está <span className="bg-gradient-to-r from-brand-400 to-violet-300 bg-clip-text text-transparent">tu campaña</span>
        </h2>
      </div>

      <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
        {BENEFITS.map((b) => (
          <div
            key={b.title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-300">
              <b.icon size={17} />
            </span>
            <p className="mt-3.5 text-[15px] font-extrabold text-white">{b.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-white/50">{b.body}</p>
          </div>
        ))}
      </div>

      {stats ? (
        <div className="mx-auto mt-8 flex max-w-2xl justify-center gap-10 border-t border-white/10 pt-6 text-center">
          <div>
            <p className="text-[22px] font-black text-white">{formatNumber(stats.creators)}</p>
            <p className="text-[11.5px] font-semibold text-white/40">creadores</p>
          </div>
          <div>
            <p className="text-[22px] font-black text-white">{formatFollowers(stats.totalReach)}</p>
            <p className="text-[11.5px] font-semibold text-white/40">de alcance</p>
          </div>
          <div>
            <p className="text-[22px] font-black text-white">{stats.avgEngagement}%</p>
            <p className="text-[11.5px] font-semibold text-white/40">engagement medio</p>
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          to="/registro?rol=empresa"
          className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-7 py-3.5 text-[15px] font-black text-white transition hover:bg-brand-700"
        >
          Soy empresa
          <span aria-hidden="true">→</span>
        </Link>
        <p className="text-[12.5px] text-white/35">Publicar una campaña es gratis. Sin cuota ni permanencia.</p>
      </div>
    </div>
  )
}
