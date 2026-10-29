import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { educationController } from '../controllers/education.controller.js'

const router = Router()
router.use(requireAuth)
router.get('/', educationController.list)
router.post('/', educationController.create)
router.put('/:id', educationController.update)
router.delete('/:id', educationController.remove)
export default router
