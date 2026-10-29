import { verifyAccessToken } from '../utils/jwt.js'

export function requireAuth(request, response, next) {
  const authorization = request.get('authorization')
  const [scheme, token] = authorization?.split(' ') ?? []

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({ error: 'Authentication required' })
  }

  try {
    const payload = verifyAccessToken(token)
    if (typeof payload !== 'object' || typeof payload.sub !== 'string') {
      return response.status(401).json({ error: 'Authentication required' })
    }

    request.userId = payload.sub
    return next()
  } catch (_error) {
    return response.status(401).json({ error: 'Authentication required' })
  }
}
