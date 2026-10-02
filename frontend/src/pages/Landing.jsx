import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, ChevronDown, UserRound } from 'lucide-react'
import { api } from '../api/client'
import { Logo } from '../components/ui'
import PostCard from '../components/landing/PostCard'
import Podium from '../components/landing/Podium'
import BrandsFace from '../components/landing/BrandsFace'
import {
  PHASES,
  between,
  blendTransform,
  clamp,
  easeInOut,
  easeOut,
  lerp,
  orbitSlot,
  prefersStatic,
  STOPS,
  travelEase,
  TRANSITION_MS,
  sceneMetrics,
  toTransform,
} from '../components/landing/scene'

const SPIN_SECONDS = 60

/** Perfiles de respaldo: la primera impresion no debe depender de la red. */
const FALLBACK = Array.from({ length: 10 }, (_, i) => ({
  id: `demo-${i}`,
  handle: 'mikro',
  displayName: '—',
  category: ['Fitness', 'Moda', 'Gastronomia', 'Viajes', 'Gaming', 'Tecnologia', 'Lifestyle', 'Belleza', 'Musica', 'Hogar'][i],
  totalFollowers: 0,
  score: 100 - i * 6,
  rankDelta: 0,
  verified: false,
  portfolio: [],
}))

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo tone="dark" />
        <div className="flex items-center gap-2">
          <Link
            to="/entrar"
            className="rounded-xl border border-white/20 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-white/10"
          >
            Iniciar sesion
          </Link>
          <Link
            to="/registro"
            className="group inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-brand-700"
          >
            Registrate
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  )
}

/** Fondo: aurora de tres luces y la trama que usa el resto de la aplicacion. */
function Backdrop({ auroraRef, gridRef }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div ref={auroraRef} className="absolute inset-[-25%]">
        <div className="landing-aurora landing-aurora-1" />
        <div className="landing-aurora landing-aurora-2" />
        <div className="landing-aurora landing-aurora-3" />
      </div>
      <div
        ref={gridRef}
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black, transparent)',
        }}
      />
    </div>
  )
}

function HeroCopy({ innerRef }) {
  return (
    <div ref={innerRef} className="pointer-events-none absolute inset-x-0 top-[13vh] z-20 px-6 text-center">
      <h1 className="landing-title text-[clamp(72px,11vw,168px)] font-black leading-[0.85] tracking-[-0.055em] text-white">
        mikro
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-[clamp(15px,1.5vw,21px)] font-semibold text-white/55">
        Marcas que conectan. Creadores que inspiran.
      </p>
    </div>
  )
}

function HeroCta({ innerRef }) {
  return (
    <div ref={innerRef} className="absolute inset-x-0 bottom-[13vh] z-20 flex flex-col items-center gap-4 px-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/registro?rol=creador"
          className="group inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-[15px] font-black text-ink transition hover:bg-white/90"
        >
          <UserRound size={17} />
          Soy creador
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          to="/registro?rol=empresa"
          className="group inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/[0.06] px-6 py-3.5 text-[15px] font-black text-white backdrop-blur transition hover:bg-white/12"
        >
          <Building2 size={17} />
          Soy empresa
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <p className="text-[12.5px] font-semibold text-white/30">Gratis para empezar. Sin tarjeta.</p>
    </div>
  )
}

export default function Landing() {
  const [creators, setCreators] = useState(FALLBACK)
  const [stats, setStats] = useState(null)
  const [isStatic, setIsStatic] = useState(() => prefersStatic())

  const cardRefs = useRef([])
  const slotRefs = useRef([])
  const heroCopyRef = useRef(null)
  const heroCtaRef = useRef(null)
  const panelRef = useRef(null)
  const frontRef = useRef(null)
  const backFaceRef = useRef(null)
  const backInnerRef = useRef(null)
  const orbitRef = useRef(null)
  const auroraRef = useRef(null)
  const gridRef = useRef(null)

  const [section, setSection] = useState(0)

  // Estado del bucle: nada de esto pasa por React, se escribe directo al DOM.
  const loop = useRef({
    p: STOPS[0],
    from: STOPS[0],
    to: STOPS[0],
    startedAt: 0,
    moving: false,
    spin: 0,
    last: 0,
    paused: false,
    slots: [],
  })

  useEffect(() => {
    let alive = true
    api
      .rankings({ limit: 10 })
      .then((r) => alive && r.items?.length && setCreators(r.items))
      .catch(() => {})
    api
      .homeStats()
      .then((s) => alive && setStats(s))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  /**
   * Navegacion por secciones.
   *
   * El gesto no arrastra la escena: solo dice hacia donde ir. La transicion se
   * reproduce entera, siempre con la misma duracion, y mientras corre se
   * ignoran los gestos nuevos. Es lo que evita quedarse entre dos secciones.
   */
  const goTo = useCallback(
    (next) => {
      const state = loop.current
      const target = clamp(next, 0, STOPS.length - 1)
      if (state.moving || target === state.index) return

      state.index = target
      state.from = state.p
      state.to = STOPS[target]
      state.startedAt = performance.now()
      state.moving = true
      setSection(target)
    },
    [],
  )

  useEffect(() => {
    if (isStatic) return undefined
    loop.current.index = 0

    // Sin scroll nativo: la pagina no se desplaza, se transforma.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    let wheelSum = 0
    let wheelAt = 0
    let touchY = 0

    const step = (dir) => goTo((loop.current.index ?? 0) + dir)

    const onWheel = (e) => {
      e.preventDefault()
      if (loop.current.moving) return

      // Un trackpad manda decenas de eventos por gesto: se acumulan y solo se
      // dispara al superar un umbral, reiniciando si hay una pausa.
      const now = performance.now()
      if (now - wheelAt > 180) wheelSum = 0
      wheelAt = now
      wheelSum += e.deltaY

      if (Math.abs(wheelSum) > 45) {
        step(wheelSum > 0 ? 1 : -1)
        wheelSum = 0
      }
    }

    const onTouchStart = (e) => {
      touchY = e.touches[0].clientY
    }
    const onTouchMove = (e) => {
      e.preventDefault()
      if (loop.current.moving) return
      const delta = touchY - e.touches[0].clientY
      if (Math.abs(delta) > 55) {
        step(delta > 0 ? 1 : -1)
        touchY = e.touches[0].clientY
      }
    }

    const onKey = (e) => {
      const next = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 }[e.key]
      if (next) {
        e.preventDefault()
        step(next)
      } else if (e.key === 'Home') {
        e.preventDefault()
        goTo(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        goTo(STOPS.length - 1)
      }
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKey)
    }
  }, [isStatic, goTo])

  useEffect(() => {
    const onResize = () => setIsStatic(prefersStatic())
    window.addEventListener('resize', onResize)
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    mq.addEventListener?.('change', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      mq.removeEventListener?.('change', onResize)
    }
  }, [])

  /** Mide los huecos del ranking: son el destino de las tarjetas. */
  const measureSlots = useCallback(() => {
    const stage = orbitRef.current
    if (!stage) return
    const center = stage.getBoundingClientRect()
    loop.current.slots = slotRefs.current.map((el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        x: r.left + r.width / 2 - (center.left + center.width / 2),
        y: r.top + r.height / 2 - (center.top + center.height / 2),
        w: r.width,
        h: r.height,
      }
    })
  }, [])

  useLayoutEffect(() => {
    if (isStatic) return undefined
    const measure = () => {
      if (panelRef.current) loop.current.panelHeight = panelRef.current.scrollHeight
      measureSlots()
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [isStatic, creators, measureSlots])

  // Bucle de animacion
  useEffect(() => {
    if (isStatic) return undefined

    let raf
    const metrics = () => sceneMetrics(window.innerWidth)

    const frame = (time) => {
      const state = loop.current
      const raw = state.last ? Math.min(64, time - state.last) : 16
      // Media movil del tiempo entre fotogramas: un frame largo daba un salto
      // en la rotacion, que es lo que se percibia como movimiento brusco.
      state.dt = state.dt ? state.dt * 0.82 + raw * 0.18 : raw
      const dt = state.dt
      state.last = time
      state.clock = (state.clock || 0) + dt / 1000

      // La posicion de la escena la marca la transicion en curso, no el scroll.
      if (state.moving) {
        const t = clamp((time - state.startedAt) / TRANSITION_MS)
        state.p = lerp(state.from, state.to, travelEase(t))
        if (t >= 1) {
          state.p = state.to
          state.moving = false
        }
      }

      const { radius, card } = metrics()
      const absorb = between(state.p, PHASES.absorb)

      // La orbita solo gira mientras esta desplegada.
      if (!state.paused && absorb < 0.98) {
        const breathe = 1 + Math.sin(state.clock * 0.22) * 0.18
        state.spin = (state.spin + (dt / 1000) * (360 / SPIN_SECONDS) * breathe * (1 - absorb)) % 360
      }

      const n = cardRefs.current.length
      cardRefs.current.forEach((el, i) => {
        if (!el) return
        const slot = orbitSlot(i, n, state.spin, radius, state.clock)
        const target = state.slots[i]
        // Las de delante se van primero: la succion recorre el circulo.
        const t = blendTransform(slot, target, card, absorb, (i / n) * 0.18)
        el.style.transform = toTransform(t)
        el.style.opacity = String(t.opacity)
        el.style.zIndex = String(Math.round(100 + t.z / 10))
      })

      // El fondo sube con el scroll: la capa esta fija, pero el decorado se
      // desplaza y da la sensacion de estar bajando por la pagina. La trama
      // corre mas que las luces, que quedan "mas lejos".
      if (gridRef.current) gridRef.current.style.backgroundPosition = `0px ${(-state.p * 620).toFixed(1)}px`
      if (auroraRef.current) auroraRef.current.style.transform = `translate3d(0, ${(-state.p * 230).toFixed(1)}px, 0)`

      // Hero: sube y se desvanece al empezar la absorcion.
      const out = between(state.p, PHASES.heroOut)
      if (heroCopyRef.current) {
        heroCopyRef.current.style.opacity = String(1 - out)
        heroCopyRef.current.style.transform = `translate3d(0, ${-out * 90}px, 0)`
      }
      if (heroCtaRef.current) {
        heroCtaRef.current.style.opacity = String(1 - out)
        heroCtaRef.current.style.transform = `translate3d(0, ${out * 70}px, 0)`
      }

      // Panel: aparece al terminar de recogerse y luego gira sobre su eje.
      const appear = between(state.p, PHASES.rankIn)
      const flip = between(state.p, PHASES.flip)
      if (panelRef.current) {
        // easeInOut y no easeOut: un giro que arranca de golpe parece un corte.
        const deg = easeInOut(flip) * 180
        // La perspectiva se cierra a mitad de giro: da peso de objeto.
        const persp = lerp(1500, 1050, Math.sin(flip * Math.PI))
        const away = Math.sin(flip * Math.PI) * 120
        // Si el contenido no cabe en la ventana, el panel entero se encoge:
        // mas vale un ranking pequeno que uno recortado por arriba.
        const natural = state.panelHeight || panelRef.current.scrollHeight
        const fit = Math.min(1, (window.innerHeight - 96) / Math.max(natural, 1))
        panelRef.current.style.transform = `perspective(${persp}px) translateZ(${-away}px) rotateY(${deg}deg) scale(${fit.toFixed(3)})`
        panelRef.current.style.opacity = String(easeOut(appear))
        panelRef.current.style.pointerEvents = appear > 0.9 ? 'auto' : 'none'
      }
      // backface-visibility no basta: los hijos de una cara no lo heredan y el
      // ranking seguia viendose en espejo detras. Se decide a mano quien manda.
      const showingBack = easeInOut(flip) * 180 > 90
      if (frontRef.current) frontRef.current.style.visibility = showingBack ? 'hidden' : 'visible'
      if (backFaceRef.current) backFaceRef.current.style.visibility = showingBack ? 'visible' : 'hidden'

      // El contenido de la cara trasera entra escalonado tras cruzar el ecuador.
      // La cara en si no se toca: su rotateY(180deg) vive en el CSS y backface
      // se encarga de ocultarla antes de tiempo.
      if (backInnerRef.current) {
        const reveal = between(flip, [0.52, 0.9])
        backInnerRef.current.style.opacity = String(reveal)
        backInnerRef.current.style.transform = `translate3d(0, ${(1 - reveal) * 26}px, 0)`
      }

      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [isStatic, creators])

  const pause = () => (loop.current.paused = true)
  const resume = () => (loop.current.paused = false)

  // -------------------------------------------------------------------------
  // Version sin escena: mismo contenido, apilado. Para movil y para quien pide
  // menos movimiento. No es una degradacion, es la version correcta ahi.
  // -------------------------------------------------------------------------
  if (isStatic) {
    return (
      <div className="relative min-h-screen bg-ink">
        <Backdrop />
        <Header />
        <main className="relative">
          <section className="px-5 pb-14 pt-[22vh] text-center">
            <h1 className="landing-title text-[clamp(64px,19vw,110px)] font-black leading-[0.85] tracking-[-0.055em] text-white">
              mikro
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-[16px] font-semibold text-white/55">
              Marcas que conectan. Creadores que inspiran.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Link to="/registro?rol=creador" className="w-full max-w-xs rounded-2xl bg-white px-6 py-3.5 text-center text-[15px] font-black text-ink">
                Soy creador
              </Link>
              <Link to="/registro?rol=empresa" className="w-full max-w-xs rounded-2xl border border-white/20 bg-white/[0.06] px-6 py-3.5 text-center text-[15px] font-black text-white">
                Soy empresa
              </Link>
            </div>
          </section>

          <section className="pb-16">
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 no-scrollbar">
              {creators.map((c, i) => (
                <div key={c.id} className="relative h-[300px] w-[214px] shrink-0 snap-center">
                  <PostCard creator={c} live={i === 0} hours={(i % 5) + 1} className="!static !left-0 !top-0 h-full w-full" />
                </div>
              ))}
            </div>
          </section>

          <section className="px-5 pb-16">
            <Podium creators={creators} />
          </section>

          <section className="px-5 pb-20">
            <BrandsFace stats={stats} />
          </section>
        </main>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Escena completa
  // -------------------------------------------------------------------------
  const LABELS = ['Creadores', 'Ranking', 'Empresas']

  return (
    <div className="relative h-screen overflow-hidden bg-ink">
      <Header />

      <div className="relative h-full">
        <div className="relative h-full overflow-hidden">
          <Backdrop auroraRef={auroraRef} gridRef={gridRef} />

          <HeroCopy innerRef={heroCopyRef} />

          {/* Escenario de las tarjetas: el centro de este div es el origen de
              coordenadas de toda la mecanica. */}
          <div
            ref={orbitRef}
            className="absolute inset-0 z-10"
            style={{ perspective: '1500px' }}
            onMouseEnter={pause}
            onMouseLeave={resume}
            onFocusCapture={pause}
            onBlurCapture={resume}
          >
            <div className="absolute left-1/2 top-[54%] h-0 w-0" style={{ transformStyle: 'preserve-3d' }}>
              {creators.map((c, i) => (
                <PostCard
                  key={c.id}
                  creator={c}
                  live={i === 0}
                  hours={(i % 5) + 1}
                  innerRef={(el) => (cardRefs.current[i] = el)}
                  style={{
                    width: sceneMetrics(typeof window !== 'undefined' ? window.innerWidth : 1440).card.w,
                    height: sceneMetrics(typeof window !== 'undefined' ? window.innerWidth : 1440).card.h,
                    marginLeft: -sceneMetrics(typeof window !== 'undefined' ? window.innerWidth : 1440).card.w / 2,
                    marginTop: -sceneMetrics(typeof window !== 'undefined' ? window.innerWidth : 1440).card.h / 2,
                  }}
                />
              ))}
            </div>
          </div>

          <HeroCta innerRef={heroCtaRef} />

          {/* El panel que se da la vuelta. */}
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center px-6">
            <div
              ref={panelRef}
              className="landing-panel relative w-full max-w-4xl opacity-0"
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div ref={frontRef} className="landing-face">
                <Podium creators={creators} slotRefs={slotRefs} />
              </div>
              <div ref={backFaceRef} className="landing-face landing-face-back" style={{ visibility: 'hidden' }}>
                <div ref={backInnerRef} className="w-full opacity-0">
                  <BrandsFace stats={stats} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Indicador de seccion: sin barra de scroll hay que decir de alguna
          manera que esto tiene tres paradas, y permitir saltar a cualquiera. */}
      <nav aria-label="Secciones" className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-3 lg:flex">
        {LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => goTo(i)}
            aria-current={section === i ? 'true' : undefined}
            className="group flex items-center gap-2.5"
          >
            <span
              className={`text-[11px] font-bold uppercase tracking-wider transition ${
                section === i ? 'text-white/70' : 'text-white/0 group-hover:text-white/40'
              }`}
            >
              {label}
            </span>
            <span
              className={`block rounded-full transition-all duration-500 ${
                section === i ? 'h-6 w-1.5 bg-white' : 'h-1.5 w-1.5 bg-white/30 group-hover:bg-white/60'
              }`}
            />
          </button>
        ))}
      </nav>

      {/* Pista de avance: solo mientras no se haya movido nadie. */}
      <button
        type="button"
        onClick={() => goTo(section + 1)}
        className={`fixed inset-x-0 bottom-5 z-40 mx-auto flex w-fit flex-col items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white/35 transition-opacity duration-500 ${
          section === 0 ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        Desliza
        <ChevronDown size={15} className="landing-hint" />
      </button>

      <footer className="pointer-events-none fixed inset-x-0 bottom-4 z-30 px-6">
        <p className="pointer-events-auto text-left text-[11.5px] text-white/20">
          © {new Date().getFullYear()} Mikro ·{' '}
          <Link to="/recursos" className="hover:text-white/50">
            Recursos
          </Link>
        </p>
      </footer>
    </div>
  )
}
