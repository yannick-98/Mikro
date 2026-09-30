/** Error de aplicacion con codigo HTTP asociado. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details)
export const unauthorized = (msg = 'No autenticado') => new HttpError(401, msg)
export const forbidden = (msg = 'No tienes permiso para esta accion') => new HttpError(403, msg)
export const notFound = (msg = 'Recurso no encontrado') => new HttpError(404, msg)
export const conflict = (msg) => new HttpError(409, msg)

/** Envuelve un handler async para que los errores lleguen al middleware. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

/** Valida el body con un esquema zod y devuelve los datos tipados. */
export function parseBody(schema, body) {
  const result = schema.safeParse(body)
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }))
    throw badRequest('Datos invalidos', details)
  }
  return result.data
}
