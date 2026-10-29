import { createOwnedResourceController } from './owned-resource.controller.js'
import { projectService } from '../services/project.service.js'
import { validateProjectInput } from '../utils/project.validation.js'

export const projectController = createOwnedResourceController({
  service: projectService,
  validator: validateProjectInput,
  resourceName: 'project',
  collectionName: 'projects',
})
