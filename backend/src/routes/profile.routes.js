import { Router } from 'express'
import {
  getCurrentProfile,
  completeCurrentProfileImageUpload,
  createCurrentProfileImageUploadSignature,
  removeCurrentProfileImage,
  uploadCurrentProfileImage,
  upsertCurrentProfile,
} from '../controllers/profile.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'
import multer from 'multer'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } })
const profileImageUpload = (request, response, next) => upload.single('image')(request, response, (error) => {
  if (error?.code === 'LIMIT_FILE_SIZE') return response.status(400).json({ error: 'Profile picture must be 5 MB or smaller.' })
  if (error) return next(error)
  return next()
})

router.use(requireAuth)
router.get('/', getCurrentProfile)
router.put('/', upsertCurrentProfile)
router.post('/image/signature', createCurrentProfileImageUploadSignature)
router.post('/image/complete', completeCurrentProfileImageUpload)
router.post('/image', profileImageUpload, uploadCurrentProfileImage)
router.delete('/image', removeCurrentProfileImage)

export default router
