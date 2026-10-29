export function validateObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['request body must be an object'], data: {} }
  }

  return { errors: [], data: {} }
}

export function rejectUnexpectedFields(input, allowedFields, errors) {
  for (const field of Object.keys(input)) {
    if (!allowedFields.includes(field)) {
      errors.push(`${field} is not a supported field`)
    }
  }
}

export function addRequiredString(input, field, maxLength, errors, data, required = true) {
  if (!Object.prototype.hasOwnProperty.call(input, field) && !required) return

  const value = input[field]
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${field} is required`)
    return
  }

  const normalized = value.trim()
  if (normalized.length > maxLength) {
    errors.push(`${field} must be ${maxLength} characters or fewer`)
    return
  }

  data[field] = normalized
}

export function addOptionalString(input, field, maxLength, errors, data) {
  if (!Object.prototype.hasOwnProperty.call(input, field)) return

  const value = input[field]
  if (value === null) {
    data[field] = null
    return
  }
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string or null`)
    return
  }

  const normalized = value.trim()
  if (normalized.length > maxLength) {
    errors.push(`${field} must be ${maxLength} characters or fewer`)
    return
  }

  data[field] = normalized || null
}

export function addOptionalUrl(input, field, maxLength, errors, data) {
  addOptionalString(input, field, maxLength, errors, data)
  if (errors.length && !data[field]) return
  if (data[field] !== null && data[field] !== undefined && !isHttpUrl(data[field])) {
    errors.push(`${field} must be a valid HTTP or HTTPS URL`)
  }
}

export function addOptionalDate(input, field, errors, data) {
  if (!Object.prototype.hasOwnProperty.call(input, field)) return

  const value = input[field]
  if (value === null) {
    data[field] = null
    return
  }
  if (typeof value !== 'string' || !isDateOnly(value)) {
    errors.push(`${field} must be a valid date in YYYY-MM-DD format`)
    return
  }

  data[field] = new Date(`${value}T00:00:00.000Z`)
}

export function addOptionalInteger(input, field, min, max, errors, data) {
  if (!Object.prototype.hasOwnProperty.call(input, field)) return

  const value = input[field]
  if (value === null) {
    data[field] = null
    return
  }
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${field} must be an integer between ${min} and ${max}`)
    return
  }

  data[field] = value
}

export function addOptionalBoolean(input, field, errors, data) {
  if (!Object.prototype.hasOwnProperty.call(input, field)) return

  const value = input[field]
  if (value === null) {
    data[field] = null
    return
  }
  if (typeof value !== 'boolean') {
    errors.push(`${field} must be a boolean or null`)
    return
  }

  data[field] = value
}

export function addOptionalStringArray(input, field, maxItemLength, maxItems, errors, data) {
  if (!Object.prototype.hasOwnProperty.call(input, field)) return

  const value = input[field]
  if (!Array.isArray(value) || value.length > maxItems) {
    errors.push(`${field} must be an array with at most ${maxItems} items`)
    return
  }
  if (value.some((item) => typeof item !== 'string' || !item.trim() || item.trim().length > maxItemLength)) {
    errors.push(`${field} must contain non-empty strings of ${maxItemLength} characters or fewer`)
    return
  }

  data[field] = [...new Set(value.map((item) => item.trim()))]
}

export function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch (_error) {
    return false
  }
}

export function isUuid(value) {
  // Accept any properly formatted UUID (8-4-4-4-12 hex groups).
  // Postgres stores UUIDs as 128-bit values and does not restrict the
  // version or variant nibbles, so we validate format only.
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function isDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}
