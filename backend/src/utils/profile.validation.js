const profileFields = [
  'phone',
  'location',
  'headline',
  'bio',
  'profileImage',
  'linkedinUrl',
  'githubUrl',
  'websiteUrl',
]

const fieldLimits = {
  phone: 40,
  location: 160,
  headline: 200,
  bio: 5000,
  profileImage: 2048,
  linkedinUrl: 2048,
  githubUrl: 2048,
  websiteUrl: 2048,
}

const urlFields = ['linkedinUrl', 'githubUrl', 'websiteUrl']

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch (_error) {
    return false
  }
}

function isProfileImagePath(value) {
  return isHttpUrl(value) || value.startsWith('/')
}

export function validateProfileInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { errors: ['request body must be an object'], data: {} }
  }

  const errors = []
  const data = {}
  const receivedFields = Object.keys(input)

  if (receivedFields.includes('userId')) {
    errors.push('userId cannot be provided')
  }

  for (const field of receivedFields) {
    if (!profileFields.includes(field)) {
      errors.push(`${field} is not a supported profile field`)
      continue
    }

    const value = input[field]
    if (value === null) {
      data[field] = null
      continue
    }

    if (typeof value !== 'string') {
      errors.push(`${field} must be a string or null`)
      continue
    }

    const normalizedValue = value.trim()
    if (normalizedValue.length > fieldLimits[field]) {
      errors.push(`${field} must be ${fieldLimits[field]} characters or fewer`)
      continue
    }

    if (urlFields.includes(field) && normalizedValue && !isHttpUrl(normalizedValue)) {
      errors.push(`${field} must be a valid HTTP or HTTPS URL`)
      continue
    }

    if (field === 'profileImage' && normalizedValue && !isProfileImagePath(normalizedValue)) {
      errors.push('profileImage must be a valid HTTP(S) URL or absolute path')
      continue
    }

    data[field] = normalizedValue || null
  }

  return { errors, data }
}
