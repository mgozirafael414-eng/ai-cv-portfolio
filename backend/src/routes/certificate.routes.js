import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { certificateController } from '../controllers/certificate.controller.js'

const router = Router()
router.use(requireAuth)
router.get('/', certificateController.list)
router.post('/', certificateController.create)
router.put('/:id', certificateController.update)
router.delete('/:id', certificateController.remove)
export default router
