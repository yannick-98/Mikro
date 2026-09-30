import { HttpError } from '../lib/http.js'

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Endpoint no encontrado' })
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details })
  }
  // Violacion de restriccion unica de Prisma
  if (err?.code === 'P2002') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos' })
  }
  if (err?.code === 'P2025') {
    return res.status(404).json({ error: 'Recurso no encontrado' })
  }
  console.error('[error]', err)

  // DEBUG_ERRORS=1 devuelve el detalle: util para diagnosticar un despliegue
  // sin acceso comodo a los logs. Nunca se activa por defecto.
  if (process.env.DEBUG_ERRORS === '1') {
    return res.status(500).json({
      error: 'Error interno del servidor',
      detail: String(err?.message || err),
      code: err?.code,
    })
  }
  res.status(500).json({ error: 'Error interno del servidor' })
}
