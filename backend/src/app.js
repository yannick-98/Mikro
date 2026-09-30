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
import miscRoutes from './routes/misc.js'

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

  app.use('/api/auth', authRoutes)
  app.use('/api/creators', creatorRoutes)
  app.use('/api/brands', brandRoutes)
  app.use('/api/campaigns', campaignRoutes)
  app.use('/api/applications', applicationRoutes)
  app.use('/api/deals', dealRoutes)
  app.use('/api/search', searchRoutes)
  app.use('/api/rankings', rankingRoutes)
  app.use('/api', miscRoutes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

export default createApp
