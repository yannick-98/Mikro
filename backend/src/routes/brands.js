import { Router } from 'express'
import { z } from 'zod'
import prisma from '../lib/prisma.js'
import { asyncHandler, notFound, parseBody } from '../lib/http.js'
import { requireRole } from '../middleware/auth.js'
import { publicBrand, publicCreator } from '../services/serialize.js'

const router = Router()

router.get(
  '/me',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const brand = await prisma.brand.findUnique({ where: { userId: req.user.id } })
    res.json({ brand: publicBrand(brand) })
  }),
)

const updateBrandSchema = z.object({
  companyName: z.string().min(2).optional(),
  sector: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  website: z.string().optional(),
  logoUrl: z.string().optional(),
  description: z.string().max(800).optional(),
  teamSize: z.string().optional(),
  monthlyBudget: z.number().min(0).optional(),
  vatNumber: z.string().optional(),
})

router.patch(
  '/me',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const data = parseBody(updateBrandSchema, req.body)
    const brand = await prisma.brand.update({ where: { userId: req.user.id }, data })
    res.json({ brand: publicBrand(brand) })
  }),
)

/** Lista de creadores guardados (el marcador de la tarjeta). */
router.get(
  '/me/saved',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const rows = await prisma.savedCreator.findMany({
      where: { brandId: req.user.brand.id },
      include: { creator: { include: { socialAccounts: true, portfolio: { take: 4, orderBy: { position: 'asc' } } } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ items: rows.map((r) => publicCreator(r.creator, { saved: true })) })
  }),
)

router.post(
  '/me/saved/:creatorId',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const creator = await prisma.creator.findUnique({ where: { id: req.params.creatorId } })
    if (!creator) throw notFound('Creador no encontrado')

    const key = { brandId_creatorId: { brandId: req.user.brand.id, creatorId: creator.id } }
    const existing = await prisma.savedCreator.findUnique({ where: key })
    if (existing) {
      await prisma.savedCreator.delete({ where: key })
      return res.json({ saved: false })
    }
    await prisma.savedCreator.create({ data: { brandId: req.user.brand.id, creatorId: creator.id } })
    res.json({ saved: true })
  }),
)

/** Resumen para el panel de la empresa. */
router.get(
  '/me/dashboard',
  requireRole('BRAND'),
  asyncHandler(async (req, res) => {
    const brandId = req.user.brand.id

    const [campaigns, applications, deals, saved] = await Promise.all([
      prisma.campaign.findMany({
        where: { brandId },
        include: { _count: { select: { applications: true, deals: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.application.count({ where: { campaign: { brandId }, status: 'PENDING' } }),
      prisma.deal.findMany({ where: { brandId }, include: { creator: true, campaign: true } }),
      prisma.savedCreator.count({ where: { brandId } }),
    ])

    const invested = deals
      .filter((d) => ['FUNDED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'PAID'].includes(d.status))
      .reduce((sum, d) => sum + d.fee, 0)

    const activeDeals = deals.filter((d) => !['PAID', 'CANCELLED'].includes(d.status)).length
    const completed = deals.filter((d) => d.status === 'PAID').length

    // Alcance potencial comprado: suma de seguidores de los creadores contratados
    const creatorIds = [...new Set(deals.map((d) => d.creatorId))]
    const creators = await prisma.creator.findMany({ where: { id: { in: creatorIds } } })
    const reach = creators.reduce((sum, c) => sum + c.totalFollowers, 0)

    res.json({
      stats: {
        openCampaigns: campaigns.filter((c) => c.status === 'OPEN').length,
        totalCampaigns: campaigns.length,
        pendingApplications: applications,
        activeDeals,
        completedDeals: completed,
        invested,
        savedCreators: saved,
        reach,
        avgCost: completed > 0 ? Math.round(invested / Math.max(completed, 1)) : 0,
      },
      campaigns: campaigns.slice(0, 5).map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        category: c.category,
        budgetMin: c.budgetMin,
        budgetMax: c.budgetMax,
        applications: c._count.applications,
        deals: c._count.deals,
        createdAt: c.createdAt,
      })),
    })
  }),
)

export default router
