import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { downloadCurrentCvPdf } from '../controllers/cv-pdf.controller.js'

const router = Router()

router.use(requireAuth)
router.get('/pdf', downloadCurrentCvPdf)

export default router
