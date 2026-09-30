import { Router } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma.js'
import { asyncHandler, badRequest, forbidden, notFound, parseBody } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { publicCampaign, publicCreator } from '../services/serialize.js'
import { notify } from '../services/notify.js'

const router = Router()

const applySchema = z.object({
  campaignId: z.string().min(1),
  message: z.string().max(1000).optional(),
  proposedFee: z.number().min(0),
})

/** Un creador se postula a una campana abierta. */
router.post(
  '/',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const data = parseBody(applySchema, req.body)
    const campaign = await prisma.campaign.findUnique({
      where: { id: data.campaignId },
      include: { brand: { include: { user: true } } },
    })
    if (!campaign) throw notFound('Campana no encontrada')
    if (campaign.status !== 'OPEN') throw badRequest('Esta campana ya no admite candidaturas')

    const creatorId = req.user.creator.id
    const existing = await prisma.application.findUnique({
      where: { campaignId_creatorId: { campaignId: campaign.id, creatorId } },
    })
    if (existing && existing.status !== 'WITHDRAWN') throw badRequest('Ya te has postulado a esta campana')

    const application = existing
      ? await prisma.application.update({
          where: { id: existing.id },
          data: { status: 'PENDING', message: data.message, proposedFee: data.proposedFee, source: 'CREATOR' },
        })
      : await prisma.application.create({
          data: { campaignId: campaign.id, creatorId, message: data.message, proposedFee: data.proposedFee },
        })

    await notify(campaign.brand.userId, {
      kind: 'APPLICATION',
      title: `Nueva candidatura en "${campaign.title}"`,
      body: `${req.user.creator.displayName} se ha postulado por ${data.proposedFee} EUR`,
      link: `/empresa/campanas/${campaign.id}`,
    })

    res.status(201).json({ application })
  }),
)

/** Candidaturas del usuario actual (creador) o recibidas (empresa). */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user.role === 'CREATOR') {
      const rows = await prisma.application.findMany({
        where: { creatorId: req.user.creator.id },
        include: { campaign: { include: { brand: true } } },
        orderBy: { createdAt: 'desc' },
      })
      return res.json({
        items: rows.map((a) => ({
          id: a.id,
          status: a.status,
          message: a.message,
          proposedFee: a.proposedFee,
          source: a.source,
          createdAt: a.createdAt,
          campaign: publicCampaign(a.campaign),
        })),
      })
    }

    if (req.user.role === 'BRAND') {
      const rows = await prisma.application.findMany({
        where: { campaign: { brandId: req.user.brand.id } },
        include: {
          campaign: true,
          creator: { include: { socialAccounts: true, portfolio: { take: 4 } } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return res.json({
        items: rows.map((a) => ({
          id: a.id,
          status: a.status,
          message: a.message,
          proposedFee: a.proposedFee,
          source: a.source,
          createdAt: a.createdAt,
          campaign: publicCampaign(a.campaign),
          creator: publicCreator(a.creator),
        })),
      })
    }

    res.json({ items: [] })
  }),
)

/** La empresa acepta una candidatura: nace la colaboracion. */
router.post(
  '/:id/accept',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { campaign: true, creator: { include: { user: true } } },
    })
    if (!application) throw notFound('Candidatura no encontrada')
    if (application.campaign.brandId !== req.user.brand.id) throw forbidden()
    if (application.status === 'ACCEPTED') throw badRequest('Esta candidatura ya esta aceptada')

    const feePct = Number(process.env.PLATFORM_FEE_PCT || 12)
    const fee = req.body?.fee ? Number(req.body.fee) : application.proposedFee

    const [, deal] = await prisma.$transaction([
      prisma.application.update({ where: { id: application.id }, data: { status: 'ACCEPTED' } }),
      prisma.deal.create({
        data: {
          campaignId: application.campaignId,
          brandId: req.user.brand.id,
          creatorId: application.creatorId,
          fee,
          feePlatform: Math.round((fee * feePct) / 100),
          status: 'ACCEPTED',
        },
      }),
    ])

    await notify(application.creator.userId, {
      kind: 'DEAL',
      title: 'Tu candidatura ha sido aceptada',
      body: `${req.user.brand.companyName} quiere trabajar contigo en "${application.campaign.title}"`,
      link: '/creador/colaboraciones',
    })

    res.status(201).json({ deal })
  }),
)

router.post(
  '/:id/reject',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { campaign: true, creator: true },
    })
    if (!application) throw notFound('Candidatura no encontrada')
    if (application.campaign.brandId !== req.user.brand.id) throw forbidden()

    await prisma.application.update({ where: { id: application.id }, data: { status: 'REJECTED' } })
    await notify(application.creator.userId, {
      kind: 'APPLICATION',
      title: 'Candidatura descartada',
      body: `La campana "${application.campaign.title}" ha seguido con otro perfil`,
      link: '/creador/candidaturas',
    })
    res.json({ ok: true })
  }),
)

/** El creador acepta una invitacion recibida de una empresa. */
router.post(
  '/:id/confirm',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: { campaign: { include: { brand: { include: { user: true } } } } },
    })
    if (!application) throw notFound('Invitacion no encontrada')
    if (application.creatorId !== req.user.creator.id) throw forbidden()
    if (application.source !== 'BRAND') throw badRequest('Esta candidatura la has creado tu')

    const feePct = Number(process.env.PLATFORM_FEE_PCT || 12)
    const fee = application.proposedFee

    const [, deal] = await prisma.$transaction([
      prisma.application.update({ where: { id: application.id }, data: { status: 'ACCEPTED' } }),
      prisma.deal.create({
        data: {
          campaignId: application.campaignId,
          brandId: application.campaign.brandId,
          creatorId: application.creatorId,
          fee,
          feePlatform: Math.round((fee * feePct) / 100),
          status: 'ACCEPTED',
        },
      }),
    ])

    await notify(application.campaign.brand.userId, {
      kind: 'DEAL',
      title: 'Invitacion aceptada',
      body: `${req.user.creator.displayName} ha aceptado colaborar en "${application.campaign.title}"`,
      link: '/empresa/colaboraciones',
    })

    res.status(201).json({ deal })
  }),
)

router.post(
  '/:id/withdraw',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const application = await prisma.application.findUnique({ where: { id: req.params.id } })
    if (!application) throw notFound('Candidatura no encontrada')
    if (application.creatorId !== req.user.creator.id) throw forbidden()
    await prisma.application.update({ where: { id: application.id }, data: { status: 'WITHDRAWN' } })
    res.json({ ok: true })
  }),
)

export default router
