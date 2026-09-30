/** Formateo de cifras y fechas en castellano. */

export function formatFollowers(n = 0) {
  if (n >= 1000000) {
    const v = n / 1000000
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace('.0', '').replace('.', ',')}M`
  }
  if (n >= 1000) {
    const v = n / 1000
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace('.0', '').replace('.', ',')}K`
  }
  return String(n)
}

export function formatNumber(n = 0) {
  return new Intl.NumberFormat('es-ES').format(Math.round(n))
}

export function formatEuro(n = 0, { decimals = 0 } = {}) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

export function formatPercent(n = 0) {
  return `${String(n).replace('.', ',')}%`
}

export function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

export function formatRelative(value) {
  if (!value) return ''
  const diff = Date.now() - new Date(value).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'ahora mismo'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days < 30) return `hace ${days} d`
  return formatDate(value)
}

/** Etiquetas de estado de una colaboracion. */
export const DEAL_STATUS = {
  ACCEPTED: { label: 'Aceptada', tone: 'bg-amber-100 text-amber-800', hint: 'Pendiente de deposito' },
  FUNDED: { label: 'Fondos en garantia', tone: 'bg-brand-100 text-brand-800', hint: 'El creador puede empezar' },
  IN_PROGRESS: { label: 'En produccion', tone: 'bg-violet-100 text-violet-800', hint: 'Contenido en marcha' },
  SUBMITTED: { label: 'Entregada', tone: 'bg-sky-100 text-sky-800', hint: 'Pendiente de revision' },
  APPROVED: { label: 'Aprobada', tone: 'bg-emerald-100 text-emerald-800', hint: 'Pendiente de pago' },
  PAID: { label: 'Pagada', tone: 'bg-emerald-600 text-white', hint: 'Colaboracion cerrada' },
  CANCELLED: { label: 'Cancelada', tone: 'bg-black/10 text-ink/60', hint: '' },
}

export const APPLICATION_STATUS = {
  PENDING: { label: 'Pendiente', tone: 'bg-amber-100 text-amber-800' },
  ACCEPTED: { label: 'Aceptada', tone: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'Descartada', tone: 'bg-black/10 text-ink/60' },
  WITHDRAWN: { label: 'Retirada', tone: 'bg-black/10 text-ink/60' },
}

export const CAMPAIGN_STATUS = {
  DRAFT: { label: 'Borrador', tone: 'bg-black/10 text-ink/60' },
  OPEN: { label: 'Abierta', tone: 'bg-emerald-100 text-emerald-800' },
  CLOSED: { label: 'Cerrada', tone: 'bg-amber-100 text-amber-800' },
  COMPLETED: { label: 'Completada', tone: 'bg-brand-100 text-brand-800' },
}

export const PLATFORM_LABEL = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
}
