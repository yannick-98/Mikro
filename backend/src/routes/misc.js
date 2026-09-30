import { Router } from 'express'
import prisma from '../lib/prisma.js'
import { asyncHandler } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { recomputeRanking } from '../services/creatorStats.js'
import { publicCreator } from '../services/serialize.js'

const router = Router()

/** Cifras de la portada: prueba social real calculada sobre la base de datos. */
router.get(
  '/stats/home',
  asyncHandler(async (_req, res) => {
    const [creators, brands, openCampaigns, deals, paid] = await Promise.all([
      prisma.creator.count({ where: { available: true } }),
      prisma.brand.count(),
      prisma.campaign.count({ where: { status: 'OPEN' } }),
      prisma.deal.count(),
      prisma.deal.aggregate({ where: { status: 'PAID' }, _sum: { fee: true } }),
    ])

    const agg = await prisma.creator.aggregate({
      _sum: { totalFollowers: true },
      _avg: { engagementRate: true },
    })

    // "Empresas buscando creadores hoy": marcas con campana abierta.
    const searchingToday = await prisma.brand.count({ where: { campaigns: { some: { status: 'OPEN' } } } })

    res.json({
      creators,
      brands,
      openCampaigns,
      deals,
      searchingToday: Math.max(searchingToday, openCampaigns),
      paidOut: paid._sum.fee || 0,
      totalReach: agg._sum.totalFollowers || 0,
      avgEngagement: Math.round((agg._avg.engagementRate || 0) * 100) / 100,
    })
  }),
)

router.get(
  '/notifications',
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    const unread = items.filter((n) => !n.readAt).length
    res.json({ items, unread })
  }),
)

router.post(
  '/notifications/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    })
    res.json({ ok: true })
  }),
)

/** Panel de creador: ingresos, oportunidades y estado del perfil. */
router.get(
  '/creator/dashboard',
  requireRole('CREATOR'),
  asyncHandler(async (req, res) => {
    const creatorId = req.user.creator.id
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      include: { socialAccounts: true, portfolio: true },
    })

    const [applications, deals, openCampaigns] = await Promise.all([
      prisma.application.findMany({ where: { creatorId }, include: { campaign: true } }),
      prisma.deal.findMany({ where: { creatorId }, include: { campaign: true, brand: true } }),
      prisma.campaign.count({ where: { status: 'OPEN' } }),
    ])

    const earned = deals
      .filter((d) => d.status === 'PAID')
      .reduce((sum, d) => sum + (d.fee - d.feePlatform), 0)
    const pending = deals
      .filter((d) => ['FUNDED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED'].includes(d.status))
      .reduce((sum, d) => sum + (d.fee - d.feePlatform), 0)

    // Completitud del perfil: guia al creador a mejorar su ficha.
    const checks = [
      { id: 'avatar', label: 'Foto de perfil', done: !!creator.avatarUrl },
      { id: 'headline', label: 'Titular', done: !!creator.headline },
      { id: 'bio', label: 'Biografia', done: !!creator.bio && creator.bio.length > 40 },
      { id: 'social', label: 'Al menos una red conectada', done: creator.socialAccounts.length > 0 },
      { id: 'rates', label: 'Tarifas publicadas', done: creator.ratePost > 0 || creator.rateReel > 0 },
      { id: 'portfolio', label: '4 piezas en el portfolio', done: creator.portfolio.length >= 4 },
    ]
    const completion = Math.round((checks.filter((c) => c.done).length / checks.length) * 100)

    res.json({
      creator: publicCreator(creator),
      stats: {
        rankPosition: creator.rankPosition,
        rankDelta: creator.rankDelta,
        totalFollowers: creator.totalFollowers,
        engagementRate: creator.engagementRate,
        earned,
        pending,
        activeDeals: deals.filter((d) => !['PAID', 'CANCELLED'].includes(d.status)).length,
        completedDeals: deals.filter((d) => d.status === 'PAID').length,
        pendingApplications: applications.filter((a) => a.status === 'PENDING').length,
        invitations: applications.filter((a) => a.source === 'BRAND' && a.status === 'PENDING').length,
        openCampaigns,
        ratingAvg: creator.ratingAvg,
        ratingCount: creator.ratingCount,
      },
      profileCompletion: { percent: completion, checks },
    })
  }),
)

/** Backoffice minimo: verificar perfiles y destacar creadores. */
router.get(
  '/admin/overview',
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const [users, creators, brands, campaigns, deals, payments] = await Promise.all([
      prisma.user.count(),
      prisma.creator.count(),
      prisma.brand.count(),
      prisma.campaign.count(),
      prisma.deal.count(),
      prisma.payment.aggregate({ where: { kind: 'PAYOUT' }, _sum: { fee: true, amount: true } }),
    ])
    const pendingVerification = await prisma.creator.findMany({
      where: { verified: false },
      orderBy: { score: 'desc' },
      take: 12,
      include: { socialAccounts: true },
    })
    res.json({
      stats: {
        users,
        creators,
        brands,
        campaigns,
        deals,
        revenue: payments._sum.fee || 0,
        gmv: payments._sum.amount || 0,
      },
      pendingVerification: pendingVerification.map((c) => publicCreator(c)),
    })
  }),
)

router.post(
  '/admin/creators/:id/verify',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const creator = await prisma.creator.update({
      where: { id: req.params.id },
      data: { verified: req.body?.verified !== false },
    })
    res.json({ creator: { id: creator.id, verified: creator.verified } })
  }),
)

router.post(
  '/admin/creators/:id/feature',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const creator = await prisma.creator.update({
      where: { id: req.params.id },
      data: { featured: req.body?.featured !== false },
    })
    res.json({ creator: { id: creator.id, featured: creator.featured } })
  }),
)

router.post(
  '/admin/ranking/recompute',
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const count = await recomputeRanking()
    res.json({ ok: true, creators: count })
  }),
)

export default router
