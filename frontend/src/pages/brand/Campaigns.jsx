import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, BarChart3, Megaphone, Plus, Wand2 } from 'lucide-react'
import { api } from '../../api/client'
import { DashboardShell, StatusPill } from '../../components/Dashboard'
import { EmptyState, Modal, Spinner, Toast, useAsync, useToast } from '../../components/ui'
import AsistenteBrief from '../../components/AsistenteBrief'
import PrecioReferencia from '../../components/PrecioReferencia'
import ModeloDePago, { OfertaResumen } from '../../components/ModeloDePago'
import FichaProducto from '../../components/FichaProducto'
import { CAMPAIGN_STATUS, formatDate, formatEuro } from '../../lib/format'
import { BRAND_NAV } from './nav'

const FILTERS = [
  { id: 'ALL', label: 'Todas' },
  { id: 'OPEN', label: 'Abiertas' },
  { id: 'CLOSED', label: 'Cerradas' },
  { id: 'COMPLETED', label: 'Completadas' },
  { id: 'DRAFT', label: 'Borradores' },
]

const EMPTY = {
  title: '',
  brief: '',
  kind: 'PRODUCT',
  payModel: 'FIXED',
  commissionPct: 10,
  discountPct: 0,
  discountType: 'PERCENTAGE',
  productName: '',
  productUrl: '',
  productImage: '',
  productSku: '',
  shipsProduct: false,
  category: 'Gastronomia',
  deliverables: '1 reel, 3 stories',
  budgetMin: 150,
  budgetMax: 400,
  targetCity: '',
  minFollowers: 5000,
  maxFollowers: 100000,
  platforms: ['instagram'],
  productValue: 0,
  status: 'OPEN',
}

function CampaignForm({ open, onClose, onCreated, facets, tieneTienda }) {
  const [asistente, setAsistente] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const setNum = (k) => (e) => setForm({ ...form, [k]: Number(e.target.value) })

  function togglePlatform(p) {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p],
    }))
  }

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const { campaign } = await api.createCampaign({
        ...form,
        // Una campana sin fijo manda cero: dejar el presupuesto que hubiera
        // quedado en el formulario publicaria un importe que nadie va a pagar.
        budgetMin: form.payModel === 'VARIABLE' ? 0 : Number(form.budgetMin),
        budgetMax: form.payModel === 'VARIABLE' ? 0 : Number(form.budgetMax),
        commissionPct: form.payModel === 'FIXED' ? 0 : Number(form.commissionPct),
        discountPct: form.kind === 'SERVICE' ? 0 : Number(form.discountPct),
        discountType: form.discountType,
        // La ficha del producto no viaja en una campana de servicio.
        ...(form.kind === 'PRODUCT'
          ? {
              productName: form.productName || undefined,
              productUrl: form.productUrl || undefined,
              productImage: form.productImage || undefined,
              productSku: form.productSku || undefined,
              shipsProduct: form.shipsProduct,
            }
          : { shipsProduct: false }),
        minFollowers: Number(form.minFollowers),
        maxFollowers: Number(form.maxFollowers),
        productValue: Number(form.productValue),
        platforms: form.platforms.join(','),
        targetCity: form.targetCity || undefined,
      })
      onCreated(campaign)
      setForm(EMPTY)
      onClose()
    } catch (err) {
      setError(err.details?.[0]?.message || err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva campana" width="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Titulo</label>
          <input required value={form.title} onChange={set('title')} className="field" placeholder="Lanzamiento de nuestra masa madre" />
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="label !mb-0">Brief</label>
            <button
              type="button"
              onClick={() => setAsistente(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-[12px] font-bold text-brand-700 transition hover:bg-brand-100"
            >
              <Wand2 size={13} /> Ayúdame a escribirlo
            </button>
          </div>
          <textarea
            required
            rows={5}
            value={form.brief}
            onChange={set('brief')}
            className="field resize-none"
            placeholder="Que buscas, que incluye la colaboracion, que esperas del contenido y que NO quieres. Cuanto mas concreto, mejores candidaturas."
          />
          <p className="mt-1.5 text-[12px] text-ink/45">{form.brief.length} caracteres (minimo 20)</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Categoria</label>
            <select value={form.category} onChange={set('category')} className="field">
              {(facets?.categories || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ciudad objetivo</label>
            <select value={form.targetCity} onChange={set('targetCity')} className="field">
              <option value="">Toda Espana</option>
              {(facets?.cities || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Entregables</label>
          <input required value={form.deliverables} onChange={set('deliverables')} className="field" placeholder="1 reel, 3 stories" />
        </div>

        <div className="rounded-2xl border border-black/[0.08] bg-black/[0.015] p-4">
          <ModeloDePago
            valor={{
              kind: form.kind,
              payModel: form.payModel,
              commissionPct: form.commissionPct,
              discountPct: form.discountPct,
              discountType: form.discountType,
            }}
            onChange={(v) => setForm((f) => ({ ...f, ...v }))}
            tieneTienda={tieneTienda}
          />
        </div>

        {form.kind === 'PRODUCT' ? (
          <div className="rounded-2xl border border-black/[0.08] bg-black/[0.015] p-4">
            <FichaProducto
              valor={{
                productName: form.productName,
                productUrl: form.productUrl,
                productImage: form.productImage,
                productSku: form.productSku,
                productValue: form.productValue,
                shipsProduct: form.shipsProduct,
              }}
              onChange={(v) => setForm((f) => ({ ...f, ...v }))}
            />
          </div>
        ) : null}

        {/* Sin importe fijo no hay presupuesto que pedir. */}
        <div className={form.payModel === 'VARIABLE' ? 'hidden' : undefined}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">
                {form.payModel === 'FIXED_VARIABLE' ? 'Importe fijo mínimo (EUR)' : 'Presupuesto minimo (EUR)'}
              </label>
              <input type="number" min={0} value={form.budgetMin} onChange={setNum('budgetMin')} className="field" />
            </div>
            <div>
              <label className="label">
                {form.payModel === 'FIXED_VARIABLE' ? 'Importe fijo máximo (EUR)' : 'Presupuesto maximo (EUR)'}
              </label>
              <input type="number" min={0} value={form.budgetMax} onChange={setNum('budgetMax')} className="field" />
            </div>
          </div>
          {/* Aqui y no en otro sitio: la cifra tiene que aparecer en el
              momento exacto en el que alguien esta decidiendo un numero. */}
          <PrecioReferencia
            mio
            className="mt-3"
            onUsar={(ref) => setForm((f) => ({ ...f, budgetMin: ref.min, budgetMax: ref.max }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Seguidores minimos</label>
            <input type="number" min={0} step={1000} value={form.minFollowers} onChange={setNum('minFollowers')} className="field" />
          </div>
          <div>
            <label className="label">Seguidores maximos</label>
            <input type="number" min={0} step={1000} value={form.maxFollowers} onChange={setNum('maxFollowers')} className="field" />
          </div>
        </div>

        <div>
          <label className="label">Plataformas</label>
          <div className="flex gap-2">
            {(facets?.platforms || ['instagram', 'tiktok', 'youtube']).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={clsx('chip !px-4 !py-2 capitalize', form.platforms.includes(p) && 'chip-active')}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* En producto, este dato lo pide la ficha de arriba. Aqui solo
            aparece para los servicios, donde tambien se puede ceder algo
            (una cena, una clase) pero no hay ficha de producto. */}
        {form.kind === 'SERVICE' ? (
          <div>
            <label className="label">Valor de lo que cedes (EUR, opcional)</label>
            <input type="number" min={0} value={form.productValue} onChange={setNum('productValue')} className="field" />
            <p className="mt-1.5 text-[12px] text-ink/45">
              Si ademas del pago entregas algo, indicalo: sube el atractivo de la campana.
            </p>
          </div>
        ) : null}

        {error ? <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[13px] font-semibold text-rose-700">{error}</p> : null}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? <Spinner size={16} /> : null}
            Publicar campana
          </button>
        </div>
      </form>
      <AsistenteBrief
        open={asistente}
        onClose={() => setAsistente(false)}
        campaign={{ targetCity: form.targetCity, budgetMin: form.budgetMin, budgetMax: form.budgetMax }}
        onListo={(b) =>
          setForm((f) => ({ ...f, title: b.titulo, brief: b.brief, deliverables: b.deliverables }))
        }
      />
    </Modal>
  )
}

export default function BrandCampaigns() {
  const nav = useNavigate()
  // Decide si esta empresa puede ofrecer pago por comision.
  const { data: miEmpresa } = useAsync(() => api.myBrand(), [])
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState('ALL')
  const [open, setOpen] = useState(false)
  const { toast, show, dismiss } = useToast()
  const { data: facets } = useAsync(() => api.facets(), [])
  const { data, loading, reload } = useAsync(() => api.campaigns({ mine: true, status: filter }), [filter])

  useEffect(() => {
    if (params.get('nueva')) {
      setOpen(true)
      params.delete('nueva')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  return (
    <DashboardShell
      title="Campanas"
      subtitle="Publica lo que necesitas y recibe candidaturas de creadores."
      nav={BRAND_NAV}
      actions={
        <button type="button" onClick={() => setOpen(true)} className="btn-primary">
          <Plus size={16} /> Nueva campana
        </button>
      }
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={clsx('chip !px-3.5 !py-1.5 !text-[12.5px] !font-bold', filter === f.id && 'chip-active')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={26} className="text-brand-600" />
        </div>
      ) : data?.items?.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No hay campanas en este filtro"
          description="Crea una campana nueva o cambia el filtro para ver las anteriores."
          action={
            <button type="button" onClick={() => setOpen(true)} className="btn-dark">
              Crear campana
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {data.items.map((c) => (
            <Link
              key={c.id}
              to={`/empresa/campanas/${c.id}`}
              className="card block p-5 transition hover:border-black/15 hover:shadow-lift"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[16px] font-extrabold tracking-tight">{c.title}</h2>
                    <StatusPill status={c.status} map={CAMPAIGN_STATUS} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 max-w-2xl text-[13.5px] leading-relaxed text-ink/55">{c.brief}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] font-semibold text-ink/50">
                    <span>{c.category}</span>
                    <span>{c.targetCity || 'Toda Espana'}</span>
                    <span>{c.deliverables.join(', ')}</span>
                    <OfertaResumen oferta={c.oferta} />
                    <span>Publicada el {formatDate(c.createdAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <div className="text-center">
                    <p className="text-[20px] font-black leading-none">{c.applicationsCount ?? 0}</p>
                    <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-ink/35">candidaturas</p>
                  </div>

                  {/* El informe solo tiene sentido cuando hay algo que
                      contar: antes de la primera colaboracion es una pagina
                      vacia que decepciona. */}
                  {c.dealsCount > 0 ? (
                    <span
                      role="link"
                      tabIndex={0}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        nav(`/empresa/campanas/${c.id}/informe`)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          e.stopPropagation()
                          nav(`/empresa/campanas/${c.id}/informe`)
                        }
                      }}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-black/[0.05] px-3 py-2 text-[12.5px] font-bold text-ink/70 transition hover:bg-black/10"
                    >
                      <BarChart3 size={14} /> Informe
                    </span>
                  ) : null}
                  <div className="text-center">
                    <p className="text-[20px] font-black leading-none">{c.dealsCount ?? 0}</p>
                    <p className="mt-1 text-[10.5px] font-bold uppercase tracking-wide text-ink/35">cerradas</p>
                  </div>
                  <ArrowRight size={17} className="text-ink/25" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CampaignForm
        open={open}
        onClose={() => setOpen(false)}
        facets={facets}
        tieneTienda={!!miEmpresa?.tienda}
        onCreated={() => {
          show.success('Campana publicada. Ya puede recibir candidaturas.')
          reload()
        }}
      />
      <Toast toast={toast} onDismiss={dismiss} />
    </DashboardShell>
  )
}
