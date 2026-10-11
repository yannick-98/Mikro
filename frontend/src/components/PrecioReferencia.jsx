import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Info, TrendingUp } from 'lucide-react'
import { api } from '../api/client'
import { Spinner } from './ui'
import { formatEuro } from '../lib/format'

/**
 * Lo que se paga de verdad por una colaboracion asi.
 *
 * Es el bloqueo numero uno de los dos lados del mercado, y la respuesta solo
 * la tiene quien ve lo que se cierra. Por eso esta aqui y no en un articulo
 * del blog: la cifra tiene que aparecer en el momento exacto en el que
 * alguien esta decidiendo un numero.
 *
 * La regla que gobierna esta pantalla: **un dato y una estimacion no se pintan
 * igual**. Si no hay muestra suficiente, se dice con todas las letras y en
 * otro color. Presentar una corazonada con el aplomo de un dato seria poner
 * nosotros el ancla de una negociacion ajena.
 */

const NIVELES = {
  'sector-ciudad-tramo': 'tu sector y tu ciudad',
  'sector-tramo': 'tu sector',
  tramo: 'perfiles de tu tamaño',
  general: 'todo Mikro',
}

export default function PrecioReferencia({
  sector,
  city,
  followers,
  engagement,
  mio = false,
  onUsar,
  className,
}) {
  const [ref, setRef] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vivo = true
    setRef(null)
    setError(null)
    const peticion = mio
      ? api.myPricing()
      : api.pricing({ sector, city, followers, engagement })
    peticion
      .then((r) => vivo && setRef(r))
      .catch((e) => vivo && setError(e.message))
    return () => {
      vivo = false
    }
  }, [sector, city, followers, engagement, mio])

  if (error) return null

  if (!ref) {
    return (
      <div className={clsx('flex items-center gap-2 rounded-xl bg-black/[0.03] px-4 py-3', className)}>
        <Spinner size={14} className="text-ink/30" />
        <span className="text-[12.5px] text-ink/45">Mirando qué se paga por esto…</span>
      </div>
    )
  }

  const estimado = ref.origen === 'estimacion'

  return (
    <div
      className={clsx(
        'rounded-xl border px-4 py-3.5',
        estimado ? 'border-amber-200 bg-amber-50/50' : 'border-brand-200 bg-brand-50/50',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {estimado ? (
          <Info size={15} className="text-amber-700" />
        ) : (
          <TrendingUp size={15} className="text-brand-600" />
        )}
        <span className="text-[12px] font-bold uppercase tracking-[0.07em] text-ink/45">
          {estimado ? 'Estimación' : 'Se está pagando'}
        </span>
        {/* Un rango colapsado (todo al mismo precio) se pinta como una
            cifra sola: "250 – 250 €" parece un fallo del programa. */}
        <span className="text-[17px] font-black tabular-nums">
          {ref.min === ref.max
            ? formatEuro(ref.mediana)
            : `${formatEuro(ref.min)} – ${formatEuro(ref.max)}`}
        </span>
        {!estimado && ref.min !== ref.max ? (
          <span className="text-[12.5px] font-semibold text-ink/50">
            mediana {formatEuro(ref.mediana)}
          </span>
        ) : null}

        {onUsar ? (
          <button
            type="button"
            onClick={() => onUsar(ref)}
            className="ml-auto rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-bold text-ink/70 transition hover:bg-black/[0.04]"
          >
            Usar este rango
          </button>
        ) : null}
      </div>

      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/55">
        {estimado ? (
          <>
            Todavía no hemos cerrado suficientes colaboraciones con este perfil, así que esto no es
            un dato de mercado: es una estimación a partir del tamaño y el engagement. Tómala como
            un punto de partida, no como una referencia.
          </>
        ) : (
          <>
            {ref.min === ref.max ? 'Casi todas' : 'La mitad de'} las colaboraciones en{' '}
            {NIVELES[ref.nivel] || 'Mikro'} se cerraron{' '}
            {ref.min === ref.max ? 'a ese precio' : 'en esa horquilla'}. Sobre {ref.muestra}{' '}
            colaboraciones
            {ref.minimoVisto != null
              ? `, entre ${formatEuro(ref.minimoVisto)} y ${formatEuro(ref.maximoVisto)} en total`
              : ''}
            .{' '}
            {ref.fiabilidad === 'orientativa'
              ? 'Con esta muestra todavía es orientativo.'
              : null}
          </>
        )}
      </p>
    </div>
  )
}
