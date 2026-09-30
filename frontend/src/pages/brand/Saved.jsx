import { Link } from 'react-router-dom'
import { Bookmark } from 'lucide-react'
import { api } from '../../api/client'
import { DashboardShell } from '../../components/Dashboard'
import { CreatorRow } from '../../components/CreatorRow'
import { EmptyState, Spinner, Toast, useAsync, useToast } from '../../components/ui'
import { BRAND_NAV } from './nav'

export default function BrandSaved() {
  const { toast, show, dismiss } = useToast()
  const { data, loading, setData } = useAsync(() => api.savedCreators(), [])

  async function toggle(creator) {
    try {
      await api.toggleSaved(creator.id)
      setData({ items: data.items.filter((c) => c.id !== creator.id) })
      show.info('Creador quitado de guardados')
    } catch {
      show.error('No hemos podido actualizar la lista')
    }
  }

  return (
    <DashboardShell
      title="Creadores guardados"
      subtitle="Tu lista corta para las proximas campanas."
      nav={BRAND_NAV}
      actions={
        <Link to="/" className="btn-ghost">
          Buscar mas creadores
        </Link>
      }
    >
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size={26} className="text-brand-600" />
        </div>
      ) : data?.items?.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Todavia no has guardado a nadie"
          description="Pulsa el marcador en cualquier creador del buscador para tenerlo aqui cuando prepares una campana."
          action={
            <Link to="/" className="btn-dark">
              Ir a Descubrir
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {data.items.map((c, i) => (
            <CreatorRow key={c.id} creator={c} position={c.rankPosition || i + 1} onToggleSave={toggle} />
          ))}
        </div>
      )}
      <Toast toast={toast} onDismiss={dismiss} />
    </DashboardShell>
  )
}
