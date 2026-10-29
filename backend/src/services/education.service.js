import { prisma } from '../config/prisma.js'
import { createOwnedResourceService } from './owned-resource.service.js'

export const educationService = createOwnedResourceService(prisma.education, 'Education')
