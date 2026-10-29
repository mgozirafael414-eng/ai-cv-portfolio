import jwt from 'jsonwebtoken'

const DEFAULT_EXPIRATION = '1h'

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured')
  }

  return process.env.JWT_SECRET
}

export function signAccessToken(userId) {
  return jwt.sign(
    { sub: userId },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRATION },
  )
}

export function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret())
}
