import prisma from '../lib/prisma.js'
import { verifyToken } from '../lib/auth.js'
import { forbidden, unauthorized } from '../lib/http.js'

/** Carga req.user si hay un token valido; no falla si no lo hay. */
export async function attachUser(req, _res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return next()
  try {
    const payload = verifyToken(token)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { brand: true, creator: true },
    })
    if (user) req.user = user
  } catch {
    // token invalido o caducado: se sigue como anonimo
  }
  next()
}

/** Exige sesion iniciada. */
export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized())
  next()
}

/** Exige uno de los roles indicados. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized())
    if (!roles.includes(req.user.role)) {
      return next(forbidden(`Esta seccion es solo para: ${roles.join(', ')}`))
    }
    next()
  }
}
