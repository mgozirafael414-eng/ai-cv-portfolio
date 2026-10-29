import {
  addOptionalDate,
  addOptionalString,
  addOptionalUrl,
  addRequiredString,
  rejectUnexpectedFields,
  validateObject,
} from './cv.validation.js'

const fields = ['name', 'issuer', 'issueDate', 'credentialUrl']

export function validateCertificateInput(input, { partial = false } = {}) {
  const result = validateObject(input)
  if (result.errors.length) return result
  const errors = []
  const data = {}
  rejectUnexpectedFields(input, fields, errors)
  addRequiredString(input, 'name', 200, errors, data, !partial)
  addOptionalString(input, 'issuer', 200, errors, data)
  addOptionalDate(input, 'issueDate', errors, data)
  addOptionalUrl(input, 'credentialUrl', 2048, errors, data)
  return { errors, data }
}
