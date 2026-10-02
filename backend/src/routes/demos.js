import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { asyncHandler, notFound, parseBody } from '../lib/http.js'
import { requireRole } from '../middleware/auth.js'

const router = Router()

export const TEAM_SIZES = ['1-5', '6-20', '21-50', '50+']
export const BUDGET_RANGES = ['menos-300', '300-800', '800-2000', 'mas-2000', 'por-decidir']
const STATUSES = ['NEW', 'CONTACTED', 'SCHEDULED', 'WON', 'LOST']

/** Campo opcional de texto: una cadena vacia del formulario no es un dato. */
const optionalText = (max) => z.string().trim().max(max).optional().or(z.literal(''))

const demoSchema = z.object({
  companyName: z.string().trim().min(2, 'Indica el nombre de tu empresa').max(120),
  contactName: z.string().trim().min(2, 'Indica tu nombre').max(120),
  email: z.string().trim().email('Email no valido').max(160),
  phone: optionalText(40),
  website: optionalText(160),
  sector: optionalText(80),
  city: optionalText(80),
  teamSize: z.enum(TEAM_SIZES).optional().or(z.literal('')),
  monthlyBudget: z.enum(BUDGET_RANGES).optional().or(z.literal('')),
  goal: optionalText(1000),
  consent: z
    .boolean()
    .refine((v) => v === true, 'Necesitamos tu permiso para poder escribirte'),
})

const clean = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)

/**
 * Peticion de demo. Publica a proposito: pedirle cuenta a una empresa antes de
 * ensenarle el producto es justo el orden inverso del que tiene sentido.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = parseBody(demoSchema, req.body)
    const email = data.email.toLowerCase()

    const payload = {
      companyName: data.companyName.trim(),
      contactName: data.contactName.trim(),
      phone: clean(data.phone),
      website: clean(data.website),
      sector: clean(data.sector),
      city: clean(data.city),
      teamSize: clean(data.teamSize),
      monthlyBudget: clean(data.monthlyBudget),
      goal: clean(data.goal),
      consentAt: new Date(),
    }

    // Un doble clic, o alguien que corrige un telefono mal escrito, no deberia
    // dejar dos fichas del mismo lead sin atender: se actualiza la del dia.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const open = await prisma.demoRequest.findFirst({
      where: { email, status: 'NEW', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    })

    const saved = open
      ? await prisma.demoRequest.update({ where: { id: open.id }, data: payload })
      : await prisma.demoRequest.create({
          data: { ...payload, email, userId: req.user?.id ?? null },
        })

    if (!open) await notifyAdmins(saved)

    res.status(open ? 200 : 201).json({
      request: { id: saved.id, companyName: saved.companyName, createdAt: saved.createdAt },
      updated: !!open,
    })
  }),
)

/**
 * Avisa al backoffice. Es mejor esfuerzo: si falla, la peticion ya esta
 * guardada y perderla por no poder avisar seria el peor de los dos males.
 */
async function notifyAdmins(request) {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
    if (!admins.length) return
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        kind: 'DEMO_REQUEST',
        title: `${request.companyName} pide una demo`,
        body: [request.contactName, request.email, request.sector].filter(Boolean).join(' · '),
        link: '/admin',
      })),
    })
  } catch {
    // sin ruido: el lead es lo que importa
  }
}

/** Bandeja de leads del backoffice. */
router.get(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const status = STATUSES.includes(req.query.status) ? req.query.status : undefined
    const items = await prisma.demoRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(req.query.limit) || 50, 200),
    })
    const pending = await prisma.demoRequest.count({ where: { status: 'NEW' } })
    res.json({ items, pending })
  }),
)

router.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const data = parseBody(
      z.object({ status: z.enum(STATUSES).optional(), notes: optionalText(2000) }),
      req.body,
    )
    const existing = await prisma.demoRequest.findUnique({ where: { id: req.params.id } })
    if (!existing) throw notFound('Esa peticion no existe')

    const request = await prisma.demoRequest.update({
      where: { id: req.params.id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.notes !== undefined ? { notes: clean(data.notes) } : {}),
      },
    })
    res.json({ request })
  }),
)

export default router
