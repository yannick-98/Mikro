import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'mikro-dev-secret'
const EXPIRES_IN = '30d'

export function hashPassword(plain) {
  return bcrypt.hash(plain, 10)
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, SECRET, {
    expiresIn: EXPIRES_IN,
  })
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET)
}
