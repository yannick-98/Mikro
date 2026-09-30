import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { useAuth } from '../../store/auth'
import { DashboardShell } from '../../components/Dashboard'
import { Spinner, Toast, useAsync, useToast } from '../../components/ui'
import { BRAND_NAV } from './nav'

const TEAM_SIZES = ['1-5', '6-20', '21-50', '50+']

export default function BrandProfile() {
  const { refresh } = useAuth()
  const { toast, show, dismiss } = useToast()
  const { data, loading } = useAsync(() => api.myBrand(), [])
  const { data: facets } = useAsync(() => api.facets(), [])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data?.brand) setForm(data.brand)
  }, [data])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.updateBrand({
        companyName: form.companyName,
        sector: form.sector,
        city: form.city,
        website: form.website || undefined,
        description: form.description || undefined,
        teamSize: form.teamSize || undefined,
        monthlyBudget: form.monthlyBudget ? Number(form.monthlyBudget) : undefined,
        vatNumber: form.vatNumber || undefined,
      })
      await refresh()
      show.success('Datos guardados')
    } catch (err) {
      show.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form) {
    return (
      <DashboardShell title="Mi empresa" nav={BRAND_NAV}>
        <div className="flex justify-center py-20">
          <Spinner size={26} className="text-brand-600" />
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell
      title="Mi empresa"
      subtitle="Estos datos los ven los creadores cuando reciben tu propuesta."
      nav={BRAND_NAV}
    >
      <form onSubmit={submit} className="card max-w-2xl space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Nombre de la empresa</label>
            <input required value={form.companyName || ''} onChange={set('companyName')} className="field" />
          </div>
          <div>
            <label className="label">Sector</label>
            <input value={form.sector || ''} onChange={set('sector')} className="field" placeholder="Alimentacion" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Ciudad</label>
            <select value={form.city || ''} onChange={set('city')} className="field">
              {(facets?.cities || []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tamano del equipo</label>
            <select value={form.teamSize || ''} onChange={set('teamSize')} className="field">
              <option value="">Sin indicar</option>
              {TEAM_SIZES.map((t) => (
                <option key={t} value={t}>
                  {t} personas
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Web</label>
          <input value={form.website || ''} onChange={set('website')} className="field" placeholder="https://www.tuempresa.es" />
        </div>

        <div>
          <label className="label">Descripcion</label>
          <textarea
            rows={4}
            value={form.description || ''}
            onChange={set('description')}
            className="field resize-none"
            placeholder="Que hace tu empresa, donde y que la diferencia. Los creadores leen esto antes de aceptar."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Presupuesto mensual orientativo (EUR)</label>
            <input
              type="number"
              min={0}
              value={form.monthlyBudget || ''}
              onChange={set('monthlyBudget')}
              className="field"
              placeholder="800"
            />
          </div>
          <div>
            <label className="label">CIF / NIF</label>
            <input value={form.vatNumber || ''} onChange={set('vatNumber')} className="field" placeholder="B12345678" />
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-black/[0.06] pt-5">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Spinner size={16} /> : null}
            Guardar cambios
          </button>
          {form.verified ? (
            <span className="text-[13px] font-bold text-emerald-600">Empresa verificada</span>
          ) : (
            <span className="text-[13px] text-ink/45">Completa los datos fiscales para verificar la cuenta.</span>
          )}
        </div>
      </form>
      <Toast toast={toast} onDismiss={dismiss} />
    </DashboardShell>
  )
}
