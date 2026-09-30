import { Link } from 'react-router-dom'
import { BookOpen, Calculator, FileText, Mail, Scale, Sparkles } from 'lucide-react'
import Layout from '../components/Layout'

const GUIDES = [
  {
    tag: 'Guia',
    title: 'Como escribir un brief que atraiga a buenos creadores',
    body: 'Un brief flojo trae candidaturas flojas. Que contar, que dejar abierto y que errores espantan a los perfiles que te interesan.',
    minutes: 6,
  },
  {
    tag: 'Plantilla',
    title: 'Contrato de colaboracion para micro-influencers',
    body: 'Modelo editable con entregables, plazos, cesion de derechos de uso y clausula de exclusividad. Adaptado a la normativa espanola.',
    minutes: 4,
  },
  {
    tag: 'Analisis',
    title: 'Micro vs macro: los numeros de una pyme real',
    body: 'Una panaderia de Valencia comparo 500 EUR en anuncios contra 500 EUR en cinco micro-influencers. Que paso con las visitas y las ventas.',
    minutes: 8,
  },
  {
    tag: 'Guia',
    title: 'Como detectar seguidores comprados',
    body: 'Cinco senales que se ven en dos minutos: ratio de comentarios, procedencia de la audiencia, picos de crecimiento y calidad de las respuestas.',
    minutes: 5,
  },
  {
    tag: 'Guia',
    title: 'Primeros pasos como creador: de 0 a tu primera colaboracion',
    body: 'Que poner en el perfil, como fijar tarifas sin regalar tu trabajo y como escribir una candidatura que la marca lea entera.',
    minutes: 7,
  },
  {
    tag: 'Checklist',
    title: 'Publicidad y ley: lo que hay que etiquetar',
    body: 'Cuando es obligatorio el aviso de publicidad, como hacerlo bien en cada red y que dice el codigo de conducta espanol.',
    minutes: 5,
  },
]

const PRICE_TABLE = [
  ['Nano (1K – 10K)', '60 – 120 EUR', '90 – 180 EUR', '40 – 80 EUR'],
  ['Micro (10K – 50K)', '120 – 400 EUR', '180 – 600 EUR', '70 – 200 EUR'],
  ['Medio (50K – 250K)', '400 – 1.200 EUR', '600 – 1.800 EUR', '200 – 500 EUR'],
  ['Macro (+250K)', '1.200 – 4.000 EUR', '1.800 – 6.000 EUR', '500 – 1.500 EUR'],
]

const FAQ = [
  {
    q: 'Que es exactamente Mikro?',
    a: 'Un marketplace que conecta pymes con micro-influencers. La empresa publica una campana, los creadores se postulan, se acuerda el importe y Mikro retiene el pago hasta que el contenido esta aprobado.',
  },
  {
    q: 'Cuanto cuesta usarlo?',
    a: 'Registrarse y publicar campanas es gratis. Mikro cobra una comision del 12% sobre cada colaboracion cerrada. Hay planes de suscripcion opcionales que reducen esa comision.',
  },
  {
    q: 'Como se garantiza el pago?',
    a: 'Al aceptar una colaboracion la empresa deposita el importe. Queda retenido en Mikro y solo se libera al creador cuando el contenido se aprueba. Si se cancela antes de la entrega, se devuelve.',
  },
  {
    q: 'Quien es el dueno del contenido?',
    a: 'Por defecto el creador cede a la marca el derecho de uso en sus canales organicos. Si quieres usarlo en anuncios de pago, acordalo en el brief: suele encarecer la colaboracion.',
  },
  {
    q: 'Verificais los perfiles?',
    a: 'Si. Los perfiles con el distintivo azul han acreditado la propiedad de sus cuentas. Las metricas se actualizan periodicamente y el ranking penaliza los crecimientos anomalos.',
  },
]

function Section({ id, children, className = '' }) {
  return (
    <section id={id} className={`mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </section>
  )
}

export default function Resources() {
  return (
    <Layout>
      <section className="border-b border-black/[0.06] bg-white">
        <div className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6 lg:px-8">
          <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-ink/40">Recursos</p>
          <h1 className="mt-3 max-w-2xl text-[38px] font-black leading-[1.06] tracking-[-0.035em] sm:text-[46px]">
            Todo lo que necesitas saber antes de tu primera colaboracion
          </h1>
          <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-ink/55">
            Guias, plantillas y precios de referencia para empresas y creadores. Sin humo y sin jerga de agencia.
          </p>
        </div>
      </section>

      <Section className="py-14">
        <div className="flex items-center gap-2.5">
          <BookOpen size={19} className="text-brand-600" />
          <h2 className="text-[24px] font-black tracking-tight">Guias y plantillas</h2>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map((g) => (
            <article key={g.title} className="card flex flex-col p-6 transition hover:shadow-lift">
              <div className="flex items-center justify-between">
                <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-brand-700">
                  {g.tag}
                </span>
                <span className="text-[12px] font-semibold text-ink/35">{g.minutes} min</span>
              </div>
              <h3 className="mt-4 text-[16px] font-extrabold leading-snug tracking-tight">{g.title}</h3>
              <p className="mt-2.5 flex-1 text-[13.5px] leading-relaxed text-ink/55">{g.body}</p>
              <span className="mt-4 text-[13px] font-bold text-brand-600">Leer guia →</span>
            </article>
          ))}
        </div>
      </Section>

      <Section id="precios" className="py-14">
        <div className="card overflow-hidden">
          <div className="border-b border-black/[0.06] p-7">
            <div className="flex items-center gap-2.5">
              <Calculator size={19} className="text-brand-600" />
              <h2 className="text-[24px] font-black tracking-tight">Tarifas orientativas 2026</h2>
            </div>
            <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink/55">
              Rangos habituales en Espana para colaboraciones con pymes. Sirven de punto de partida: el precio final
              depende del nicho, la exclusividad y los derechos de uso.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-black/[0.02]">
                <tr>
                  {['Tramo', 'Post en feed', 'Reel / video', 'Pack de stories'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-6 py-3.5 text-[12px] font-bold uppercase tracking-wide text-ink/45">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRICE_TABLE.map((row) => (
                  <tr key={row[0]} className="border-t border-black/[0.06]">
                    {row.map((cell, i) => (
                      <td key={i} className={`whitespace-nowrap px-6 py-4 text-[14px] ${i === 0 ? 'font-bold' : 'font-semibold text-ink/65'}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section id="legal" className="py-14">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-7">
            <Scale size={19} className="text-brand-600" />
            <h2 className="mt-3.5 text-[21px] font-black tracking-tight">Publicidad y ley</h2>
            <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-ink/60">
              <li>
                <span className="font-bold text-ink">Etiqueta siempre.</span> Toda colaboracion remunerada o con producto
                cedido debe identificarse como publicidad de forma clara y en el propio contenido.
              </li>
              <li>
                <span className="font-bold text-ink">Vale con formulas sencillas:</span> "publicidad", "en colaboracion
                con" o la herramienta de contenido patrocinado de cada red.
              </li>
              <li>
                <span className="font-bold text-ink">Cuidado con los sectores regulados:</span> salud, alimentacion
                infantil, juego y financiero tienen restricciones adicionales.
              </li>
              <li>
                <span className="font-bold text-ink">Factura la colaboracion.</span> Es una prestacion de servicios: el
                creador emite factura y Mikro guarda el justificante del pago.
              </li>
            </ul>
            <p className="mt-5 rounded-xl bg-black/[0.03] px-4 py-3 text-[12.5px] leading-relaxed text-ink/50">
              Esta pagina es informativa y no constituye asesoramiento juridico. Para casos concretos consulta con un
              profesional.
            </p>
          </div>

          <div id="sobre" className="card p-7">
            <Sparkles size={19} className="text-brand-600" />
            <h2 className="mt-3.5 text-[21px] font-black tracking-tight">Sobre Mikro</h2>
            <p className="mt-4 text-[14px] leading-relaxed text-ink/60">
              Mikro nace de una observacion sencilla: las pymes tienen presupuesto para publicidad, pero no para
              agencias. Y hay miles de creadores con comunidades pequenas y fieles que no saben como venderse a una
              marca local.
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-ink/60">
              Ponemos a los dos en la misma mesa: catalogo transparente, afinidad calculada, precio acordado y pago en
              garantia. Sin comisiones ocultas y sin intermediarios que se lleven un tercio.
            </p>

            <div id="contacto" className="mt-6 rounded-2xl border border-black/[0.07] p-5">
              <div className="flex items-center gap-2.5">
                <Mail size={17} className="text-ink/45" />
                <p className="text-[14px] font-extrabold">Contacto</p>
              </div>
              <p className="mt-2 text-[13.5px] text-ink/55">
                Escribenos a <span className="font-bold text-ink">hola@mikro.es</span> para soporte, prensa o acuerdos
                con agencias.
              </p>
              <Link to="/registro" className="btn-dark mt-4 w-full">
                Crear cuenta gratis
              </Link>
            </div>
          </div>
        </div>
      </Section>

      <Section id="faq" className="pb-16">
        <div className="flex items-center gap-2.5">
          <FileText size={19} className="text-brand-600" />
          <h2 className="text-[24px] font-black tracking-tight">Preguntas frecuentes</h2>
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
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
      </Section>
    </Layout>
  )
}
