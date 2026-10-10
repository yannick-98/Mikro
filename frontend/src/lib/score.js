/**
 * Estimacion de la puntuacion de un creador que aun no tiene cuenta.
 *
 * Replica los pesos de backend/src/services/scoring.js (computeScore). Si
 * cambian alli, hay que cambiarlos aqui. Lo que una cuenta nueva no tiene
 * todavia (valoraciones, colaboraciones, verificacion) toma el valor de
 * partida que el backend da a cualquier perfil recien creado.
 */
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

export const WEIGHTS = [
  { key: 'engagement', label: 'Engagement', weight: 0.34 },
  { key: 'alcance', label: 'Seguidores', weight: 0.2 },
  { key: 'reputacion', label: 'Valoraciones de marcas', weight: 0.18 },
  { key: 'actividad', label: 'Colaboraciones cerradas', weight: 0.12 },
  { key: 'respuesta', label: 'Rapidez al responder', weight: 0.08 },
  { key: 'confianza', label: 'Perfil verificado', weight: 0.08 },
]

export function estimateScore({ followers, engagement }) {
  const alcance = followers > 0 ? clamp((Math.log10(followers) - 3) / 3, 0, 1) * 100 : 0
  const parts = {
    alcance,
    engagement: clamp(engagement / 8, 0, 1) * 100,
    reputacion: 55,
    actividad: 0,
    respuesta: clamp(1 - 24 / 72, 0, 1) * 100,
    confianza: 40,
  }
  const score = WEIGHTS.reduce((sum, w) => sum + parts[w.key] * w.weight, 0)
  return Math.round(score * 10) / 10
}
