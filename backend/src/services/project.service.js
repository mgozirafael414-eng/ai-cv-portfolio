import { prisma } from '../config/prisma.js'
import { createOwnedResourceService } from './owned-resource.service.js'

export const projectService = createOwnedResourceService(prisma.project, 'Project')
