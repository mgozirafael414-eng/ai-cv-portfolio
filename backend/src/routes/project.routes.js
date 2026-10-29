import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { projectController } from '../controllers/project.controller.js'

const router = Router()
router.use(requireAuth)
router.get('/', projectController.list)
router.post('/', projectController.create)
router.put('/:id', projectController.update)
router.delete('/:id', projectController.remove)
export default router
