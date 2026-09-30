/** Cliente HTTP de la API de Mikro. */

const BASE = '/api'
const TOKEN_KEY = 'mikro.token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const token = tokenStore.get()
  const res = await fetch(BASE + path, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(data.error || 'Ha ocurrido un error inesperado', res.status, data.details)
  }
  return data
}

const qs = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return
    search.set(k, Array.isArray(v) ? v.join(',') : String(v))
  })
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const api = {
  // Sesion
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),
  updateAccount: (payload) => request('/auth/me', { method: 'PATCH', body: payload }),

  // Descubrir
  creators: (params, signal) => request(`/creators${qs(params)}`, { signal }),
  creator: (handle) => request(`/creators/${handle}`),
  aiSearch: (query, page = 1) => request('/search/ai', { method: 'POST', body: { query, page } }),
  facets: () => request('/search/facets'),
  examples: () => request('/search/examples'),

  // Rankings
  rankings: (params) => request(`/rankings${qs(params)}`),
  movers: (limit = 6) => request(`/rankings/movers${qs({ limit })}`),
  collections: () => request('/rankings/collections'),
  homeStats: () => request('/stats/home'),

  // Perfil de creador
  myCreator: () => request('/creators/me'),
  updateCreator: (payload) => request('/creators/me', { method: 'PATCH', body: payload }),
  saveSocial: (payload) => request('/creators/me/social', { method: 'PUT', body: payload }),
  removeSocial: (platform) => request(`/creators/me/social/${platform}`, { method: 'DELETE' }),
  addPortfolio: (payload) => request('/creators/me/portfolio', { method: 'POST', body: payload }),
  removePortfolio: (id) => request(`/creators/me/portfolio/${id}`, { method: 'DELETE' }),
  creatorDashboard: () => request('/creator/dashboard'),

  // Empresa
  myBrand: () => request('/brands/me'),
  updateBrand: (payload) => request('/brands/me', { method: 'PATCH', body: payload }),
  brandDashboard: () => request('/brands/me/dashboard'),
  savedCreators: () => request('/brands/me/saved'),
  toggleSaved: (creatorId) => request(`/brands/me/saved/${creatorId}`, { method: 'POST' }),

  // Campanas
  campaigns: (params) => request(`/campaigns${qs(params)}`),
  campaign: (id) => request(`/campaigns/${id}`),
  createCampaign: (payload) => request('/campaigns', { method: 'POST', body: payload }),
  updateCampaign: (id, payload) => request(`/campaigns/${id}`, { method: 'PATCH', body: payload }),
  deleteCampaign: (id) => request(`/campaigns/${id}`, { method: 'DELETE' }),
  recommended: (id) => request(`/campaigns/${id}/recommended`),
  invite: (id, payload) => request(`/campaigns/${id}/invite`, { method: 'POST', body: payload }),

  // Candidaturas
  applications: () => request('/applications'),
  apply: (payload) => request('/applications', { method: 'POST', body: payload }),
  acceptApplication: (id, fee) => request(`/applications/${id}/accept`, { method: 'POST', body: { fee } }),
  rejectApplication: (id) => request(`/applications/${id}/reject`, { method: 'POST' }),
  confirmInvitation: (id) => request(`/applications/${id}/confirm`, { method: 'POST' }),
  withdrawApplication: (id) => request(`/applications/${id}/withdraw`, { method: 'POST' }),

  // Colaboraciones
  deals: (params) => request(`/deals${qs(params)}`),
  deal: (id) => request(`/deals/${id}`),
  dealAction: (id, action, payload) => request(`/deals/${id}/${action}`, { method: 'POST', body: payload }),
  sendMessage: (id, body) => request(`/deals/${id}/messages`, { method: 'POST', body: { body } }),
  review: (id, payload) => request(`/deals/${id}/review`, { method: 'POST', body: payload }),

  // Avisos
  notifications: () => request('/notifications'),
  readNotifications: () => request('/notifications/read', { method: 'POST' }),

  // Backoffice
  adminOverview: () => request('/admin/overview'),
  verifyCreator: (id, verified) => request(`/admin/creators/${id}/verify`, { method: 'POST', body: { verified } }),
  featureCreator: (id, featured) => request(`/admin/creators/${id}/feature`, { method: 'POST', body: { featured } }),
  recomputeRanking: () => request('/admin/ranking/recompute', { method: 'POST' }),
}

export default api
