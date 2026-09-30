import { Router } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma.js'
import { asyncHandler, badRequest, forbidden, notFound, parseBody } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { publicCampaign, publicCreator } from '../services/serialize.js'
import { matchScore } from '../services/scoring.js'
import { notify } from '../services/notify.js'

const router = Router()

const campaignSchema = z.object({
  title: z.string().min(4, 'Ponle un titulo a la campana'),
  brief: z.string().min(20, 'Describe el brief con al menos 20 caracteres'),
  category: z.string().min(2),
  deliverables: z.string().min(2),
  budgetMin: z.number().min(0),
  budgetMax: z.number().min(0),
  targetCity: z.string().optional(),
  minFollowers: z.number().min(0).optional(),
  maxFollowers: z.number().min(0).optional(),
  platforms: z.string().optional(),
  productValue: z.number().min(0).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['DRAFT', 'OPEN', 'CLOSED', 'COMPLETED']).optional(),
})

/** Campanas abiertas: escaparate para creadores. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, city, status = 'OPEN', mine } = req.query

    const where = {}
    if (mine === 'true') {
      if (!req.user?.brand) throw forbidden('Solo las empresas tienen campanas propias')
      where.brandId = req.user.brand.id
      if (status && status !== 'ALL') where.status = status
    } else {
      where.status = 'OPEN'
    }
    if (category) where.category = category
    if (city) where.targetCity = city

    const campaigns = await prisma.campaign.findMany({
      where,
      include: { brand: true, _count: { select: { applications: true, deals: true } } },
      orderBy: { createdAt: 'desc' },
    })

    // Si es un creador, se le muestra su afinidad y si ya se ha apuntado.
    let applied = new Set()
    let creator = null
    if (req.user?.creator) {
      creator = await prisma.creator.findUnique({
        where: { id: req.user.creator.id },
        include: { socialAccounts: true },
      })
      const apps = await prisma.application.findMany({
        where: { creatorId: creator.id },
        select: { campaignId: true },
      })
      applied = new Set(apps.map((a) => a.campaignId))
    }

    res.json({
      items: campaigns.map((c) =>
        publicCampaign(c, {
          applied: applied.has(c.id),
          match: creator
            ? matchScore(creator, {
                categories: [c.category],
                cities: c.targetCity ? [c.targetCity] : [],
                platforms: c.platforms ? c.platforms.split(',').map((p) => p.trim()) : [],
                minFollowers: c.minFollowers,
                maxFollowers: c.maxFollowers,
                maxBudget: c.budgetMax,
              })
            : undefined,
        }),
      ),
    })
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        brand: true,
        _count: { select: { applications: true, deals: true } },
      },
    })
    if (!campaign) throw notFound('Campana no encontrada')

    const isOwner = req.user?.brand?.id === campaign.brandId
    let applications = []
    if (isOwner) {
      const rows = await prisma.application.findMany({
        where: { campaignId: campaign.id },
        include: { creator: { include: { socialAccounts: true, portfolio: { take: 4 } } } },
        orderBy: { createdAt: 'desc' },
      })
      applications = rows.map((a) => ({
        id: a.id,
        status: a.status,
        message: a.message,
        proposedFee: a.proposedFee,
        source: a.source,
        createdAt: a.createdAt,
        creator: publicCreator(a.creator, {
          match: matchScore(a.creator, {
            categories: [campaign.category],
            cities: campaign.targetCity ? [campaign.targetCity] : [],
            minFollowers: campaign.minFollowers,
            maxFollowers: campaign.maxFollowers,
            maxBudget: campaign.budgetMax,
          }),
        }),
      }))
    }

    res.json({ campaign: publicCampaign(campaign, { isOwner }), applications })
  }),
)

/** Creadores recomendados para una campana (solo la empresa propietaria). */
router.get(
  '/:id/recommended',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } })
    if (!campaign) throw notFound('Campana no encontrada')
    if (campaign.brandId !== req.user.brand.id) throw forbidden()

    const criteria = {
      categories: [campaign.category],
      cities: campaign.targetCity ? [campaign.targetCity] : [],
      platforms: campaign.platforms ? campaign.platforms.split(',').map((p) => p.trim()) : [],
      minFollowers: campaign.minFollowers,
      maxFollowers: campaign.maxFollowers,
      maxBudget: campaign.budgetMax,
    }

    const creators = await prisma.creator.findMany({
      where: { available: true },
      include: { socialAccounts: true, portfolio: { take: 4, orderBy: { position: 'asc' } } },
    })
    const existing = await prisma.application.findMany({
      where: { campaignId: campaign.id },
      select: { creatorId: true },
    })
    const taken = new Set(existing.map((e) => e.creatorId))

    const ranked = creators
      .filter((c) => !taken.has(c.id))
      .map((c) => ({ c, match: matchScore(c, criteria) }))
      .sort((a, b) => b.match - a.match)
      .slice(0, 8)
      .map(({ c, match }) => publicCreator(c, { match }))

    res.json({ items: ranked })
  }),
)

router.post(
  '/',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const data = parseBody(campaignSchema, req.body)
    if (data.budgetMax < data.budgetMin) throw badRequest('El presupuesto maximo no puede ser menor que el minimo')

    const campaign = await prisma.campaign.create({
      data: {
        ...data,
        brandId: req.user.brand.id,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        status: data.status || 'OPEN',
      },
      include: { brand: true, _count: { select: { applications: true, deals: true } } },
    })
    res.status(201).json({ campaign: publicCampaign(campaign) })
  }),
)

router.patch(
  '/:id',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.campaign.findUnique({ where: { id: req.params.id } })
    if (!existing) throw notFound('Campana no encontrada')
    if (existing.brandId !== req.user.brand.id) throw forbidden()

    const data = parseBody(campaignSchema.partial(), req.body)
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
      include: { brand: true, _count: { select: { applications: true, deals: true } } },
    })
    res.json({ campaign: publicCampaign(campaign) })
  }),
)

router.delete(
  '/:id',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.campaign.findUnique({ where: { id: req.params.id } })
    if (!existing) throw notFound('Campana no encontrada')
    if (existing.brandId !== req.user.brand.id) throw forbidden()
    await prisma.campaign.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  }),
)

/** Invitacion directa de una empresa a un creador. */
router.post(
  '/:id/invite',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const { creatorId, message, fee } = req.body || {}
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } })
    if (!campaign) throw notFound('Campana no encontrada')
    if (campaign.brandId !== req.user.brand.id) throw forbidden()

    const creator = await prisma.creator.findUnique({ where: { id: creatorId }, include: { user: true } })
    if (!creator) throw notFound('Creador no encontrado')

    const application = await prisma.application.upsert({
      where: { campaignId_creatorId: { campaignId: campaign.id, creatorId } },
      update: { message, proposedFee: Number(fee) || campaign.budgetMax, source: 'BRAND', status: 'PENDING' },
      create: {
        campaignId: campaign.id,
        creatorId,
        message,
        proposedFee: Number(fee) || campaign.budgetMax,
        source: 'BRAND',
      },
    })

    await notify(creator.userId, {
      kind: 'INVITATION',
      title: `Invitacion a "${campaign.title}"`,
      body: `${req.user.brand.companyName} quiere colaborar contigo`,
      link: '/creador/oportunidades',
    })

    res.status(201).json({ application })
  }),
)

export default router
