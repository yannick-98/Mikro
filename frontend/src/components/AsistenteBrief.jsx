import { useState } from 'react'
import clsx from 'clsx'
import { Lightbulb, Sparkles, Wand2 } from 'lucide-react'
import { api } from '../api/client'
import { Modal, Spinner } from './ui'

/**
 * Cuatro preguntas y un borrador.
 *
 * El problema no es que la gente no sepa escribir: es que un campo de texto
 * vacio no pregunta nada, y lo que sale de ahi son tres lineas que no bastan
 * para que nadie decida si encaja. Estas cuatro preguntas son las que un
 * comercial haria por telefono.
 *
 * El borrador se devuelve editable y se avisa de ello. Quien sabe como habla
 * su marca es el dueno; nosotros solo le quitamos la pagina en blanco.
 */

const OBJETIVOS = [
  { id: 'ventas', texto: 'Vender más', detalle: 'Quiero pedidos o gente que compre' },
  { id: 'notoriedad', texto: 'Que me conozcan', detalle: 'Quiero llegar a gente nueva de mi zona' },
  { id: 'lanzamiento', texto: 'Lanzar algo', detalle: 'Estreno producto o local' },
  { id: 'contenido', texto: 'Conseguir contenido', detalle: 'Quiero material para mis redes' },
]

export default function AsistenteBrief({ open, onClose, onListo, campaign = {} }) {
  const [r, setR] = useState({ producto: '', objetivo: 'notoriedad', publico: '', imprescindible: '' })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [resultado, setResultado] = useState(null)

  const set = (k) => (e) => setR((x) => ({ ...x, [k]: e.target.value }))

  async function generar() {
    setCargando(true)
    setError(null)
    try {
      setResultado(await api.writeBrief({ respuestas: r, campaign }))
    } catch (e) {
      setError(e.details?.[0]?.message || e.message)
    } finally {
      setCargando(false)
    }
  }

  function usar() {
    onListo?.(resultado)
    onClose()
    setResultado(null)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={resultado ? 'Tu borrador' : 'Te ayudo con el brief'}
      width="max-w-2xl"
    >
      {resultado ? (
        <div className="space-y-4">
          <div>
            <label className="label">Título propuesto</label>
            <input
              className="field"
              value={resultado.titulo}
              onChange={(e) => setResultado({ ...resultado, titulo: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Brief</label>
            <textarea
              rows={12}
              className="field resize-none text-[13.5px] leading-relaxed"
              value={resultado.brief}
              onChange={(e) => setResultado({ ...resultado, brief: e.target.value })}
            />
            <p className="mt-1.5 text-[12px] text-ink/45">
              Es un borrador: cámbialo a tu manera de hablar antes de publicarlo. Lo leerán
              creadores que aún no te conocen.
            </p>
          </div>

          <div>
            <label className="label">Entregables propuestos</label>
            <input
              className="field"
              value={resultado.deliverables}
              onChange={(e) => setResultado({ ...resultado, deliverables: e.target.value })}
            />
          </div>

          {resultado.consejos?.length ? (
            <ul className="space-y-2 rounded-xl bg-amber-50 p-3.5">
              {resultado.consejos.map((c) => (
                <li key={c} className="flex gap-2 text-[12.5px] leading-relaxed text-amber-900">
                  <Lightbulb size={14} className="mt-0.5 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={usar} className="btn-primary">
              <Sparkles size={15} /> Usar este borrador
            </button>
            <button type="button" onClick={() => setResultado(null)} className="btn-ghost">
              Volver a las preguntas
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-[13.5px] leading-relaxed text-ink/55">
            Cuatro preguntas. Con lo que respondas te dejo un brief escrito que luego puedes
            cambiar entero.
          </p>

          <div>
            <label className="label">¿Qué quieres que enseñe el creador?</label>
            <input
              className="field"
              value={r.producto}
              onChange={set('producto')}
              placeholder="Nuestra masa madre de espelta, recién salida del horno"
            />
          </div>

          <div>
            <span className="label">¿Para qué?</span>
            <div className="mt-1 grid gap-2 sm:grid-cols-2">
              {OBJETIVOS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setR((x) => ({ ...x, objetivo: o.id }))}
                  className={clsx(
                    'rounded-xl border-2 px-3.5 py-2.5 text-left transition',
                    r.objetivo === o.id
                      ? 'border-ink bg-ink text-white'
                      : 'border-black/[0.08] hover:border-black/20',
                  )}
                >
                  <span className="block text-[13.5px] font-bold">{o.texto}</span>
                  <span
                    className={clsx(
                      'block text-[12px]',
                      r.objetivo === o.id ? 'text-white/60' : 'text-ink/45',
                    )}
                  >
                    {o.detalle}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">¿A quién le hablas?</label>
            <input
              className="field"
              value={r.publico}
              onChange={set('publico')}
              placeholder="Familias del barrio que compran pan de calidad entre semana"
            />
            <p className="mt-1.5 text-[12px] text-ink/45">
              Es el dato que más ordena las candidaturas. Cuanto más concreto, menos gente que no
              encaja te escribirá.
            </p>
          </div>

          <div>
            <label className="label">¿Algo que no puede faltar, o que no quieres ver?</label>
            <input
              className="field"
              value={r.imprescindible}
              onChange={set('imprescindible')}
              placeholder="Que se vea el interior del pan al cortarlo. Sin música con derechos."
            />
          </div>

          {error ? <p className="text-[12.5px] font-semibold text-rose-600">{error}</p> : null}

          <button
            type="button"
            onClick={generar}
            disabled={cargando || !r.producto.trim()}
            className="btn-primary w-full"
          >
            {cargando ? <Spinner size={15} /> : <Wand2 size={15} />} Escribir el borrador
          </button>
        </div>
      )}
    </Modal>
  )
}
