import { Briefcase, FileText, Handshake, LayoutDashboard, UserRound } from 'lucide-react'

export const CREATOR_NAV = [
  { to: '/creador', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/creador/oportunidades', label: 'Oportunidades', icon: Briefcase },
  { to: '/creador/candidaturas', label: 'Candidaturas', icon: FileText },
  { to: '/creador/colaboraciones', label: 'Colaboraciones', icon: Handshake },
  { to: '/creador/perfil', label: 'Mi perfil', icon: UserRound },
]

export default CREATOR_NAV
