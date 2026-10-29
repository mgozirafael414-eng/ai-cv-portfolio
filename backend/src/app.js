import express from 'express'
import cors from 'cors'
import path from 'node:path'
import authRoutes from './routes/auth.routes.js'
import profileRoutes from './routes/profile.routes.js'
import educationRoutes from './routes/education.routes.js'
import experienceRoutes from './routes/experience.routes.js'
import skillRoutes from './routes/skill.routes.js'
import projectRoutes from './routes/project.routes.js'
import certificateRoutes from './routes/certificate.routes.js'
import portfolioRoutes from './routes/portfolio.routes.js'
import publicPortfolioRoutes from './routes/public-portfolio.routes.js'
import aiRoutes from './routes/ai.routes.js'
import cvPdfRoutes from './routes/cv-pdf.routes.js'

function getAllowedOrigins() {
  const configuredOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ORIGINS || '').split(','),
  ]

  return configuredOrigins
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((origin) => origin.trim())
    .map((origin) => origin.replace(/\/$/, ''))
    .filter(Boolean)
}

export function createApp() {
  const app = express()

  const allowedOrigins = getAllowedOrigins()
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      return callback(new Error('Origin is not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition', 'Content-Length'],
    optionsSuccessStatus: 204,
  }))
  app.use(express.json({ limit: '1mb' }))
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')))
  app.get('/health', (_request, response) => {
    response.json({ name: 'AI CV Portfolio API', status: 'ok' })
  })
  app.use('/api/auth', authRoutes)
  app.use('/api/profile', profileRoutes)
  app.use('/api/education', educationRoutes)
  app.use('/api/experience', experienceRoutes)
  app.use('/api/skills', skillRoutes)
  app.use('/api/projects', projectRoutes)
  app.use('/api/certificates', certificateRoutes)
  app.use('/api/portfolio', portfolioRoutes)
  app.use('/api/ai', aiRoutes)
  app.use('/api/cv', cvPdfRoutes)
  app.use('/api/public', publicPortfolioRoutes)

  app.use((error, _request, response, _next) => {
    if (!error.statusCode) {
      console.error('Unhandled request error:', error.message)
    }

    response.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : 'Internal server error',
    })
  })

  return app
}
