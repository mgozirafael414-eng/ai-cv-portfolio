import {
  addOptionalBoolean,
  addOptionalString,
  addRequiredString,
  rejectUnexpectedFields,
  validateObject,
} from './cv.validation.js'

const portfolioFields = ['title', 'slug', 'template', 'isPublished']
const allowedTemplates = ['professional', 'modern', 'minimal']

export function validatePortfolioInput(input, { partial = false } = {}) {
  const result = validateObject(input)
  if (result.errors.length) return result

  const errors = []
  const data = {}
  rejectUnexpectedFields(input, portfolioFields, errors)

  if (Object.prototype.hasOwnProperty.call(input, 'title')) {
    addRequiredString(input, 'title', 200, errors, data, !partial)
  }

  if (Object.prototype.hasOwnProperty.call(input, 'slug')) {
    addOptionalString(input, 'slug', 160, errors, data)
    if (data.slug !== null && data.slug !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) {
      errors.push('slug must use lowercase letters, numbers, and hyphens only')
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'template')) {
    if (typeof input.template !== 'string' || !allowedTemplates.includes(input.template)) {
      errors.push('template must be one of: professional, modern, minimal')
    } else {
      data.template = input.template
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'isPublished')) {
    addOptionalBoolean(input, 'isPublished', errors, data)
  }

  if (!partial && !data.title && !Object.prototype.hasOwnProperty.call(input, 'title')) {
    errors.push('title is required')
  }

  if (!partial && !data.slug && !Object.prototype.hasOwnProperty.call(input, 'slug')) {
    errors.push('slug is required')
  }

  return { errors, data }
}
