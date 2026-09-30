import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Check, CreditCard, LineChart, Search, ShieldCheck, Sparkles, Users } from 'lucide-react'
import Layout from '../components/Layout'
import { api } from '../api/client'
import { CreatorCard } from '../components/CreatorRow'
import { useAsync } from '../components/ui'
import { formatNumber } from '../lib/format'

const STEPS = [
  {
    icon: Search,
    title: 'Describe lo que necesitas',
    body: 'Escribe tu campana en una frase o usa los filtros: nicho, ciudad, tamano de audiencia, engagement minimo y presupuesto.',
  },
  {
    icon: Users,
    title: 'Elige entre los perfiles que encajan',
    body: 'Te ordenamos los creadores por afinidad real con tu brief, con sus metricas y su historial de colaboraciones a la vista.',
  },
  {
    icon: ShieldCheck,
    title: 'Depositas el importe en garantia',
    body: 'El dinero queda retenido en Mikro. El creador sabe que va a cobrar y tu no pagas hasta aprobar el contenido.',
  },
  {
    icon: LineChart,
    title: 'Recibes el contenido y mides',
    body: 'Apruebas la pieza, se libera el pago y te quedas con el material para tus propios canales.',
  },
]

const REASONS = [
  {
    title: 'Micro, no macro',
    body: 'Un perfil de 20K con comunidad local convierte mejor para una pyme que uno de 500K con audiencia dispersa. Y cuesta veinte veces menos.',
  },
  {
    title: 'Precio de pyme',
    body: 'Colaboraciones desde 60 EUR. Sin cuota de alta, sin permanencia y sin agencia cobrando un 30% por hacer de intermediaria.',
  },
  {
    title: 'Sin riesgo',
    body: 'Si el creador no entrega, recuperas tu dinero. Si entrega, pagas contento. El escrow protege a las dos partes.',
  },
  {
    title: 'Contenido que reutilizas',
    body: 'El material producido es tuyo para redes, web o anuncios. Muchas pymes contratan solo por el UGC.',
  },
]

const PLANS = [
  {
    name: 'Gratis',
    price: '0 EUR',
    note: 'para siempre',
    features: [
      'Campanas ilimitadas',
      'Busqueda y filtros completos',
      'Pagos en garantia',
      'Comision del 12% por colaboracion',
    ],
    cta: 'Empezar gratis',
    to: '/registro?rol=empresa',
  },
  {
    name: 'Pro',
    price: '39 EUR',
    note: 'al mes',
    highlight: true,
    features: [
      'Todo lo del plan gratis',
      'Comision reducida al 8%',
      'Busqueda con IA ilimitada',
      'Informes de resultados por campana',
      'Invitaciones masivas a creadores',
      'Soporte prioritario',
    ],
    cta: 'Probar Pro 14 dias',
    to: '/registro?rol=empresa',
  },
  {
    name: 'Agencia',
    price: 'A medida',
    note: 'desde 149 EUR/mes',
    features: [
      'Varias marcas en una cuenta',
      'Comision del 6%',
      'Gestor de cuenta dedicado',
      'Facturacion agrupada',
    ],
    cta: 'Hablar con ventas',
    to: '/recursos#contacto',
  },
]

export default function ForBusiness() {
  const { data: stats } = useAsync(() => api.homeStats(), [])
  const { data: top } = useAsync(() => api.creators({ pageSize: 3, sort: 'engagement' }), [])

  return (
    <Layout>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(820px_460px_at_80%_-10%,rgba(37,99,235,0.45),transparent_62%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(560px_360px_at_5%_110%,rgba(16,185,129,0.2),transparent_60%)]" />
        </div>
        <div className="relative mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-white/45">Para empresas</p>
          <h1 className="mt-4 max-w-3xl text-[40px] font-black leading-[1.04] tracking-[-0.035em] sm:text-[54px]">
            Publicidad que se nota,
            <br />a <span className="text-brand-500">precio de pyme.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/60">
            Contrata micro-influencers de tu ciudad y tu sector sin pasar por una agencia. Tu decides el presupuesto,
            nosotros ponemos el catalogo, el match y la seguridad en el pago.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/registro?rol=empresa" className="btn-primary !px-6 !py-3.5 !text-[15px]">
              Publicar mi primera campana
              <ArrowRight size={17} />
            </Link>
            <Link to="/" className="btn !border !border-white/20 !px-6 !py-3.5 !text-[15px] text-white hover:bg-white/10">
              Ver creadores
            </Link>
          </div>

          <div className="mt-14 grid max-w-2xl grid-cols-3 gap-8 border-t border-white/10 pt-8">
            <div>
              <p className="text-[30px] font-black leading-none">{formatNumber(stats?.creators || 0)}</p>
              <p className="mt-1.5 text-[12.5px] font-semibold text-white/45">creadores verificables</p>
            </div>
            <div>
              <p className="text-[30px] font-black leading-none">60 EUR</p>
              <p className="mt-1.5 text-[12.5px] font-semibold text-white/45">colaboracion mas barata</p>
            </div>
            <div>
              <p className="text-[30px] font-black leading-none">24h</p>
              <p className="mt-1.5 text-[12.5px] font-semibold text-white/45">primeras candidaturas</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-[30px] font-black tracking-tight">Como funciona</h2>
        <p className="mt-2 max-w-xl text-[15px] text-ink/55">De la idea al contenido publicado en cuatro pasos.</p>

        <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card p-6">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <s.icon size={19} />
                </div>
                <span className="text-[30px] font-black leading-none text-black/[0.07]">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-[15.5px] font-extrabold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink/55">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-black/[0.06] bg-white py-16">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <h2 className="text-[30px] font-black leading-tight tracking-tight">
                Por que micro-influencers y no una campana de anuncios
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ink/60">
                Con el presupuesto de dos semanas de anuncios tienes cinco creadores hablando de ti a una comunidad que
                les hace caso. Y te quedas con el contenido.
              </p>
              <Link to="/registro?rol=empresa" className="btn-dark mt-7">
                Crear cuenta de empresa
                <ArrowRight size={15} />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {REASONS.map((r) => (
                <div key={r.title} className="rounded-2xl border border-black/[0.06] p-5">
                  <BadgeCheck size={18} className="text-brand-600" />
                  <h3 className="mt-3 text-[14.5px] font-extrabold tracking-tight">{r.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink/55">{r.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[30px] font-black tracking-tight">Precios claros</h2>
            <p className="mt-2 text-[15px] text-ink/55">Sin alta, sin permanencia. Solo pagas cuando colaboras.</p>
          </div>
          <p className="rounded-xl bg-emerald-50 px-3.5 py-2 text-[13px] font-bold text-emerald-700">
            El importe del creador lo fijas tu en cada campana
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={
                p.highlight
                  ? 'relative rounded-2xl border-2 border-ink bg-ink p-6 text-white shadow-pop'
                  : 'card p-6'
              }
            >
              {p.highlight ? (
                <span className="absolute -top-3 left-6 rounded-lg bg-brand-600 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide">
                  Mas elegido
                </span>
              ) : null}
              <p className={p.highlight ? 'text-[13px] font-bold text-white/60' : 'text-[13px] font-bold text-ink/50'}>{p.name}</p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-[32px] font-black leading-none tracking-tight">{p.price}</span>
                <span className={p.highlight ? 'text-[13px] text-white/50' : 'text-[13px] text-ink/45'}>{p.note}</span>
              </div>
              <ul className="mt-5 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className={`flex items-start gap-2.5 text-[13.5px] ${p.highlight ? 'text-white/75' : 'text-ink/65'}`}>
                    <Check size={15} className={p.highlight ? 'mt-0.5 shrink-0 text-brand-400' : 'mt-0.5 shrink-0 text-brand-600'} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={p.to}
                className={
                  p.highlight
                    ? 'mt-6 flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-[14px] font-bold text-ink transition hover:bg-white/90'
                    : 'btn-ghost mt-6 w-full !py-3'
                }
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-white p-5">
          <CreditCard size={19} className="mt-0.5 shrink-0 text-ink/40" />
          <p className="text-[13.5px] leading-relaxed text-ink/60">
            <span className="font-bold text-ink">Como se cobra:</span> depositas el importe acordado al aceptar la
            colaboracion. Mikro lo retiene hasta que apruebas el contenido; entonces se abona al creador menos la
            comision. Si cancelas antes de la entrega, se devuelve integro.
          </p>
        </div>
      </section>

      {top?.items?.length ? (
        <section className="border-t border-black/[0.06] bg-white py-16">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-[26px] font-black tracking-tight">Creadores con mejor engagement</h2>
              <Link to="/" className="text-[14px] font-bold text-brand-600 hover:text-brand-700">
                Ver todos →
              </Link>
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {top.items.map((c) => (
                <CreatorCard key={c.id} creator={c} showSave={false} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-8 py-14 text-center text-white sm:px-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_50%_0%,rgba(37,99,235,0.5),transparent_65%)]" />
          <div className="relative">
            <Sparkles size={26} className="mx-auto text-brand-400" />
            <h2 className="mt-5 text-[32px] font-black leading-tight tracking-tight sm:text-[38px]">
              Tu primera campana, hoy mismo
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[15.5px] leading-relaxed text-white/60">
              Publicar es gratis. Recibes candidaturas de creadores en menos de 24 horas y decides con calma.
            </p>
            <Link to="/registro?rol=empresa" className="btn-primary mx-auto mt-8 !px-7 !py-3.5 !text-[15px]">
              Empezar gratis
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  )
}
