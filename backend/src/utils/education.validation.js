import {
  addOptionalDate,
  addOptionalString,
  addRequiredString,
  rejectUnexpectedFields,
  validateObject,
} from './cv.validation.js'

const fields = ['institution', 'degree', 'field', 'startDate', 'endDate', 'description']

export function validateEducationInput(input, { partial = false } = {}) {
  const result = validateObject(input)
  if (result.errors.length) return result
  const errors = []
  const data = {}
  rejectUnexpectedFields(input, fields, errors)
  addRequiredString(input, 'institution', 200, errors, data, !partial)
  addOptionalString(input, 'degree', 160, errors, data)
  addOptionalString(input, 'field', 160, errors, data)
  addOptionalDate(input, 'startDate', errors, data)
  addOptionalDate(input, 'endDate', errors, data)
  addOptionalString(input, 'description', 5000, errors, data)
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    errors.push('endDate must be on or after startDate')
  }
  return { errors, data }
}
