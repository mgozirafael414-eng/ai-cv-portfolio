import {
  getUserById,
  loginUser,
  registerUser,
} from '../services/auth.service.js'

// Basic email format: must contain exactly one @, with non-empty local and domain parts.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// bcrypt silently truncates inputs beyond 72 bytes; cap at 128 characters to
// prevent CPU-exhaustion attacks from artificially long password strings.
const PASSWORD_MAX_LENGTH = 128

function validateCredentials(body, includeName = false) {
  const { name, email, password } = body ?? {}
  const errors = []

  if (includeName && (typeof name !== 'string' || !name.trim())) {
    errors.push('name is required')
  }
  if (typeof email !== 'string' || !email.trim()) {
    errors.push('email is required')
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('email must be a valid email address')
  }
  if (typeof password !== 'string' || !password) {
    errors.push('password is required')
  } else if (password.length < 8) {
    errors.push('password must be at least 8 characters')
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`password must be at most ${PASSWORD_MAX_LENGTH} characters`)
  }

  return errors
}

export async function register(request, response, next) {
  const errors = validateCredentials(request.body, true)
  if (errors.length) {
    return response.status(400).json({ error: 'Validation failed', details: errors })
  }

  try {
    const user = await registerUser(request.body)
    return response.status(201).json({ user })
  } catch (error) {
    return next(error)
  }
}

export async function login(request, response, next) {
  const errors = validateCredentials(request.body)
  if (errors.length) {
    return response.status(400).json({ error: 'Validation failed', details: errors })
  }

  try {
    const result = await loginUser(request.body)
    return response.json(result)
  } catch (error) {
    return next(error)
  }
}

export async function currentUser(request, response, next) {
  try {
    const user = await getUserById(request.userId)
    if (!user) {
      return response.status(401).json({ error: 'Authentication required' })
    }

    return response.json({ user })
  } catch (error) {
    return next(error)
  }
}
