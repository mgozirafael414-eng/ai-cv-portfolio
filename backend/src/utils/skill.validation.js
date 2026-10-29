import {
  addOptionalInteger,
  addOptionalString,
  addRequiredString,
  rejectUnexpectedFields,
  validateObject,
} from './cv.validation.js'

const fields = ['name', 'category', 'proficiency']

export function validateSkillInput(input, { partial = false } = {}) {
  const result = validateObject(input)
  if (result.errors.length) return result
  const errors = []
  const data = {}
  rejectUnexpectedFields(input, fields, errors)
  addRequiredString(input, 'name', 120, errors, data, !partial)
  addOptionalString(input, 'category', 120, errors, data)
  addOptionalInteger(input, 'proficiency', 0, 100, errors, data)
  return { errors, data }
}
