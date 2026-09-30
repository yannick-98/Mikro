import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Eye, Plus, Trash2 } from 'lucide-react'
import { api } from '../../api/client'
import { useAuth } from '../../store/auth'
import { DashboardShell } from '../../components/Dashboard'
import { PlatformIcon, Spinner, Thumb, Toast, useAsync, useToast } from '../../components/ui'
import { formatFollowers } from '../../lib/format'
import { CREATOR_NAV } from './nav'

const PLATFORMS = ['instagram', 'tiktok', 'youtube']
const AGE_RANGES = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+']

function SocialEditor({ creator, onChange, show }) {
  const [platform, setPlatform] = useState('instagram')
  const [form, setForm] = useState({ handle: '', followers: '', engagement: '', avgViews: '' })
  const [saving, setSaving] = useState(false)

  const existing = creator.socialAccounts.find((a) => a.platform === platform)

  useEffect(() => {
    setForm(
      existing
        ? {
            handle: existing.handle,
            followers: String(existing.followers),
            engagement: String(existing.engagement),
            avgViews: String(existing.avgViews),
          }
        : { handle: '', followers: '', engagement: '', avgViews: '' },
    )
  }, [platform, existing?.handle, existing?.followers, existing?.engagement, existing?.avgViews])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { creator: updated } = await api.saveSocial({
        platform,
        handle: form.handle,
        followers: Number(form.followers),
        engagement: Number(form.engagement),
        avgViews: Number(form.avgViews || 0),
        url: `https://${platform}.com/${form.handle.replace('@', '')}`,
      })
      onChange(updated)
      show.success('Red actualizada')
    } catch (err) {
      show.error(err.details?.[0]?.message || err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    try {
      const { creator: updated } = await api.removeSocial(platform)
      onChange(updated)
      show.info('Red eliminada')
    } catch (err) {
      show.error(err.message)
    }
  }

  return (
    <section className="card p-6">
      <h2 className="text-[16px] font-extrabold tracking-tight">Mis redes</h2>
      <p className="mt-1 text-[13.5px] text-ink/55">
        Los datos que declares aqui alimentan tu posicion en el ranking y el match con las campanas.
      </p>

      <div className="mt-4 flex gap-2">
        {PLATFORMS.map((p) => {
          const acc = creator.socialAccounts.find((a) => a.platform === p)
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={clsx(
                'flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 transition',
                platform === p ? 'border-ink bg-ink text-white' : 'border-black/[0.08] hover:border-black/20',
              )}
            >
              <PlatformIcon platform={p} size={20} />
              <span className="text-[12px] font-bold capitalize">{p}</span>
              <span className={clsx('text-[11px] font-semibold', platform === p ? 'text-white/60' : 'text-ink/40')}>
                {acc ? formatFollowers(acc.followers) : 'sin conectar'}
              </span>
            </button>
          )
        })}
      </div>

      <form onSubmit={save} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Usuario</label>
            <input required value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} className="field" placeholder="@tuusuario" />
          </div>
          <div>
            <label className="label">Seguidores</label>
            <input
              required
              type="number"
              min={0}
              value={form.followers}
              onChange={(e) => setForm({ ...form, followers: e.target.value })}
              className="field"
              placeholder="24000"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Engagement (%)</label>
            <input
              required
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={form.engagement}
              onChange={(e) => setForm({ ...form, engagement: e.target.value })}
              className="field"
              placeholder="5.4"
            />
          </div>
          <div>
            <label className="label">Visitas medias por publicacion</label>
            <input
              type="number"
              min={0}
              value={form.avgViews}
              onChange={(e) => setForm({ ...form, avgViews: e.target.value })}
              className="field"
              placeholder="12000"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Spinner size={16} /> : null}
            {existing ? 'Actualizar red' : 'Conectar red'}
          </button>
          {existing ? (
            <button type="button" onClick={remove} className="btn-ghost !text-rose-600">
              <Trash2 size={15} /> Quitar
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}

function PortfolioEditor({ creator, onChange, show }) {
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [saving, setSaving] = useState(false)

  async function add(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.addPortfolio({ imageUrl: url, caption })
      const { creator: updated } = await api.myCreator()
      onChange(updated)
      setUrl('')
      setCaption('')
      show.success('Pieza anadida al portfolio')
    } catch (err) {
      show.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    try {
      await api.removePortfolio(id)
      const { creator: updated } = await api.myCreator()
      onChange(updated)
    } catch (err) {
      show.error(err.message)
    }
  }

  return (
    <section className="card p-6">
      <h2 className="text-[16px] font-extrabold tracking-tight">Portfolio</h2>
      <p className="mt-1 text-[13.5px] text-ink/55">
        Cuatro piezas bastan. Es lo primero que mira una marca antes de escribirte.
      </p>

      {creator.portfolio.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {creator.portfolio.map((p) => (
            <div key={p.id} className="group relative">
              <Thumb src={p.imageUrl} seed={p.id} className="aspect-square w-full rounded-xl" />
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-rose-600 opacity-0 transition group-hover:opacity-100"
                aria-label="Eliminar pieza"
              >
                <Trash2 size={14} />
              </button>
              {p.caption ? <p className="mt-1.5 truncate text-[12px] font-semibold text-ink/60">{p.caption}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      <form onSubmit={add} className="mt-5 grid gap-3 sm:grid-cols-[1.4fr_1fr_auto]">
        <input
          required
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="field"
          placeholder="https://... enlace a la imagen"
        />
        <input value={caption} onChange={(e) => setCaption(e.target.value)} className="field" placeholder="Titulo de la pieza" />
        <button type="submit" disabled={saving} className="btn-dark">
          {saving ? <Spinner size={15} /> : <Plus size={15} />}
          Anadir
        </button>
      </form>
    </section>
  )
}

export default function EditCreatorProfile() {
  const { refresh } = useAuth()
  const { toast, show, dismiss } = useToast()
  const { data, loading, setData } = useAsync(() => api.myCreator(), [])
  const { data: facets } = useAsync(() => api.facets(), [])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data?.creator) {
      const c = data.creator
      setForm({
        displayName: c.displayName,
        headline: c.headline || '',
        bio: c.bio || '',
        category: c.category,
        subcategories: c.subcategories.join(', '),
        city: c.city,
        languages: c.languages.join(', '),
        available: c.available,
        audienceCountry: c.audience.country,
        audienceFemalePct: c.audience.femalePct,
        audienceAgeRange: c.audience.ageRange,
        ratePost: c.rates.post,
        rateReel: c.rates.reel,
        rateStory: c.rates.story,
        rateUgc: c.rates.ugc,
        responseHours: c.responseHours,
      })
    }
  }, [data])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { creator } = await api.updateCreator({
        displayName: form.displayName,
        headline: form.headline,
        bio: form.bio,
        category: form.category,
        subcategories: form.subcategories,
        city: form.city,
        languages: form.languages,
        available: !!form.available,
        audienceCountry: form.audienceCountry,
        audienceFemalePct: Number(form.audienceFemalePct),
        audienceAgeRange: form.audienceAgeRange,
        ratePost: Number(form.ratePost),
        rateReel: Number(form.rateReel),
        rateStory: Number(form.rateStory),
        rateUgc: Number(form.rateUgc),
        responseHours: Number(form.responseHours),
      })
      setData({ creator })
      await refresh()
      show.success('Perfil actualizado')
    } catch (err) {
      show.error(err.details?.[0]?.message || err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !form || !data?.creator) {
    return (
      <DashboardShell title="Mi perfil" nav={CREATOR_NAV}>
        <div className="flex justify-center py-20">
          <Spinner size={26} className="text-brand-600" />
        </div>
      </DashboardShell>
    )
  }

  const creator = data.creator

  return (
    <DashboardShell
      title="Mi perfil"
      subtitle="Asi te ven las marcas. Cuanto mas completo, mas propuestas recibes."
      nav={CREATOR_NAV}
      actions={
        <Link to={`/creador/${creator.handle}`} className="btn-ghost">
          <Eye size={15} /> Ver perfil publico
        </Link>
      }
    >
      <div className="space-y-5">
        <form onSubmit={submit} className="card space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nombre publico</label>
              <input required value={form.displayName} onChange={set('displayName')} className="field" />
            </div>
            <div>
              <label className="label">Usuario</label>
              <input value={`@${creator.handle}`} disabled className="field !bg-black/[0.03] !text-ink/45" />
            </div>
          </div>

          <div>
            <label className="label">Titular</label>
            <input
              value={form.headline}
              onChange={set('headline')}
              className="field"
              maxLength={140}
              placeholder="Salud, deporte y una vida mas feliz."
            />
          </div>

          <div>
            <label className="label">Biografia</label>
            <textarea
              rows={4}
              value={form.bio}
              onChange={set('bio')}
              className="field resize-none"
              placeholder="Que cuentas, a quien le hablas y como trabajas con marcas."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
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
              <label className="label">Ciudad</label>
              <select value={form.city} onChange={set('city')} className="field">
                {(facets?.cities || []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Responde en (horas)</label>
              <input type="number" min={1} max={168} value={form.responseHours} onChange={set('responseHours')} className="field" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Temas (separados por comas)</label>
              <input value={form.subcategories} onChange={set('subcategories')} className="field" placeholder="recetas, restaurantes" />
            </div>
            <div>
              <label className="label">Idiomas</label>
              <input value={form.languages} onChange={set('languages')} className="field" placeholder="Espanol, Ingles" />
            </div>
          </div>

          <fieldset className="rounded-2xl border border-black/[0.07] p-4">
            <legend className="px-2 text-[13px] font-bold text-ink/70">Tarifas (EUR)</legend>
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                ['ratePost', 'Post'],
                ['rateReel', 'Reel'],
                ['rateStory', 'Stories'],
                ['rateUgc', 'UGC'],
              ].map(([k, label]) => (
                <div key={k}>
                  <label className="label">{label}</label>
                  <input type="number" min={0} value={form[k]} onChange={set(k)} className="field" />
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-black/[0.07] p-4">
            <legend className="px-2 text-[13px] font-bold text-ink/70">Audiencia</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Pais principal</label>
                <select value={form.audienceCountry} onChange={set('audienceCountry')} className="field">
                  {(facets?.audienceCountries || ['Espana']).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Edad predominante</label>
                <select value={form.audienceAgeRange} onChange={set('audienceAgeRange')} className="field">
                  {AGE_RANGES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">% de mujeres: {form.audienceFemalePct}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.audienceFemalePct}
                  onChange={set('audienceFemalePct')}
                  className="mt-3 w-full accent-brand-600"
                />
              </div>
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-black/[0.03] px-4 py-3">
            <input
              type="checkbox"
              checked={!!form.available}
              onChange={(e) => setForm({ ...form, available: e.target.checked })}
              className="h-4 w-4 rounded border-black/20 text-brand-600 focus:ring-brand-500/30"
            />
            <span className="text-[13.5px] font-semibold text-ink/75">
              Disponible para colaboraciones (si lo desactivas no apareces en las busquedas)
            </span>
          </label>

          <div className="border-t border-black/[0.06] pt-5">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Spinner size={16} /> : null}
              Guardar perfil
            </button>
          </div>
        </form>

        <SocialEditor creator={creator} onChange={(c) => setData({ creator: c })} show={show} />
        <PortfolioEditor creator={creator} onChange={(c) => setData({ creator: c })} show={show} />
      </div>

      <Toast toast={toast} onDismiss={dismiss} />
    </DashboardShell>
  )
}
