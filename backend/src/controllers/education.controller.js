import { createOwnedResourceController } from './owned-resource.controller.js'
import { educationService } from '../services/education.service.js'
import { validateEducationInput } from '../utils/education.validation.js'

export const educationController = createOwnedResourceController({
  service: educationService,
  validator: validateEducationInput,
  resourceName: 'education',
  collectionName: 'educations',
})
