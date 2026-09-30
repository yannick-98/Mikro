import { Bookmark, Building2, Handshake, LayoutDashboard, Megaphone } from 'lucide-react'

export const BRAND_NAV = [
  { to: '/empresa', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/empresa/campanas', label: 'Campanas', icon: Megaphone },
  { to: '/empresa/colaboraciones', label: 'Colaboraciones', icon: Handshake },
  { to: '/empresa/guardados', label: 'Guardados', icon: Bookmark },
  { to: '/empresa/perfil', label: 'Mi empresa', icon: Building2 },
]

export default BRAND_NAV
