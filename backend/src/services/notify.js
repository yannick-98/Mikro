import prisma from '../lib/prisma.js'

/** Crea una notificacion in-app. En produccion tambien dispararia email. */
export function notify(userId, { kind, title, body, link }) {
  if (!userId) return null
  return prisma.notification.create({ data: { userId, kind, title, body, link } })
}

export default notify
