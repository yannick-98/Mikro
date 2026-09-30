import { Link } from 'react-router-dom'
import { ArrowRight, Check, Coins, Eye, HandCoins, ShieldCheck, Star, TrendingUp } from 'lucide-react'
import Layout from '../components/Layout'
import { api } from '../api/client'
import { useAsync } from '../components/ui'
import { formatEuro, formatNumber } from '../lib/format'

const STEPS = [
  {
    icon: Eye,
    title: 'Crea tu perfil',
    body: 'Conecta Instagram, TikTok o YouTube, pon tus tarifas y sube cuatro trabajos. Diez minutos y estas dentro del ranking.',
  },
  {
    icon: HandCoins,
    title: 'Recibe propuestas',
    body: 'Las marcas te encuentran por nicho y ciudad. Tambien puedes postularte tu a las campanas abiertas.',
  },
  {
    icon: ShieldCheck,
    title: 'El dinero se deposita antes',
    body: 'La empresa deja el importe en garantia antes de que grabes. Nada de perseguir facturas.',
  },
  {
    icon: Coins,
    title: 'Cobras al aprobar',
    body: 'Entregas el contenido, la marca lo aprueba y recibes el pago menos la comision. Sin sorpresas.',
  },
]

const TIERS = [
  { range: '1K – 10K', label: 'Nano', post: '60 – 120', reel: '90 – 180' },
  { range: '10K – 50K', label: 'Micro', post: '120 – 400', reel: '180 – 600' },
  { range: '50K – 250K', label: 'Medio', post: '400 – 1.200', reel: '600 – 1.800' },
  { range: '+250K', label: 'Macro', post: '1.200 – 4.000', reel: '1.800 – 6.000' },
]

const FAQ = [
  {
    q: 'Cuanto se queda Mikro?',
    a: 'Un 12% del importe de cada colaboracion, descontado en el momento del pago. No hay cuota mensual ni coste por candidatura.',
  },
  {
    q: 'Necesito muchos seguidores?',
    a: 'No. La mayoria de campanas de pymes buscan perfiles de 5K a 50K con comunidad local y engagement alto. Un perfil pequeno y activo vale mas que uno grande y frio.',
  },
  {
    q: 'Y si la marca no paga?',
    a: 'No puede pasar: el importe queda retenido en Mikro antes de que empieces a producir. Si la empresa cancela despues de la entrega, medias con nosotros.',
  },
  {
    q: 'Tengo que facturar?',
    a: 'Si, como en cualquier colaboracion remunerada. Mikro te genera el justificante de cada pago para tu contabilidad.',
  },
]

export default function ForCreators() {
  const { data: stats } = useAsync(() => api.homeStats(), [])

  return (
    <Layout>
      <section className="relative overflow-hidden bg-ink text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(760px_440px_at_78%_-10%,rgba(139,92,246,0.4),transparent_62%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(560px_380px_at_6%_108%,rgba(37,99,235,0.35),transparent_60%)]" />
        </div>
        <div className="relative mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-white/45">Para creadores</p>
          <h1 className="mt-4 max-w-3xl text-[40px] font-black leading-[1.04] tracking-[-0.035em] sm:text-[54px]">
            Tu comunidad vale dinero.
            <br />
            <span className="text-brand-500">Cobralo.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/60">
            Marcas locales que buscan exactamente lo que tu haces. Sin agencias, sin negociar a ciegas y con el pago
            asegurado antes de grabar.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/registro?rol=creador" className="btn-primary !px-6 !py-3.5 !text-[15px]">
              Crear mi perfil gratis
              <ArrowRight size={17} />
            </Link>
            <Link to="/rankings" className="btn !border !border-white/20 !px-6 !py-3.5 !text-[15px] text-white hover:bg-white/10">
              Ver el ranking
            </Link>
          </div>

          <div className="mt-14 grid max-w-2xl grid-cols-3 gap-8 border-t border-white/10 pt-8">
            <div>
              <p className="text-[30px] font-black leading-none">{stats?.openCampaigns || 0}</p>
              <p className="mt-1.5 text-[12.5px] font-semibold text-white/45">campanas abiertas ahora</p>
            </div>
            <div>
              <p className="text-[30px] font-black leading-none">12%</p>
              <p className="mt-1.5 text-[12.5px] font-semibold text-white/45">comision unica</p>
            </div>
            <div>
              <p className="text-[30px] font-black leading-none">{formatNumber(stats?.brands || 0)}</p>
              <p className="mt-1.5 text-[12.5px] font-semibold text-white/45">empresas registradas</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-[30px] font-black tracking-tight">Como funciona</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          <h2 className="text-[30px] font-black tracking-tight">Cuanto puedes cobrar</h2>
          <p className="mt-2 max-w-xl text-[15px] text-ink/55">
            Rangos orientativos del mercado espanol para colaboraciones con pymes. Tu fijas tus tarifas; estas te sirven
            de referencia.
          </p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-black/[0.07]">
            <table className="w-full text-left">
              <thead className="bg-black/[0.03]">
                <tr>
                  <th className="px-5 py-3.5 text-[12px] font-bold uppercase tracking-wide text-ink/50">Seguidores</th>
                  <th className="px-5 py-3.5 text-[12px] font-bold uppercase tracking-wide text-ink/50">Tramo</th>
                  <th className="px-5 py-3.5 text-[12px] font-bold uppercase tracking-wide text-ink/50">Post</th>
                  <th className="px-5 py-3.5 text-[12px] font-bold uppercase tracking-wide text-ink/50">Reel</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((t) => (
                  <tr key={t.range} className="border-t border-black/[0.06]">
                    <td className="px-5 py-4 text-[14px] font-bold">{t.range}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-[12px] font-bold text-brand-700">{t.label}</span>
                    </td>
                    <td className="px-5 py-4 text-[14px] font-semibold text-ink/70">{t.post} EUR</td>
                    <td className="px-5 py-4 text-[14px] font-semibold text-ink/70">{t.reel} EUR</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12.5px] text-ink/45">
            Suben el precio: exclusividad, cesion de derechos para anuncios, plazos cortos y desplazamientos.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <h2 className="text-[30px] font-black leading-tight tracking-tight">Como subir en el ranking</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink/60">
              No premiamos el tamano, premiamos la comunidad. Estos son los factores que mas pesan.
            </p>
            <ul className="mt-7 space-y-4">
              {[
                { icon: TrendingUp, title: 'Engagement real', body: 'Es el factor con mas peso. Comunidad viva por encima de numeros grandes.' },
                { icon: Star, title: 'Valoraciones de marcas', body: 'Cada colaboracion bien cerrada mejora tu posicion y tu credibilidad.' },
                { icon: Check, title: 'Perfil completo y verificado', body: 'Foto, titular, bio, tarifas y cuatro piezas de portfolio.' },
                { icon: Eye, title: 'Responder rapido', body: 'Contestar en menos de 24 horas te coloca por delante de perfiles equivalentes.' },
              ].map((r) => (
                <li key={r.title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/[0.04] text-ink/55">
                    <r.icon size={17} />
                  </div>
                  <div>
                    <p className="text-[14.5px] font-extrabold tracking-tight">{r.title}</p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-ink/55">{r.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-[30px] font-black leading-tight tracking-tight">Preguntas frecuentes</h2>
            <div className="mt-7 space-y-3">
              {FAQ.map((f) => (
                <details key={f.q} className="group card p-5 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-[14.5px] font-extrabold tracking-tight">
                    {f.q}
                    <span className="shrink-0 text-ink/30 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-ink/60">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-4 pb-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-8 py-14 text-center text-white sm:px-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_300px_at_50%_0%,rgba(139,92,246,0.45),transparent_65%)]" />
          <div className="relative">
            <h2 className="text-[32px] font-black leading-tight tracking-tight sm:text-[38px]">
              Empieza a cobrar por lo que ya haces
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[15.5px] leading-relaxed text-white/60">
              Crear el perfil es gratis y tardas diez minutos. Solo cobramos cuando tu cobras.
            </p>
            <Link to="/registro?rol=creador" className="btn-primary mx-auto mt-8 !px-7 !py-3.5 !text-[15px]">
              Crear mi perfil
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  )
}
