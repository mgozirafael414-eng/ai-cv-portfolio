import { createOwnedResourceController } from './owned-resource.controller.js'
import { certificateService } from '../services/certificate.service.js'
import { validateCertificateInput } from '../utils/certificate.validation.js'

export const certificateController = createOwnedResourceController({
  service: certificateService,
  validator: validateCertificateInput,
  resourceName: 'certificate',
  collectionName: 'certificates',
})
