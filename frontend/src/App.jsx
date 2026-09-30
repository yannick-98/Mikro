import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './store/auth'
import { Spinner } from './components/ui'

import Discover from './pages/Discover'
import Rankings from './pages/Rankings'
import CreatorProfile from './pages/CreatorProfile'
import ForBusiness from './pages/ForBusiness'
import ForCreators from './pages/ForCreators'
import Resources from './pages/Resources'
import Login from './pages/Login'
import Register from './pages/Register'
import NotFound from './pages/NotFound'

import BrandDashboard from './pages/brand/Dashboard'
import BrandCampaigns from './pages/brand/Campaigns'
import CampaignDetail from './pages/brand/CampaignDetail'
import BrandDeals from './pages/brand/Deals'
import BrandSaved from './pages/brand/Saved'
import BrandProfile from './pages/brand/Profile'

import CreatorDashboard from './pages/creator/Dashboard'
import Opportunities from './pages/creator/Opportunities'
import MyApplications from './pages/creator/Applications'
import CreatorDeals from './pages/creator/Deals'
import EditCreatorProfile from './pages/creator/EditProfile'

import Admin from './pages/Admin'

/** Cada cambio de ruta empieza arriba del todo. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function Protected({ roles, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={28} className="text-brand-600" />
      </div>
    )
  }
  if (!user) return <Navigate to="/entrar" state={{ from: location.pathname }} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Publico */}
        <Route path="/" element={<Discover />} />
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/creador/:handle" element={<CreatorProfile />} />
        <Route path="/para-empresas" element={<ForBusiness />} />
        <Route path="/para-creadores" element={<ForCreators />} />
        <Route path="/recursos" element={<Resources />} />
        <Route path="/entrar" element={<Login />} />
        <Route path="/registro" element={<Register />} />

        {/* Empresa */}
        <Route path="/empresa" element={<Protected roles={['BRAND']}><BrandDashboard /></Protected>} />
        <Route path="/empresa/campanas" element={<Protected roles={['BRAND']}><BrandCampaigns /></Protected>} />
        <Route path="/empresa/campanas/:id" element={<Protected roles={['BRAND']}><CampaignDetail /></Protected>} />
        <Route path="/empresa/colaboraciones" element={<Protected roles={['BRAND']}><BrandDeals /></Protected>} />
        <Route path="/empresa/guardados" element={<Protected roles={['BRAND']}><BrandSaved /></Protected>} />
        <Route path="/empresa/perfil" element={<Protected roles={['BRAND']}><BrandProfile /></Protected>} />

        {/* Creador */}
        <Route path="/creador" element={<Protected roles={['CREATOR']}><CreatorDashboard /></Protected>} />
        <Route path="/creador/oportunidades" element={<Protected roles={['CREATOR']}><Opportunities /></Protected>} />
        <Route path="/creador/candidaturas" element={<Protected roles={['CREATOR']}><MyApplications /></Protected>} />
        <Route path="/creador/colaboraciones" element={<Protected roles={['CREATOR']}><CreatorDeals /></Protected>} />
        <Route path="/creador/perfil" element={<Protected roles={['CREATOR']}><EditCreatorProfile /></Protected>} />

        {/* Backoffice */}
        <Route path="/admin" element={<Protected roles={['ADMIN']}><Admin /></Protected>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
