import express from 'express'
import cors from 'cors'
import morgan from 'morgan'

import { attachUser } from './middleware/auth.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'

import authRoutes from './routes/auth.js'
import creatorRoutes from './routes/creators.js'
import brandRoutes from './routes/brands.js'
import campaignRoutes from './routes/campaigns.js'
import applicationRoutes from './routes/applications.js'
import dealRoutes from './routes/deals.js'
import searchRoutes from './routes/search.js'
import rankingRoutes from './routes/rankings.js'
import demoRoutes from './routes/demos.js'
import socialRoutes from './routes/social.js'
import toolRoutes from './routes/tools.js'
import webRoutes from './routes/web.js'
import shopifyRoutes from './routes/shopify.js'
import shopifyWebhookRoutes from './routes/shopifyWebhooks.js'
import stripeRoutes from './routes/stripe.js'
import billingRoutes from './routes/billing.js'
import stripeWebhookRoutes from './routes/stripeWebhooks.js'
import miscRoutes from './routes/misc.js'

/**
 * Devuelve el router aunque el empaquetador lo haya envuelto en { default }.
 * Al desplegar como funcion serverless el modulo puede llegar transformado, y
 * sin esto Express falla con "requires a middleware function but got a Object".
 */
const router = (mod) => (typeof mod === 'function' ? mod : mod?.default)

export function createApp() {
  const app = express()

  app.use(
    cors({
      origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
      credentials: true,
    }),
  )
  // Los webhooks de Shopify van ANTES del parser de JSON y con el cuerpo en
  // crudo: su firma se calcula sobre los bytes tal cual llegan, y cualquier
  // parser que los interprete y los vuelva a serializar la invalida.
  app.use('/api/shopify/webhooks', router(shopifyWebhookRoutes))
  // Los de Stripe, por lo mismo: la firma se calcula sobre los bytes crudos.
  app.use('/api/stripe/webhooks', router(stripeWebhookRoutes))

  app.use(express.json({ limit: '1mb' }))

  // Los datos del panel cambian con cada accion: sin esto el navegador sirve
  // respuestas cacheadas y la interfaz se queda con el estado anterior.
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'))
  app.use(attachUser)

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'mikro-api', time: new Date().toISOString() }))

  app.use('/api/auth', router(authRoutes))
  app.use('/api/creators', router(creatorRoutes))
  app.use('/api/brands', router(brandRoutes))
  app.use('/api/campaigns', router(campaignRoutes))
  app.use('/api/applications', router(applicationRoutes))
  app.use('/api/deals', router(dealRoutes))
  app.use('/api/search', router(searchRoutes))
  app.use('/api/rankings', router(rankingRoutes))
  app.use('/api/demo-requests', router(demoRoutes))
  app.use('/api/social', router(socialRoutes))
  app.use('/api/stripe', router(stripeRoutes))
  app.use('/api/billing', router(billingRoutes))
  // Herramientas: precio de referencia, informe, brief y media kit. Montadas
  // en la raiz porque cada una cuelga de donde le corresponde por recurso.
  app.use('/api', router(toolRoutes))
  // El diagnostico de web va aparte: es la unica ruta que sale a internet a
  // buscar datos que no son nuestros, y por eso tiene su propio freno.
  app.use('/api/web', router(webRoutes))
  app.use('/api/shopify', router(shopifyRoutes))
  app.use('/api', router(miscRoutes))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

export default createApp
