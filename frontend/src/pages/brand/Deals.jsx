import { useAuth } from '../../store/auth'
import { DashboardShell } from '../../components/Dashboard'
import DealsView from '../../components/DealsView'
import { BRAND_NAV } from './nav'

export default function BrandDeals() {
  const { user } = useAuth()
  return (
    <DashboardShell
      title="Colaboraciones"
      subtitle="Sigue el estado de cada acuerdo, habla con el creador y libera el pago."
      nav={BRAND_NAV}
    >
      <DealsView role="BRAND" meId={user?.id} />
    </DashboardShell>
  )
}
