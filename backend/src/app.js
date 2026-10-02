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
  app.use('/api', router(miscRoutes))

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

export default createApp
