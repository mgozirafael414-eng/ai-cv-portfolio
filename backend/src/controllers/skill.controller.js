import { createOwnedResourceController } from './owned-resource.controller.js'
import { skillService } from '../services/skill.service.js'
import { validateSkillInput } from '../utils/skill.validation.js'

export const skillController = createOwnedResourceController({
  service: skillService,
  validator: validateSkillInput,
  resourceName: 'skill',
  collectionName: 'skills',
})
