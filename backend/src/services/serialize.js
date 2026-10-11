import { ofertaCampana } from './pay.js'

/** Formas publicas de los modelos: nada de hashes ni datos internos. */

export function publicCreator(creator, extra = {}) {
  if (!creator) return null
  return {
    id: creator.id,
    handle: creator.handle,
    displayName: creator.displayName,
    headline: creator.headline,
    bio: creator.bio,
    avatarUrl: creator.avatarUrl,
    coverUrl: creator.coverUrl,
    category: creator.category,
    subcategories: creator.subcategories ? [...new Set(creator.subcategories.split(',').map((s) => s.trim()).filter(Boolean))] : [],
    city: creator.city,
    province: creator.province,
    country: creator.country,
    languages: creator.languages ? creator.languages.split(',').map((s) => s.trim()) : [],
    verified: creator.verified,
    featured: creator.featured,
    available: creator.available,
    totalFollowers: creator.totalFollowers,
    engagementRate: creator.engagementRate,
    postsPerWeek: creator.postsPerWeek,
    // De donde salen las tres cifras de arriba. Viaja siempre con ellas: una
    // marca que decide con estos numeros tiene derecho a saber si los ha
    // comprobado alguien o los escribio el interesado.
    metricsSource: creator.metricsSource,
    metricsVerifiedAt: creator.metricsVerifiedAt,
    score: creator.score,
    rankPosition: creator.rankPosition,
    rankDelta: creator.rankDelta,
    responseHours: creator.responseHours,
    completedDeals: creator.completedDeals,
    ratingAvg: creator.ratingAvg,
    ratingCount: creator.ratingCount,
    audience: {
      country: creator.audienceCountry,
      femalePct: creator.audienceFemalePct,
      ageRange: creator.audienceAgeRange,
    },
    rates: {
      post: creator.ratePost,
      reel: creator.rateReel,
      story: creator.rateStory,
      ugc: creator.rateUgc,
    },
    socialAccounts: (creator.socialAccounts || []).map((a) => ({
      platform: a.platform,
      handle: a.handle,
      url: a.url,
      followers: a.followers,
      engagement: a.engagement,
      avgViews: a.avgViews,
      source: a.source,
      postsPerWeek: a.postsPerWeek,
      postsAnalyzed: a.postsAnalyzed,
      avgLikes: a.avgLikes,
      avgComments: a.avgComments,
      lastPostAt: a.lastPostAt,
      lastSyncAt: a.lastSyncAt,
    })),
    portfolio: (creator.portfolio || []).map((p) => ({
      id: p.id,
      imageUrl: p.imageUrl,
      caption: p.caption,
      platform: p.platform,
      likes: p.likes,
    })),
    ...extra,
  }
}

/**
 * La ficha del creador para el propio creador.
 *
 * Anade lo que solo debe ver el: sus datos fiscales. Deliberadamente separado
 * de publicCreator, que es lo que ve cualquiera en su perfil y en su media
 * kit; un NIF ahi no seria un descuido menor.
 */
export function privateCreator(creator) {
  if (!creator) return null
  return {
    ...publicCreator(creator),
    taxId: creator.taxId,
    billingAddress: creator.billingAddress,
    irpfRate: creator.irpfRate,
  }
}

export function publicBrand(brand) {
  if (!brand) return null
  return {
    id: brand.id,
    companyName: brand.companyName,
    sector: brand.sector,
    city: brand.city,
    province: brand.province,
    website: brand.website,
    logoUrl: brand.logoUrl,
    description: brand.description,
    teamSize: brand.teamSize,
    monthlyBudget: brand.monthlyBudget,
    vatNumber: brand.vatNumber,
    billingAddress: brand.billingAddress,
    verified: brand.verified,
  }
}

export function publicUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    whatsappOptIn: user.whatsappOptIn,
    brand: user.brand ? publicBrand(user.brand) : null,
    creator: user.creator
      ? { id: user.creator.id, handle: user.creator.handle, displayName: user.creator.displayName, avatarUrl: user.creator.avatarUrl }
      : null,
  }
}

export function publicCampaign(campaign, extra = {}) {
  if (!campaign) return null
  return {
    id: campaign.id,
    title: campaign.title,
    brief: campaign.brief,
    category: campaign.category,
    deliverables: campaign.deliverables ? campaign.deliverables.split(',').map((s) => s.trim()) : [],
    budgetMin: campaign.budgetMin,
    budgetMax: campaign.budgetMax,
    // Que se promociona y como se paga. Va junto al presupuesto porque es
    // parte de la misma decision: un creador no puede valorar "150-400 EUR"
    // sin saber si son seguros o dependen de lo que venda.
    kind: campaign.kind,
    oferta: ofertaCampana(campaign),
    // La ficha del producto, para que el creador sepa que va a promocionar
    // sin tener que deducirlo del brief.
    producto:
      campaign.kind === 'PRODUCT' && (campaign.productName || campaign.productUrl)
        ? {
            nombre: campaign.productName,
            url: campaign.productUrl,
            imagen: campaign.productImage,
            sku: campaign.productSku,
            valor: campaign.productValue,
            seEnvia: campaign.shipsProduct,
          }
        : null,
    targetCity: campaign.targetCity,
    minFollowers: campaign.minFollowers,
    maxFollowers: campaign.maxFollowers,
    platforms: campaign.platforms ? campaign.platforms.split(',').map((s) => s.trim()) : [],
    status: campaign.status,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    productValue: campaign.productValue,
    createdAt: campaign.createdAt,
    brand: campaign.brand ? publicBrand(campaign.brand) : undefined,
    applicationsCount: campaign._count?.applications,
    dealsCount: campaign._count?.deals,
    ...extra,
  }
}

/**
 * Forma minima para el ranking publico de la landing.
 *
 * La portada pinta una tarjeta y una fila: nombre, categoria, seguidores,
 * puntuacion, movimiento y una portada. Devolver la ficha entera son 20 KB por
 * visita para usar cinco campos, y encima expone tarifas y audiencia a quien
 * todavia no ha entrado.
 */
export function landingCreator(creator, position) {
  const cover = (creator.portfolio || [])[0]
  return {
    id: creator.id,
    handle: creator.handle,
    displayName: creator.displayName,
    avatarUrl: creator.avatarUrl,
    category: creator.category,
    verified: creator.verified,
    totalFollowers: creator.totalFollowers,
    engagementRate: creator.engagementRate,
    metricsSource: creator.metricsSource,
    city: creator.city,
    score: creator.score,
    rankDelta: creator.rankDelta,
    listPosition: position,
    portfolio: cover ? [{ imageUrl: cover.imageUrl }] : [],
  }
}
