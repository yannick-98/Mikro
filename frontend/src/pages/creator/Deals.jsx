import { useAuth } from '../../store/auth'
import { DashboardShell } from '../../components/Dashboard'
import DealsView from '../../components/DealsView'
import { CREATOR_NAV } from './nav'

export default function CreatorDeals() {
  const { user } = useAuth()
  return (
    <DashboardShell
      title="Mis colaboraciones"
      subtitle="Aqui ves el dinero en garantia, los plazos y las entregas pendientes."
      nav={CREATOR_NAV}
    >
      <DealsView role="CREATOR" meId={user?.id} />
    </DashboardShell>
  )
}
