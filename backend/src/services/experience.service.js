import { prisma } from '../config/prisma.js'
import { createOwnedResourceService } from './owned-resource.service.js'

export const experienceService = createOwnedResourceService(prisma.experience, 'Experience')
