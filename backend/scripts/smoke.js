/**
 * Prueba de humo del flujo completo de Mikro contra la API en marcha.
 *   node scripts/smoke.js
 */
const API = process.env.API || 'http://localhost:4000/api'

let passed = 0
let failed = 0

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1
    console.log(`  OK   ${name}`)
  } else {
    failed += 1
    console.log(`  FALLO ${name} ${extra}`)
  }
}

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

async function main() {
  console.log('\n--- Publico ---')
  const health = await call('/health')
  check('health responde', health.json.ok === true)

  const list = await call('/creators?pageSize=6')
  check('listado de creadores', list.json.items?.length === 6, `total=${list.json.total}`)
  check('ranking en orden', list.json.items?.[0]?.rankPosition === 1)

  const profile = await call('/creators/martagarcia')
  check('ficha de creador', profile.json.creator?.displayName === 'Marta Garcia')
  check('ficha con redes', profile.json.creator?.socialAccounts?.length >= 2)
  check('perfiles similares', profile.json.similar?.length > 0)

  const ai = await call('/search/ai', {
    method: 'POST',
    body: { query: 'creadores de moda en Barcelona con mas de 20k seguidores' },
  })
  check('busqueda IA interpreta', ai.json.interpretation?.length >= 2, JSON.stringify(ai.json.interpretation))
  check('busqueda IA devuelve resultados', ai.json.items?.length > 0)

  // Sin sesion el ranking es siempre el top 10 global: la landing no deja
  // filtrar por categoria y la API tiene que sostener esa promesa, no fiarse
  // de que el cliente se porte bien.
  const rank = await call('/rankings?scope=category&value=Fitness&limit=50')
  check('ranking publico limitado', rank.json.items?.length === 10 && rank.json.limited === true)
  check('ranking publico sin filtrar', rank.json.scope === 'global' && rank.json.value === null)

  const movers = await call('/rankings/movers')
  check('movimientos del dia', movers.json.items?.length > 0)

  const stats = await call('/stats/home')
  check('estadisticas de portada', stats.json.creators > 0 && stats.json.searchingToday >= 0)

  const demo = await call('/demo-requests', {
    method: 'POST',
    body: {
      companyName: 'Smoke SL',
      contactName: 'Prueba Humo',
      email: `humo+${Date.now()}@mikro.test`,
      sector: 'Alimentacion',
      teamSize: '6-20',
      monthlyBudget: '300-800',
      consent: true,
    },
  })
  check('peticion de demo', demo.status === 201 && !!demo.json.request?.id)

  const sinConsentimiento = await call('/demo-requests', {
    method: 'POST',
    body: { companyName: 'Smoke SL', contactName: 'Prueba Humo', email: 'humo@mikro.test' },
  })
  check('demo exige consentimiento', sinConsentimiento.status === 400)

  console.log('\n--- Registro y sesion ---')
  const stamp = Date.now()
  const reg = await call('/auth/register', {
    method: 'POST',
    body: {
      email: `pyme${stamp}@test.es`,
      password: 'test1234',
      name: 'Floristeria Test',
      role: 'BRAND',
      companyName: 'Floristeria Test',
      sector: 'Comercio',
      city: 'Madrid',
    },
  })
  check('registro de empresa', reg.status === 201 && !!reg.json.token)
  const brandToken = reg.json.token

  const regC = await call('/auth/register', {
    method: 'POST',
    body: {
      email: `creador${stamp}@test.es`,
      password: 'test1234',
      name: 'Creador Test',
      role: 'CREATOR',
      category: 'Hogar',
      city: 'Madrid',
    },
  })
  check('registro de creador', regC.status === 201 && !!regC.json.token)
  const creatorToken = regC.json.token

  const login = await call('/auth/login', {
    method: 'POST',
    body: { email: `pyme${stamp}@test.es`, password: 'test1234' },
  })
  check('login correcto', login.status === 200 && !!login.json.token)

  const badLogin = await call('/auth/login', {
    method: 'POST',
    body: { email: `pyme${stamp}@test.es`, password: 'malmalmal' },
  })
  check('login con clave erronea rechazado', badLogin.status === 401)

  const me = await call('/auth/me', { token: brandToken })
  check('sesion recuperable', me.json.user?.role === 'BRAND')

  console.log('\n--- Perfil del creador ---')
  await call('/creators/me/social', {
    method: 'PUT',
    token: creatorToken,
    body: { platform: 'instagram', handle: '@creadortest', followers: 24000, engagement: 6.2, avgViews: 12000 },
  })
  const updated = await call('/creators/me', { token: creatorToken })
  check('red conectada suma seguidores', updated.json.creator?.totalFollowers === 24000)
  check('engagement recalculado', updated.json.creator?.engagementRate === 6.2)

  await call('/creators/me', {
    method: 'PATCH',
    token: creatorToken,
    body: { headline: 'Decoracion facil y barata', ratePost: 180, bio: 'Comparto ideas de decoracion low cost para pisos pequenos en Madrid.' },
  })
  const dash = await call('/creator/dashboard', { token: creatorToken })
  check('panel del creador', dash.json.stats?.totalFollowers === 24000)
  check('completitud de perfil', dash.json.profileCompletion?.percent > 0)

  console.log('\n--- Campana, candidatura y colaboracion ---')
  const camp = await call('/campaigns', {
    method: 'POST',
    token: brandToken,
    body: {
      title: 'Ramos de temporada para tu casa',
      brief: 'Buscamos creadores de hogar en Madrid que muestren como decorar con flores de temporada en piso pequeno.',
      category: 'Hogar',
      deliverables: '1 reel, 2 stories',
      budgetMin: 150,
      budgetMax: 400,
      targetCity: 'Madrid',
      platforms: 'instagram,tiktok',
    },
  })
  check('campana creada', camp.status === 201 && !!camp.json.campaign?.id)
  const campaignId = camp.json.campaign.id

  const reco = await call(`/campaigns/${campaignId}/recommended`, { token: brandToken })
  check('creadores recomendados', reco.json.items?.length > 0)

  const apply = await call('/applications', {
    method: 'POST',
    token: creatorToken,
    body: { campaignId, proposedFee: 250, message: 'Me encaja perfecto, tengo audiencia de decoracion en Madrid.' },
  })
  check('candidatura enviada', apply.status === 201)
  const applicationId = apply.json.application.id

  const dup = await call('/applications', {
    method: 'POST',
    token: creatorToken,
    body: { campaignId, proposedFee: 250 },
  })
  check('candidatura duplicada rechazada', dup.status === 400)

  const accept = await call(`/applications/${applicationId}/accept`, { method: 'POST', token: brandToken })
  check('candidatura aceptada crea colaboracion', accept.status === 201 && !!accept.json.deal?.id)
  const dealId = accept.json.deal.id
  check('comision calculada', accept.json.deal.feePlatform === 30, `fee=${accept.json.deal.feePlatform}`)

  // Orden incorrecto: no se puede aprobar sin entregar
  const wrong = await call(`/deals/${dealId}/approve`, { method: 'POST', token: brandToken })
  check('transicion invalida bloqueada', wrong.status === 400)

  // Un tercero no puede tocar la colaboracion
  const intruder = await call(`/deals/${dealId}`, { token: (await call('/auth/login', { method: 'POST', body: { email: 'hola@laespiga.es', password: 'mikro1234' } })).json.token })
  check('acceso ajeno denegado', intruder.status === 403)

  check('fondear', (await call(`/deals/${dealId}/fund`, { method: 'POST', token: brandToken })).status === 200)
  check('creador no puede fondear', (await call(`/deals/${dealId}/fund`, { method: 'POST', token: creatorToken })).status === 403)
  check('empezar', (await call(`/deals/${dealId}/start`, { method: 'POST', token: creatorToken })).status === 200)
  check(
    'entregar sin enlace rechazado',
    (await call(`/deals/${dealId}/submit`, { method: 'POST', token: creatorToken })).status === 400,
  )
  check(
    'entregar contenido',
    (await call(`/deals/${dealId}/submit`, { method: 'POST', token: creatorToken, body: { contentUrl: 'https://instagram.com/p/abc123' } })).status === 200,
  )
  check('aprobar', (await call(`/deals/${dealId}/approve`, { method: 'POST', token: brandToken })).status === 200)
  check('liberar pago', (await call(`/deals/${dealId}/release`, { method: 'POST', token: brandToken })).status === 200)

  const finalDeal = await call(`/deals/${dealId}`, { token: brandToken })
  check('colaboracion pagada', finalDeal.json.deal?.status === 'PAID')
  check('neto para el creador', finalDeal.json.deal?.netToCreator === 220)
  check('dos movimientos de pago', finalDeal.json.deal?.payments?.length === 2)

  console.log('\n--- Mensajes y valoracion ---')
  const msg = await call(`/deals/${dealId}/messages`, {
    method: 'POST',
    token: brandToken,
    body: { body: 'Gracias por el trabajo, ha quedado genial.' },
  })
  check('mensaje enviado', msg.status === 201)

  const review = await call(`/deals/${dealId}/review`, {
    method: 'POST',
    token: brandToken,
    body: { rating: 5, comment: 'Rapida, profesional y con muy buen gusto.' },
  })
  check('valoracion publicada', review.status === 201)

  const creatorAfter = await call('/creators/me', { token: creatorToken })
  check('valoracion refleja en el perfil', creatorAfter.json.creator?.ratingAvg === 5)
  check('colaboracion contabilizada', creatorAfter.json.creator?.completedDeals === 1)

  const creatorReview = await call(`/deals/${dealId}/review`, {
    method: 'POST',
    token: creatorToken,
    body: { rating: 5 },
  })
  check('el creador no puede autovalorarse', creatorReview.status === 403)

  console.log('\n--- Paneles ---')
  const brandDash = await call('/brands/me/dashboard', { token: brandToken })
  check('panel de empresa', brandDash.json.stats?.invested === 250)
  check('alcance contratado', brandDash.json.stats?.reach === 24000)

  const saved = await call(`/brands/me/saved/${profile.json.creator.id}`, { method: 'POST', token: brandToken })
  check('guardar creador', saved.json.saved === true)
  const savedList = await call('/brands/me/saved', { token: brandToken })
  check('lista de guardados', savedList.json.items?.length === 1)
  const unsaved = await call(`/brands/me/saved/${profile.json.creator.id}`, { method: 'POST', token: brandToken })
  check('quitar de guardados', unsaved.json.saved === false)

  const notif = await call('/notifications', { token: creatorToken })
  check('notificaciones del creador', notif.json.items?.length > 0)

  console.log('\n--- Permisos ---')
  check('creador no crea campanas', (await call('/campaigns', { method: 'POST', token: creatorToken, body: { title: 'x', brief: 'y', category: 'Hogar', deliverables: 'z', budgetMin: 1, budgetMax: 2 } })).status === 403)
  check('anonimo no ve su panel', (await call('/brands/me/dashboard')).status === 401)
  check('empresa no accede a admin', (await call('/admin/overview', { token: brandToken })).status === 403)

  const admin = await call('/auth/login', { method: 'POST', body: { email: 'admin@mikro.es', password: 'mikro1234' } })
  const adminOverview = await call('/admin/overview', { token: admin.json.token })
  check('panel de administracion', adminOverview.json.stats?.creators > 0)
  check('ingresos de plataforma', adminOverview.json.stats?.revenue >= 30)

  console.log(`\n=== ${passed} correctas, ${failed} fallidas ===\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
