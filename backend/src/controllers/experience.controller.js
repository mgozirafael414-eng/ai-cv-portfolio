import { createOwnedResourceController } from './owned-resource.controller.js'
import { experienceService } from '../services/experience.service.js'
import { validateExperienceInput } from '../utils/experience.validation.js'

export const experienceController = createOwnedResourceController({
  service: experienceService,
  validator: validateExperienceInput,
  resourceName: 'experience',
  collectionName: 'experiences',
})
