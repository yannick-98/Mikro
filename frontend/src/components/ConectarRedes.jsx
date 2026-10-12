import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Link2,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { api } from '../api/client'
import { PlatformIcon, Spinner } from './ui'
import { formatFollowers } from '../lib/format'

/**
 * Mis redes.
 *
 * El camino normal es el mas corto que existe: el creador escribe su @ y las
 * cifras aparecen. No se le manda a ninguna pantalla de permisos, porque ahi
 * se cae gente y se cae justo la que todavia no conoce la marca.
 *
 * Lo que no se puede saltar es el paso de despues. Escribir un @ no demuestra
 * que sea tuyo, y aqui se cobra dinero por audiencia: hasta que el creador
 * pega un codigo en su biografia, sus cifras las ve el y nadie mas. Esa
 * pantalla es la amarilla de abajo, y esta escrita para que se entienda por
 * que existe, no solo que hay que hacer.
 *
 * Conectar la cuenta de verdad sigue estando, en pequeno: da mejor dato y vale
 * como prueba por si misma. Pero ya no es el peaje de entrada.
 */

const NOMBRES = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' }

const EJEMPLO = {
  instagram: '@tuusuario',
  tiktok: '@tuusuario',
  youtube: '@tucanal o el enlace de tu canal',
}

const fecha = (d) =>
  d
    ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

const hace = (d) => {
  if (!d) return null
  const horas = Math.round((Date.now() - new Date(d).getTime()) / 3600000)
  if (horas < 1) return 'hace un momento'
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.round(horas / 24)
  return dias === 1 ? 'ayer' : `hace ${dias} días`
}

function Dato({ etiqueta, valor, sufijo }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-ink/40">{etiqueta}</p>
      <p className="mt-0.5 text-[15px] font-black tabular-nums">
        {valor}
        {sufijo ? <span className="text-[12px] font-bold text-ink/45">{sufijo}</span> : null}
      </p>
    </div>
  )
}

/**
 * El paso de "demuestra que es tuya".
 *
 * Se explica el porque en una linea antes de pedir nada. Un codigo que hay
 * que pegar en tu propia biografia sin saber para que parece un aro por el
 * que saltar; sabiendo que es lo que impide que otro venda tus seguidores, es
 * evidente.
 */
function Verificar({ platform, onHecho, show }) {
  const [info, setInfo] = useState(null)
  const [comprobando, setComprobando] = useState(false)

  useEffect(() => {
    let vivo = true
    api
      .socialOwnership(platform)
      .then((d) => vivo && setInfo(d))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [platform])

  const comprobar = async () => {
    setComprobando(true)
    try {
      const r = await api.verifySocial(platform)
      if (r.verificada) {
        show?.success('Cuenta verificada. Tus cifras ya salen en tu perfil.')
        onHecho?.()
      } else {
        show?.info(r.motivo || 'Todavía no encontramos el código.')
      }
    } catch (e) {
      show?.error(e.message)
    } finally {
      setComprobando(false)
    }
  }

  const copiar = () => {
    navigator.clipboard?.writeText(info.codigo).then(
      () => show?.success('Código copiado'),
      () => {},
    )
  }

  if (!info) return null

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
      <p className="flex gap-2 text-[12.5px] font-bold text-amber-900">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        Estas cifras solo las ves tú
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-amber-900/85">
        Nos falta comprobar que la cuenta es tuya. Hasta entonces no aparece en tu perfil ni en las
        búsquedas de las marcas: escribir un @ lo puede hacer cualquiera, y aquí se paga por
        audiencia.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-mono text-[13px] font-bold text-amber-900 transition hover:bg-amber-50"
        >
          {info.codigo} <Copy size={12} />
        </button>
        <span className="text-[12.5px] text-amber-900/85">Pégalo {info.donde} y guarda.</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={comprobar}
          disabled={comprobando}
          className="btn-primary !bg-amber-900 hover:!bg-amber-950"
        >
          {comprobando ? <Spinner size={14} /> : <ShieldCheck size={14} />} Comprobar
        </button>
        <span className="text-[12px] text-amber-900/70">
          Cuando salga verificada puedes quitarlo si quieres.
        </span>
      </div>
    </div>
  )
}

/** Una cuenta de la que ya traemos los datos. */
function CuentaMedida({ cuenta, onSync, onQuitar, onCambio, ocupado, show }) {
  const pocaMuestra = cuenta.postsAnalyzed > 0 && cuenta.postsAnalyzed < 3
  const publica = cuenta.enElPerfil

  return (
    <div
      className={
        publica
          ? 'rounded-xl border border-emerald-200 bg-emerald-50/40 p-4'
          : 'rounded-xl border border-black/[0.08] p-4'
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <PlatformIcon platform={cuenta.platform} size={18} />
        <span className="text-[14px] font-extrabold">@{cuenta.handle}</span>
        {publica ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11.5px] font-bold text-emerald-800">
            <ShieldCheck size={12} /> Comprobado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-bold text-amber-800">
            Sin verificar
          </span>
        )}
        {cuenta.metodo === 'OAUTH' ? (
          <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] font-bold text-ink/50">
            Cuenta conectada
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSync(cuenta.platform)}
            disabled={ocupado}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-bold text-ink/70 transition hover:bg-black/[0.04] disabled:opacity-50"
          >
            {ocupado ? <Spinner size={12} /> : <RefreshCw size={12} />} Actualizar
          </button>
          <button
            type="button"
            onClick={() => onQuitar(cuenta.platform)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-bold text-rose-600 transition hover:bg-rose-50"
          >
            <Trash2 size={12} /> Quitar
          </button>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Dato etiqueta="Seguidores" valor={formatFollowers(cuenta.followers)} />
        <Dato etiqueta="Engagement" valor={cuenta.engagement} sufijo="%" />
        <Dato etiqueta="Publica" valor={cuenta.postsPerWeek} sufijo=" / sem" />
        <Dato etiqueta="Media de likes" valor={formatFollowers(cuenta.avgLikes)} />
      </div>

      <p className="mt-3 text-[12px] text-ink/45">
        Calculado sobre tus últimas {cuenta.postsAnalyzed} publicaciones
        {cuenta.lastPostAt ? `, la más reciente ${hace(cuenta.lastPostAt)}` : ''}.
        {cuenta.lastSyncAt ? ` Actualizado ${hace(cuenta.lastSyncAt)}.` : ''}
      </p>

      {pocaMuestra ? (
        <p className="mt-2 flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          Con menos de tres publicaciones recientes no podemos dar un engagement fiable. En cuanto
          publiques un par de veces más, aparecerá aquí.
        </p>
      ) : null}

      {cuenta.syncError ? (
        <p className="mt-2 flex gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {cuenta.syncError}
        </p>
      ) : null}

      {!publica ? (
        <Verificar platform={cuenta.platform} onHecho={onCambio} show={show} />
      ) : null}
    </div>
  )
}

/** Una red de la que todavía no tenemos nada. */
function Alta({ platform, cuenta, estado, onHandle, onConectar, ocupado }) {
  const [valor, setValor] = useState('')
  const porHandle = estado?.porHandle
  const conOauth = estado?.modos?.includes('oauth')

  return (
    <div className="rounded-xl border border-black/[0.08] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <PlatformIcon platform={platform} size={18} />
        <span className="text-[14px] font-extrabold">{NOMBRES[platform]}</span>
        {cuenta ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-bold text-amber-800">
            Lo dices tú · {formatFollowers(cuenta.followers)} seguidores
          </span>
        ) : null}
      </div>

      {porHandle ? (
        <>
          <form
            className="mt-3 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              onHandle(platform, valor)
            }}
          >
            <input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={EJEMPLO[platform]}
              className="field !mt-0 min-w-[220px] flex-1"
            />
            <button type="submit" disabled={ocupado || !valor.trim()} className="btn-primary">
              {ocupado ? <Spinner size={14} /> : <Search size={14} />} Traer mis cifras
            </button>
          </form>
          <p className="mt-2.5 text-[12px] text-ink/45">
            No te pedimos contraseña ni permisos. Leemos lo que ya es público en tu perfil y
            calculamos el engagement nosotros.
            {conOauth ? (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => onConectar(platform)}
                  className="font-bold text-brand-600 underline decoration-brand-600/30 underline-offset-2 hover:decoration-brand-600"
                >
                  O conecta la cuenta
                </button>{' '}
                si prefieres que quede verificada de una vez.
              </>
            ) : null}
          </p>
        </>
      ) : conOauth ? (
        <>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => onConectar(platform)}
              disabled={ocupado}
              className="btn-primary"
            >
              {ocupado ? <Spinner size={14} /> : <Link2 size={14} />} Conectar {NOMBRES[platform]}
            </button>
          </div>
          <p className="mt-2.5 text-[12px] text-ink/45">
            Permiso de solo lectura. No publicamos nada en tu nombre y puedes retirarlo cuando
            quieras.
          </p>
        </>
      ) : (
        <p className="mt-3 text-[12.5px] text-ink/45">
          Lo de {NOMBRES[platform]} todavía no está disponible. Mientras tanto puedes poner tus
          cifras a mano, más abajo.
        </p>
      )}
    </div>
  )
}

export default function ConectarRedes({ onCambio, show }) {
  const [datos, setDatos] = useState(null)
  const [ocupado, setOcupado] = useState(null)
  const [params, setParams] = useSearchParams()

  const cargar = useCallback(async () => {
    try {
      setDatos(await api.mySocial())
    } catch (e) {
      show?.error(e.message)
    }
  }, [show])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Vuelta de la plataforma. El resultado llega en la URL porque quien
  // regresa es un navegador, no una llamada nuestra.
  useEffect(() => {
    const estado = params.get('estado')
    if (!estado) return
    const red = NOMBRES[params.get('conexion')] || 'La cuenta'
    if (estado === 'ok') show?.success(`${red} conectado. Ya estamos midiendo tus cifras.`)
    else if (estado === 'cancelada') show?.info('No se completó la conexión.')
    else show?.error(params.get('detalle') || 'No se pudo conectar la cuenta.')

    params.delete('conexion')
    params.delete('estado')
    params.delete('detalle')
    setParams(params, { replace: true })
    cargar()
    onCambio?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refrescar = async () => {
    await cargar()
    onCambio?.()
  }

  const conectar = async (platform) => {
    setOcupado(platform)
    try {
      const { url } = await api.connectSocial(platform)
      window.location.href = url
    } catch (e) {
      show?.error(e.message)
      setOcupado(null)
    }
  }

  const darDeAlta = async (platform, handle) => {
    setOcupado(platform)
    try {
      const r = await api.addSocialHandle(platform, handle)
      if (r.error) show?.error(r.error)
      else if (r.account?.enElPerfil) show?.success('Listo. Ya tenemos tus cifras reales.')
      else show?.info('Cifras traídas. Falta un paso para que las vean las marcas.')
      await refrescar()
    } catch (e) {
      show?.error(e.message)
    } finally {
      setOcupado(null)
    }
  }

  const sincronizar = async (platform) => {
    setOcupado(platform)
    try {
      const r = await api.syncSocial(platform)
      if (r.ok) show?.success('Cifras actualizadas')
      else show?.error(r.error || 'No se pudieron actualizar')
      await refrescar()
    } catch (e) {
      show?.error(e.message)
    } finally {
      setOcupado(null)
    }
  }

  const quitar = async (platform) => {
    setOcupado(platform)
    try {
      await api.disconnectSocial(platform)
      show?.info('Cuenta quitada. Hemos borrado lo que habíamos traído de ella.')
      await refrescar()
    } catch (e) {
      show?.error(e.message)
    } finally {
      setOcupado(null)
    }
  }

  if (!datos) {
    return (
      <section className="card flex justify-center p-10">
        <Spinner size={20} className="text-brand-600" />
      </section>
    )
  }

  const porPlataforma = Object.fromEntries(datos.accounts.map((a) => [a.platform, a]))
  const estados = Object.fromEntries(datos.platforms.map((p) => [p.platform, p]))
  const comprobado = datos.creator?.metricsSource === 'CONNECTED'

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-extrabold tracking-tight">Mis redes</h2>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-ink/55">
            Dinos tu usuario y las cifras las traemos nosotros. Un perfil comprobado sube en el
            ranking y, sobre todo, convence: la marca sabe que el número no te lo has puesto tú.
          </p>
        </div>
        {comprobado ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[12px] font-bold text-emerald-800">
            <ShieldCheck size={13} /> Perfil con datos comprobados
          </span>
        ) : null}
      </div>

      {comprobado ? (
        <div className="mt-4 flex flex-wrap items-center gap-5 rounded-xl bg-black/[0.03] px-4 py-3">
          <TrendingUp size={16} className="text-brand-600" />
          <Dato etiqueta="Total seguidores" valor={formatFollowers(datos.creator.totalFollowers)} />
          <Dato etiqueta="Engagement" valor={datos.creator.engagementRate} sufijo="%" />
          <Dato etiqueta="Publicas" valor={datos.creator.postsPerWeek} sufijo=" / sem" />
          <span className="ml-auto text-[12px] text-ink/45">
            Comprobado el {fecha(datos.creator.metricsVerifiedAt)}
          </span>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
        {['instagram', 'tiktok', 'youtube'].map((p) => {
          const cuenta = porPlataforma[p]
          return cuenta?.source === 'CONNECTED' ? (
            <CuentaMedida
              key={p}
              cuenta={cuenta}
              onSync={sincronizar}
              onQuitar={quitar}
              onCambio={refrescar}
              ocupado={ocupado === p}
              show={show}
            />
          ) : (
            <Alta
              key={p}
              platform={p}
              cuenta={cuenta}
              estado={estados[p]}
              onHandle={darDeAlta}
              onConectar={conectar}
              ocupado={ocupado === p}
            />
          )
        })}
      </div>

      {!datos.cifradoListo ? (
        <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Falta configurar el cifrado de credenciales en el servidor, así que las conexiones con
          permiso están desactivadas. Es a propósito: no guardamos accesos a cuentas sin cifrar.
        </p>
      ) : null}

      <p className="mt-4 flex gap-2 text-[12px] leading-relaxed text-ink/45">
        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-ink/30" />
        Solo leemos lo que ya es público en tu perfil: seguidores, y los likes y comentarios de tus
        últimas publicaciones. No vemos tus mensajes, no publicamos nada y, si quitas una cuenta,
        borramos lo que habíamos traído.
      </p>
    </section>
  )
}
