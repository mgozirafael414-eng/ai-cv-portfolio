import {
  addOptionalDate,
  addOptionalString,
  addRequiredString,
  rejectUnexpectedFields,
  validateObject,
} from './cv.validation.js'

const fields = ['company', 'position', 'startDate', 'endDate', 'description']

export function validateExperienceInput(input, { partial = false } = {}) {
  const result = validateObject(input)
  if (result.errors.length) return result
  const errors = []
  const data = {}
  rejectUnexpectedFields(input, fields, errors)
  addRequiredString(input, 'company', 200, errors, data, !partial)
  addRequiredString(input, 'position', 200, errors, data, !partial)
  addOptionalDate(input, 'startDate', errors, data)
  addOptionalDate(input, 'endDate', errors, data)
  addOptionalString(input, 'description', 5000, errors, data)
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    errors.push('endDate must be on or after startDate')
  }
  return { errors, data }
}
