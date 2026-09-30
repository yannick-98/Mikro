import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { asyncHandler, badRequest, forbidden, notFound, parseBody } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { publicCampaign, publicCreator, publicBrand } from '../services/serialize.js'
import { recomputeCreator } from '../services/creatorStats.js'
import { notify } from '../services/notify.js'

const router = Router()

const DEAL_INCLUDE = {
  campaign: { include: { brand: true } },
  brand: { include: { user: true } },
  creator: { include: { user: true, socialAccounts: true } },
  payments: true,
  reviews: true,
  _count: { select: { messages: true } },
}

function serializeDeal(deal, viewerRole) {
  return {
    id: deal.id,
    status: deal.status,
    fee: deal.fee,
    feePlatform: deal.feePlatform,
    netToCreator: deal.fee - deal.feePlatform,
    contentUrl: deal.contentUrl,
    notes: deal.notes,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    campaign: publicCampaign(deal.campaign),
    brand: publicBrand(deal.brand),
    creator: publicCreator(deal.creator),
    payments: deal.payments,
    messagesCount: deal._count?.messages ?? 0,
    reviewed: (deal.reviews || []).some((r) => r.authorId === deal.viewerId),
    viewerRole,
  }
}

/** Comprueba que el usuario participa en la colaboracion. */
async function loadDealFor(user, id) {
  const deal = await prisma.deal.findUnique({ where: { id }, include: DEAL_INCLUDE })
  if (!deal) throw notFound('Colaboracion no encontrada')
  const isBrand = user.brand && deal.brandId === user.brand.id
  const isCreator = user.creator && deal.creatorId === user.creator.id
  if (!isBrand && !isCreator && user.role !== 'ADMIN') throw forbidden()
  return { deal, isBrand, isCreator }
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const where = {}
    if (req.user.role === 'BRAND') where.brandId = req.user.brand.id
    else if (req.user.role === 'CREATOR') where.creatorId = req.user.creator.id
    if (req.query.status) where.status = req.query.status

    const deals = await prisma.deal.findMany({
      where,
      include: DEAL_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    })
    res.json({ items: deals.map((d) => serializeDeal({ ...d, viewerId: req.user.id }, req.user.role)) })
  }),
)

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { deal } = await loadDealFor(req.user, req.params.id)
    const messages = await prisma.message.findMany({
      where: { dealId: deal.id },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json({
      deal: serializeDeal({ ...deal, viewerId: req.user.id }, req.user.role),
      messages,
    })
  }),
)

const messageSchema = z.object({ body: z.string().min(1, 'Escribe un mensaje').max(2000) })

router.post(
  '/:id/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { deal, isBrand } = await loadDealFor(req.user, req.params.id)
    const { body } = parseBody(messageSchema, req.body)

    const message = await prisma.message.create({
      data: { dealId: deal.id, senderId: req.user.id, body },
      include: { sender: { select: { id: true, name: true, avatarUrl: true, role: true } } },
    })

    await notify(isBrand ? deal.creator.userId : deal.brand.userId, {
      kind: 'MESSAGE',
      title: `Nuevo mensaje de ${req.user.name}`,
      body: body.slice(0, 120),
      link: isBrand ? '/creador/colaboraciones' : '/empresa/colaboraciones',
    })

    res.status(201).json({ message })
  }),
)

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().max(600).optional(),
})

/** Solo la empresa valora al creador (reputacion publica del marketplace). */
router.post(
  '/:id/review',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { deal, isBrand } = await loadDealFor(req.user, req.params.id)
    if (!isBrand) throw forbidden('Solo la empresa puede valorar la colaboracion')
    if (!['APPROVED', 'PAID'].includes(deal.status)) {
      throw badRequest('Solo se puede valorar una colaboracion completada')
    }
    const data = parseBody(reviewSchema, req.body)

    const review = await prisma.review.upsert({
      where: { dealId_authorId: { dealId: deal.id, authorId: req.user.id } },
      update: data,
      create: { ...data, dealId: deal.id, authorId: req.user.id, creatorId: deal.creatorId },
    })
    await recomputeCreator(deal.creatorId)

    await notify(deal.creator.userId, {
      kind: 'REVIEW',
      title: 'Nueva valoracion',
      body: `${deal.brand.companyName} te ha puntuado con ${data.rating}/5`,
      link: '/creador/perfil',
    })

    res.status(201).json({ review })
  }),
)

/**
 * Transiciones del ciclo de vida. Se declara al final a proposito: al ser
 * una ruta comodin, capturaria /messages y /review si fuera antes.
 * ACCEPTED -> FUNDED -> IN_PROGRESS -> SUBMITTED -> APPROVED -> PAID
 */
const TRANSITIONS = {
  fund: { from: ['ACCEPTED'], to: 'FUNDED', actor: 'BRAND' },
  start: { from: ['FUNDED'], to: 'IN_PROGRESS', actor: 'CREATOR' },
  submit: { from: ['FUNDED', 'IN_PROGRESS'], to: 'SUBMITTED', actor: 'CREATOR' },
  approve: { from: ['SUBMITTED'], to: 'APPROVED', actor: 'BRAND' },
  release: { from: ['APPROVED'], to: 'PAID', actor: 'BRAND' },
  cancel: { from: ['ACCEPTED', 'FUNDED', 'IN_PROGRESS'], to: 'CANCELLED', actor: 'ANY' },
}

router.post(
  '/:id/:action',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { action } = req.params
    const rule = TRANSITIONS[action]
    if (!rule) throw notFound('Accion no soportada')

    const { deal, isBrand, isCreator } = await loadDealFor(req.user, req.params.id)

    if (rule.actor === 'BRAND' && !isBrand) throw forbidden('Solo la empresa puede hacer esto')
    if (rule.actor === 'CREATOR' && !isCreator) throw forbidden('Solo el creador puede hacer esto')
    if (!rule.from.includes(deal.status)) {
      throw badRequest(`No se puede pasar de ${deal.status} a ${rule.to}`)
    }

    const data = { status: rule.to }
    if (action === 'submit') {
      if (!req.body?.contentUrl) throw badRequest('Indica el enlace al contenido publicado')
      data.contentUrl = req.body.contentUrl
      data.notes = req.body.notes || deal.notes
    }

    const updated = await prisma.deal.update({ where: { id: deal.id }, data })

    // Movimientos de dinero simulados (escrow)
    if (action === 'fund') {
      await prisma.payment.create({
        data: {
          dealId: deal.id,
          amount: deal.fee,
          fee: deal.feePlatform,
          kind: 'ESCROW_IN',
          reference: `ESC-${deal.id.slice(-6).toUpperCase()}`,
        },
      })
    }
    if (action === 'release') {
      await prisma.payment.create({
        data: {
          dealId: deal.id,
          amount: deal.fee - deal.feePlatform,
          fee: deal.feePlatform,
          kind: 'PAYOUT',
          reference: `PAY-${deal.id.slice(-6).toUpperCase()}`,
        },
      })
      await recomputeCreator(deal.creatorId)
    }
    if (action === 'cancel') {
      const funded = deal.payments.some((p) => p.kind === 'ESCROW_IN')
      if (funded) {
        await prisma.payment.create({
          data: { dealId: deal.id, amount: deal.fee, fee: 0, kind: 'REFUND', reference: `REF-${deal.id.slice(-6).toUpperCase()}` },
        })
      }
    }

    const NOTICES = {
      fund: ['Fondos depositados', 'La empresa ha depositado el importe en garantia. Ya puedes empezar.'],
      start: ['Colaboracion en marcha', 'El creador ha empezado a trabajar.'],
      submit: ['Contenido entregado', 'Revisa el contenido y aprueba la colaboracion.'],
      approve: ['Contenido aprobado', 'La empresa ha aprobado tu trabajo.'],
      release: ['Pago liberado', 'El importe se ha enviado al creador.'],
      cancel: ['Colaboracion cancelada', 'La colaboracion se ha cancelado.'],
    }
    const [title, body] = NOTICES[action]
    const targetUserId = isBrand ? deal.creator.userId : deal.brand.userId
    await notify(targetUserId, {
      kind: 'DEAL',
      title,
      body,
      link: isBrand ? '/creador/colaboraciones' : '/empresa/colaboraciones',
    })

    res.json({ deal: { ...updated } })
  }),
)

export default router
