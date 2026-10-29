import { isUuid } from '../utils/cv.validation.js'

export function createOwnedResourceController({ service, validator, resourceName, collectionName }) {
  return {
    async list(request, response, next) {
      try {
        const records = await service.list(request.userId)
        return response.json({ [collectionName]: records })
      } catch (error) {
        return next(error)
      }
    },

    async create(request, response, next) {
      const { errors, data } = validator(request.body)
      if (errors.length) {
        return response.status(400).json({ error: 'Validation failed', details: errors })
      }

      try {
        const record = await service.create(request.userId, data)
        return response.status(201).json({ [resourceName]: record })
      } catch (error) {
        return next(error)
      }
    },

    async update(request, response, next) {
      if (!isUuid(request.params.id)) {
        return response.status(400).json({ error: 'Invalid record id' })
      }

      const { errors, data } = validator(request.body, { partial: true })
      if (errors.length) {
        return response.status(400).json({ error: 'Validation failed', details: errors })
      }

      try {
        const record = await service.update(request.userId, request.params.id, data)
        return response.json({ [resourceName]: record })
      } catch (error) {
        return next(error)
      }
    },

    async remove(request, response, next) {
      if (!isUuid(request.params.id)) {
        return response.status(400).json({ error: 'Invalid record id' })
      }

      try {
        await service.remove(request.userId, request.params.id)
        return response.status(204).send()
      } catch (error) {
        return next(error)
      }
    },
  }
}
