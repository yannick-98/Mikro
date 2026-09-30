import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, LayoutGrid, List, Search, Sparkles, SlidersHorizontal, Users, X, Zap } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../store/auth'
import Layout from '../components/Layout'
import Filters, { EMPTY_FILTERS, countActiveFilters } from '../components/Filters'
import { CreatorCard, CreatorMini, CreatorRow, CreatorRowSkeleton } from '../components/CreatorRow'
import { Avatar, Delta, EmptyState, Modal, Select, Spinner, Thumb, Toast, useAsync, useToast } from '../components/ui'
import { formatFollowers, formatNumber } from '../lib/format'

const TABS = [
  { id: 'top', label: 'Top creadores' },
  { id: 'rising', label: 'En ascenso' },
  { id: 'new', label: 'Nuevos' },
]

const SORTS = [
  { value: 'relevance', label: 'Mas relevantes' },
  { value: 'followers', label: 'Mas seguidores' },
  { value: 'engagement', label: 'Mayor engagement' },
  { value: 'rating', label: 'Mejor valorados' },
  { value: 'price', label: 'Precio mas bajo' },
]

const CATEGORY_TONES = {
  Fitness: 'from-rose-500 to-rose-800',
  Moda: 'from-violet-500 to-violet-800',
  Gastronomia: 'from-amber-500 to-orange-700',
  Viajes: 'from-sky-500 to-sky-800',
  Gaming: 'from-fuchsia-500 to-purple-800',
  Tecnologia: 'from-slate-500 to-slate-800',
  Lifestyle: 'from-emerald-500 to-emerald-800',
  Belleza: 'from-pink-500 to-pink-800',
  Humor: 'from-yellow-500 to-amber-700',
  Musica: 'from-indigo-500 to-indigo-800',
  Hogar: 'from-teal-500 to-teal-800',
  Mascotas: 'from-lime-500 to-green-800',
  Familia: 'from-cyan-500 to-cyan-800',
  Finanzas: 'from-blue-500 to-blue-900',
}

// ---------------------------------------------------------------------------

function Hero({ query, setQuery, onSearch, onAiSearch, inputRef, stats }) {
  return (
    <section className="relative -mt-[68px] overflow-hidden bg-ink pt-[68px] text-white">
      {/* Fondo: degradados en capas, sin depender de imagenes externas */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_82%_-5%,rgba(37,99,235,0.42),transparent_62%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(700px_420px_at_12%_105%,rgba(139,92,246,0.24),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,#0b0d12_38%,rgba(11,13,18,0.6)_62%,rgba(11,13,18,0.9)_100%)]" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-[1480px] px-4 pb-10 pt-12 sm:px-6 lg:px-8 lg:pb-14 lg:pt-16">
        <div className="grid items-start gap-10 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-white/45">El ranking de los creadores</p>
            <h1 className="mt-4 max-w-2xl text-[40px] font-black leading-[1.03] tracking-[-0.035em] sm:text-[54px] lg:text-[62px]">
              Encuentra el talento
              <br />
              que tu marca <span className="text-brand-500">necesita.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[15.5px] leading-relaxed text-white/60">
              Busca, filtra y conecta con micro-influencers que de verdad mueven a su comunidad. Sin agencias, sin
              intermediarios y a precio de pyme.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                onSearch()
              }}
              className="mt-8 flex max-w-2xl items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-2 backdrop-blur-sm transition focus-within:border-white/25 focus-within:bg-white/10"
            >
              <Search size={19} className="ml-3 shrink-0 text-white/40" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder='Ej. "creadores de gastronomia en Valencia con 20k-100k seguidores"'
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[14.5px] text-white outline-none placeholder:text-white/35"
              />
              <button type="submit" className="shrink-0 rounded-xl bg-brand-600 px-6 py-3 text-[14px] font-bold text-white transition hover:bg-brand-700">
                Buscar
              </button>
            </form>

            <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-2 text-[13px] font-semibold text-white/45">
              <span className="inline-flex items-center gap-2">
                <Users size={15} className="text-brand-400" />
                {formatNumber(stats?.creators || 0)} creadores
              </span>
              <span className="inline-flex items-center gap-2">
                <Zap size={15} className="text-brand-400" />
                {formatFollowers(stats?.totalReach || 0)} de alcance
              </span>
              <span className="inline-flex items-center gap-2">
                <Sparkles size={15} className="text-brand-400" />
                {stats?.avgEngagement || 0}% engagement medio
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onAiSearch}
            className="group w-full rounded-2xl border border-white/12 bg-white/[0.07] p-6 text-left backdrop-blur-sm transition hover:border-brand-500/50 hover:bg-white/[0.11] lg:mt-16"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600/25 text-brand-300">
                <Sparkles size={20} />
              </div>
              <div className="flex-1">
                <p className="text-[16px] font-extrabold tracking-tight">Buscar con IA</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/55">
                  Describe lo que necesitas en una frase y te proponemos los perfiles que mejor encajan, con su porcentaje
                  de afinidad.
                </p>
              </div>
              <ArrowRight size={19} className="mt-1 shrink-0 text-white/35 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        </div>
      </div>
    </section>
  )
}

function CategoryStrip({ cards, selected, onSelect }) {
  const scroller = useRef(null)

  return (
    <div className="relative -mt-8 pb-2">
      <div className="mx-auto max-w-[1480px] px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl border border-black/[0.06] bg-white p-2 shadow-lift">
          <div ref={scroller} className="flex gap-1.5 overflow-x-auto scroll-smooth no-scrollbar">
            <button
              type="button"
              onClick={() => onSelect(null)}
              className={clsx(
                'flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-[13.5px] font-bold transition',
                !selected ? 'bg-ink text-white' : 'text-ink/60 hover:bg-black/[0.04]',
              )}
            >
              <LayoutGrid size={16} />
              Todos
            </button>
            {cards.map((card) => (
              <button
                key={card.name}
                type="button"
                onClick={() => onSelect(selected === card.name ? null : card.name)}
                className={clsx(
                  'flex shrink-0 items-center gap-2.5 rounded-xl py-1.5 pl-1.5 pr-4 text-[13.5px] font-bold transition',
                  selected === card.name ? 'bg-ink text-white' : 'text-ink/60 hover:bg-black/[0.04]',
                )}
              >
                <Thumb
                  src={card.imageUrl}
                  seed={card.name}
                  className={clsx('h-9 w-9 rounded-lg bg-gradient-to-br', CATEGORY_TONES[card.name] || 'from-slate-400 to-slate-700')}
                />
                {card.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => scroller.current?.scrollBy({ left: 320, behavior: 'smooth' })}
            className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-black/10 bg-white text-ink/50 shadow-card transition hover:text-ink md:flex"
            aria-label="Ver mas categorias"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function AiSearchModal({ open, onClose, onResults }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [examples, setExamples] = useState([])

  useEffect(() => {
    if (open && !examples.length) api.examples().then((r) => setExamples(r.examples)).catch(() => {})
  }, [open, examples.length])

  async function run(text) {
    const q = (text ?? query).trim()
    if (!q) return
    setLoading(true)
    try {
      const res = await api.aiSearch(q)
      onResults(res)
      onClose()
      setQuery('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Buscar con IA" width="max-w-2xl">
      <p className="-mt-1 mb-4 text-[14px] leading-relaxed text-ink/60">
        Escribe lo que necesitas como se lo contarias a un compañero. Interpretamos categoria, ciudad, tamano de
        audiencia, plataforma y presupuesto.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          run()
        }}
      >
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Necesito creadores de gastronomia en Valencia, entre 20k y 100k seguidores, para promocionar un obrador artesano. Presupuesto 300 euros."
          className="field resize-none !text-[14px]"
        />
        <button type="submit" disabled={loading || !query.trim()} className="btn-primary mt-3 w-full !py-3">
          {loading ? <Spinner size={16} /> : <Sparkles size={16} />}
          {loading ? 'Analizando...' : 'Buscar creadores'}
        </button>
      </form>

      {examples.length ? (
        <div className="mt-6">
          <p className="mb-2.5 text-[12px] font-bold uppercase tracking-wide text-ink/35">Prueba con</p>
          <div className="space-y-1.5">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => run(ex)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-black/[0.07] px-3.5 py-2.5 text-left text-[13px] font-medium text-ink/70 transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-ink"
              >
                <Search size={14} className="shrink-0 text-ink/30" />
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}

function MoversWidget() {
  const { data } = useAsync(() => api.movers(5), [])
  if (!data?.items?.length) return null

  return (
    <div className="card p-4">
      <h3 className="mb-2 flex items-center gap-2 px-1 text-[14px] font-extrabold tracking-tight">
        <Zap size={15} className="text-amber-500" fill="currentColor" />
        Movimientos de hoy
      </h3>
      <div className="space-y-0.5">
        {data.items.map((c) => (
          <CreatorMini key={c.id} creator={c} right={<Delta value={c.rankDelta} />} />
        ))}
      </div>
    </div>
  )
}

function BrandCta() {
  const { user } = useAuth()
  if (user) return null
  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink p-6 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(400px_220px_at_85%_0%,rgba(37,99,235,0.45),transparent_65%)]" />
      <div className="relative">
        <h3 className="text-[21px] font-black leading-tight tracking-tight">
          Las marcas
          <br />
          buscan talento aqui.
        </h3>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/55">
          Publica tu campana gratis y recibe candidaturas de creadores en menos de 24 horas.
        </p>
        <Link
          to="/registro?rol=empresa"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-bold text-ink transition hover:bg-white/90"
        >
          Registrate como empresa
          <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  )
}

function LiveStats({ stats }) {
  if (!stats) return null
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[34px] font-black leading-none tracking-tight">{stats.searchingToday}</p>
          <p className="mt-1.5 text-[12.5px] font-semibold leading-snug text-ink/50">
            empresas buscando
            <br />
            creadores hoy
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-black/5 pt-4 text-center">
        <div>
          <p className="text-[17px] font-black">{stats.openCampaigns}</p>
          <p className="text-[11px] font-semibold text-ink/45">campanas abiertas</p>
        </div>
        <div>
          <p className="text-[17px] font-black">{formatNumber(stats.brands)}</p>
          <p className="text-[11px] font-semibold text-ink/45">empresas activas</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export default function Discover() {
  const { isBrand } = useAuth()
  const { toast, show, dismiss } = useToast()
  const [params, setParams] = useSearchParams()
  const inputRef = useRef(null)

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [tab, setTab] = useState('top')
  const [sort, setSort] = useState('relevance')
  const [view, setView] = useState('list')
  const [page, setPage] = useState(1)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiResult, setAiResult] = useState(null)
  const [mobileFilters, setMobileFilters] = useState(false)

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  const { data: facets } = useAsync(() => api.facets(), [])
  const { data: stats } = useAsync(() => api.homeStats(), [])

  // Foco en el buscador cuando se llega desde la lupa de la cabecera
  useEffect(() => {
    if (params.get('focus')) {
      inputRef.current?.focus()
      inputRef.current?.scrollIntoView({ block: 'center' })
      params.delete('focus')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const searchParams = useMemo(
    () => ({
      q: query || undefined,
      categories: filters.categories,
      cities: filters.cities,
      platforms: filters.platforms,
      minFollowers: filters.minFollowers,
      maxFollowers: filters.maxFollowers,
      minEngagement: filters.minEngagement,
      audienceCountry: filters.audienceCountry || undefined,
      language: filters.language || undefined,
      tab,
      sort,
      page,
      pageSize: 10,
    }),
    [query, filters, tab, sort, page],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.creators(searchParams)
      setResult(res)
    } catch {
      show.error('No hemos podido cargar los creadores')
    } finally {
      setLoading(false)
    }
  }, [searchParams, show])

  useEffect(() => {
    if (aiResult) return
    load()
  }, [load, aiResult])

  // Cualquier cambio de criterio vuelve a la primera pagina
  useEffect(() => setPage(1), [filters, tab, sort])

  function runTextSearch() {
    setAiResult(null)
    setPage(1)
    load()
  }

  function applyAiResult(res) {
    setAiResult(res)
    // Los filtros deducidos se vuelcan al panel lateral para poder afinarlos
    setFilters({
      ...EMPTY_FILTERS,
      categories: res.filters.categories || [],
      cities: res.filters.cities || [],
      platforms: res.filters.platforms || [],
      minFollowers: res.filters.minFollowers,
      maxFollowers: res.filters.maxFollowers,
      minEngagement: res.filters.minEngagement,
    })
  }

  async function toggleSave(creator) {
    if (!isBrand) {
      show.info('Inicia sesion como empresa para guardar creadores')
      return
    }
    setSavingId(creator.id)
    try {
      const { saved } = await api.toggleSaved(creator.id)
      const update = (items) => items.map((c) => (c.id === creator.id ? { ...c, saved } : c))
      if (aiResult) setAiResult((r) => ({ ...r, items: update(r.items) }))
      setResult((r) => (r ? { ...r, items: update(r.items) } : r))
      show.success(saved ? 'Creador guardado' : 'Creador quitado de guardados')
    } catch {
      show.error('No hemos podido guardar el creador')
    } finally {
      setSavingId(null)
    }
  }

  const shown = aiResult || result
  const items = shown?.items || []
  const activeFilters = countActiveFilters(filters)

  return (
    <Layout transparentHeader>
      <Hero
        query={query}
        setQuery={setQuery}
        onSearch={runTextSearch}
        onAiSearch={() => setAiOpen(true)}
        inputRef={inputRef}
        stats={stats}
      />

      <CategoryStrip
        cards={facets?.categoryCards || []}
        selected={filters.categories[0] || null}
        onSelect={(c) => {
          setAiResult(null)
          setFilters({ ...filters, categories: c ? [c] : [] })
        }}
      />

      <div className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8 2xl:max-w-[1720px]">
        <div className="grid gap-5 lg:grid-cols-[224px_minmax(0,1fr)] 2xl:grid-cols-[224px_minmax(0,1fr)_244px]">
          <Filters
            value={filters}
            onChange={(f) => {
              setAiResult(null)
              setFilters(f)
            }}
            facets={facets}
            className="hidden self-start lg:sticky lg:top-24 lg:block"
          />

          <div className="min-w-0">
            {aiResult ? (
              <div className="mb-5 rounded-2xl border border-brand-200 bg-brand-50/60 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
                      <Sparkles size={17} />
                    </div>
                    <div>
                      <p className="text-[14px] font-extrabold tracking-tight text-ink">Busqueda con IA</p>
                      <p className="mt-0.5 text-[13px] italic text-ink/55">"{aiResult.query}"</p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {aiResult.interpretation.map((i) => (
                          <span key={i} className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-bold text-brand-700 shadow-sm">
                            {i}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAiResult(null)
                      setFilters(EMPTY_FILTERS)
                    }}
                    className="rounded-lg p-1.5 text-ink/35 transition hover:bg-white hover:text-ink"
                    aria-label="Quitar busqueda con IA"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.07]">
              <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setAiResult(null)
                      setTab(t.id)
                    }}
                    className={clsx('tab', tab === t.id && !aiResult && 'tab-active')}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 pb-2">
                <button
                  type="button"
                  onClick={() => setMobileFilters(true)}
                  className="btn-ghost !px-3 !py-2 !text-[12.5px] lg:hidden"
                >
                  <SlidersHorizontal size={14} />
                  Filtros
                  {activeFilters > 0 ? (
                    <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-black text-white">{activeFilters}</span>
                  ) : null}
                </button>

                <div className="hidden items-center gap-1.5 sm:flex">
                  <span className="text-[12.5px] font-semibold text-ink/45">Ordenar por</span>
                  <Select
                    value={sort}
                    onChange={(v) => {
                      setAiResult(null)
                      setSort(v)
                    }}
                    options={SORTS}
                    className="!w-auto !py-1.5 !text-[12.5px] !font-semibold"
                  />
                </div>

                <div className="hidden rounded-xl border border-black/10 p-0.5 md:flex">
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className={clsx('rounded-lg p-1.5 transition', view === 'list' ? 'bg-ink text-white' : 'text-ink/40 hover:text-ink')}
                    aria-label="Ver en lista"
                  >
                    <List size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('grid')}
                    className={clsx('rounded-lg p-1.5 transition', view === 'grid' ? 'bg-ink text-white' : 'text-ink/40 hover:text-ink')}
                    aria-label="Ver en tarjetas"
                  >
                    <LayoutGrid size={15} />
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[19px] font-extrabold tracking-tight">
                {aiResult ? 'Resultados de tu busqueda' : TABS.find((t) => t.id === tab)?.label}
              </h2>
              <p className="text-[12.5px] font-semibold text-ink/45">
                {loading ? 'Buscando...' : `${formatNumber(shown?.total || 0)} creadores encontrados`}
              </p>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <CreatorRowSkeleton key={i} />
                ))}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No hemos encontrado creadores"
                description="Prueba a quitar algun filtro o a buscar con otras palabras. Tambien puedes describir lo que necesitas con la busqueda por IA."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setFilters(EMPTY_FILTERS)
                      setQuery('')
                      setAiResult(null)
                    }}
                    className="btn-dark"
                  >
                    Limpiar busqueda
                  </button>
                }
              />
            ) : view === 'list' ? (
              <div className="space-y-3">
                {items.map((c, i) => (
                  <CreatorRow
                    key={c.id}
                    creator={c}
                    position={aiResult ? i + 1 : c.rankPosition || c.listPosition}
                    onToggleSave={toggleSave}
                    saving={savingId === c.id}
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((c) => (
                  <CreatorCard key={c.id} creator={c} onToggleSave={toggleSave} />
                ))}
              </div>
            )}

            {!loading && shown?.pages > 1 ? (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    setAiResult(null)
                    setPage((p) => p - 1)
                  }}
                  className="btn-ghost !px-3.5"
                >
                  Anterior
                </button>
                <span className="px-3 text-[13px] font-bold text-ink/55">
                  {shown.page} de {shown.pages}
                </span>
                <button
                  type="button"
                  disabled={page >= shown.pages}
                  onClick={() => {
                    setAiResult(null)
                    setPage((p) => p + 1)
                  }}
                  className="btn-ghost !px-3.5"
                >
                  Siguiente
                </button>
              </div>
            ) : null}
          </div>

          <div className="hidden space-y-4 2xl:block">
            <MoversWidget />
            <BrandCta />
            <LiveStats stats={stats} />
          </div>
        </div>
      </div>

      <AiSearchModal open={aiOpen} onClose={() => setAiOpen(false)} onResults={applyAiResult} />

      <Modal open={mobileFilters} onClose={() => setMobileFilters(false)} title="Filtros" width="max-w-md">
        <Filters
          value={filters}
          onChange={(f) => {
            setAiResult(null)
            setFilters(f)
          }}
          facets={facets}
          className="!border-0 !p-0 !shadow-none"
          onClose={() => setMobileFilters(false)}
        />
      </Modal>

      <Toast toast={toast} onDismiss={dismiss} />
    </Layout>
  )
}
