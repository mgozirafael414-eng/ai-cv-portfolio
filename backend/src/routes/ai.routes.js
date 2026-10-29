import { Router } from 'express'
import { aiController } from '../controllers/ai.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = Router()
router.use(requireAuth)
router.get('/recommendations', aiController.listRecommendations)
router.get('/recommendations/:id', aiController.getRecommendation)
router.post('/recommendations/:id/accept', aiController.acceptRecommendation)
router.post('/recommendations/:id/reject', aiController.rejectRecommendation)
router.post('/recommendations/:id/edit', aiController.editRecommendation)
router.post('/improve-summary', aiController.improveSummary)
router.post('/improve-experience', aiController.improveExperience)
router.post('/improve-project', aiController.improveProject)
router.post('/suggest-skills', aiController.suggestSkills)
router.post('/optimize-cv', aiController.optimizeCv)
router.post('/analyze-job-description', aiController.analyzeJobDescription)

export default router
