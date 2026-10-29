import { Router } from 'express'
import { getPublicPortfolio } from '../controllers/portfolio.controller.js'

const router = Router()

router.get('/portfolio/:slug', getPublicPortfolio)

export default router
