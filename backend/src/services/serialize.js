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
    score: creator.score,
    rankDelta: creator.rankDelta,
    listPosition: position,
    portfolio: cover ? [{ imageUrl: cover.imageUrl }] : [],
  }
}
