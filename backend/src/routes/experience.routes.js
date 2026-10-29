import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { experienceController } from '../controllers/experience.controller.js'

const router = Router()
router.use(requireAuth)
router.get('/', experienceController.list)
router.post('/', experienceController.create)
router.put('/:id', experienceController.update)
router.delete('/:id', experienceController.remove)
export default router
