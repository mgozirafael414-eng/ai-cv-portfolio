import {
  addOptionalString,
  addOptionalStringArray,
  addOptionalUrl,
  addRequiredString,
  rejectUnexpectedFields,
  validateObject,
} from './cv.validation.js'

const fields = ['title', 'description', 'technologies', 'githubUrl', 'liveUrl', 'imageUrl']

export function validateProjectInput(input, { partial = false } = {}) {
  const result = validateObject(input)
  if (result.errors.length) return result
  const errors = []
  const data = {}
  rejectUnexpectedFields(input, fields, errors)
  addRequiredString(input, 'title', 200, errors, data, !partial)
  addOptionalString(input, 'description', 10000, errors, data)
  addOptionalStringArray(input, 'technologies', 100, 50, errors, data)
  addOptionalUrl(input, 'githubUrl', 2048, errors, data)
  addOptionalUrl(input, 'liveUrl', 2048, errors, data)
  addOptionalUrl(input, 'imageUrl', 2048, errors, data)
  return { errors, data }
}
