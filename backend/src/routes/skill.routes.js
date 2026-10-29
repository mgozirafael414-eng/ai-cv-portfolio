import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { skillController } from '../controllers/skill.controller.js'

const router = Router()
router.use(requireAuth)
router.get('/', skillController.list)
router.post('/', skillController.create)
router.put('/:id', skillController.update)
router.delete('/:id', skillController.remove)
export default router
