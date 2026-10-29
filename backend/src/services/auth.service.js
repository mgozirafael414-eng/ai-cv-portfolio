import { prisma } from '../config/prisma.js'
import { comparePassword, hashPassword } from '../utils/password.js'
import { signAccessToken } from '../utils/jwt.js'
import { toSafeUser } from '../utils/user.js'

const INVALID_CREDENTIALS_ERROR = 'Invalid email or password'

export async function registerUser({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase()
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  if (existingUser) {
    const error = new Error('An account with that email already exists')
    error.statusCode = 409
    throw error
  }

  const passwordHash = await hashPassword(password)
  let user
  try {
    user = await prisma.user.create({
      data: { name: name.trim(), email: normalizedEmail, passwordHash },
    })
  } catch (error) {
    if (error.code === 'P2002') {
      const duplicateError = new Error('An account with that email already exists')
      duplicateError.statusCode = 409
      throw duplicateError
    }

    throw error
  }

  return toSafeUser(user)
}

export async function loginUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })
  const passwordMatches = user
    ? await comparePassword(password, user.passwordHash)
    : false

  if (!user || !passwordMatches) {
    const error = new Error(INVALID_CREDENTIALS_ERROR)
    error.statusCode = 401
    throw error
  }

  return { token: signAccessToken(user.id), user: toSafeUser(user) }
}

export async function getUserById(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  return user ? toSafeUser(user) : null
}
