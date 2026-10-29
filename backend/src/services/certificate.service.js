import { prisma } from '../config/prisma.js'
import { createOwnedResourceService } from './owned-resource.service.js'

export const certificateService = createOwnedResourceService(prisma.certificate, 'Certificate')
