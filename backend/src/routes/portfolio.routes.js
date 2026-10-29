import { Router } from 'express'
import {
  createCurrentPortfolio,
  getCurrentPortfolio,
  getPublicPortfolio,
  publishCurrentPortfolio,
  updateCurrentPortfolio,
} from '../controllers/portfolio.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()

router.use(requireAuth)
router.get('/', getCurrentPortfolio)
router.post('/', createCurrentPortfolio)
router.put('/', updateCurrentPortfolio)
router.patch('/publish', publishCurrentPortfolio)

export default router
