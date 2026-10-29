import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import { hashPassword } from '../src/utils/password.js'
import { signAccessToken } from '../src/utils/jwt.js'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-only-secret'
process.env.JWT_EXPIRES_IN = '1h'

const storedUsers = new Map()
const originalUserMethods = {
  findUnique: prisma.user.findUnique,
  create: prisma.user.create,
}
const testUser = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test User',
  email: 'test@example.com',
  passwordHash: await hashPassword('correct-password'),
  createdAt: new Date(),
  updatedAt: new Date(),
}

let server
let baseUrl

before(async () => {
  prisma.user.findUnique = async ({ where }) => {
    if (where.id) return [...storedUsers.values()].find((user) => user.id === where.id) ?? null
    return storedUsers.get(where.email) ?? null
  }
  prisma.user.create = async ({ data }) => {
    if (storedUsers.has(data.email)) {
      const error = new Error('Unique constraint failed')
      error.code = 'P2002'
      throw error
    }

    const user = {
      ...testUser,
      ...data,
      id: `00000000-0000-0000-0000-${String(storedUsers.size + 2).padStart(12, '0')}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    storedUsers.set(user.email, user)
    return user
  }

  storedUsers.set(testUser.email, testUser)
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  prisma.user.findUnique = originalUserMethods.findUnique
  prisma.user.create = originalUserMethods.create
  server.close()
  await prisma.$disconnect()
})

async function request(path, options) {
  return fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  })
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

test('registration preflight allows the local frontend origin', async () => {
  const response = await request('/api/auth/register', {
    method: 'OPTIONS',
    headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  })

  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
  assert.match(response.headers.get('access-control-allow-methods') || '', /POST/)
  assert.match(response.headers.get('access-control-allow-headers') || '', /Content-Type/i)
})

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('registration', () => {
  test('succeeds and omits passwordHash', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' },
      body: JSON.stringify({ name: 'New User', email: ' NEW@Example.com ', password: 'correct-password' }),
    })
    const body = await response.json()

    assert.equal(response.status, 201)
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
    assert.equal(body.user.email, 'new@example.com', 'email is normalised to lower-case')
    assert.equal('passwordHash' in body.user, false, 'passwordHash must not be returned')
    assert.equal('password' in body.user, false, 'raw password must not be returned')
  })

  test('duplicate email is rejected with 409', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Duplicate', email: 'TEST@example.com', password: 'correct-password' }),
    })

    assert.equal(response.status, 409)
    const body = await response.json()
    assert.ok(body.error, 'error message must be present')
    assert.equal('passwordHash' in body, false, 'passwordHash must not appear in error response')
  })

  test('invalid email format is rejected with 400', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad Email', email: 'notanemail', password: 'correct-password' }),
    })
    const body = await response.json()

    assert.equal(response.status, 400)
    assert.ok(
      body.details?.some((d) => /email/i.test(d)),
      'details should mention email format',
    )
  })

  test('password shorter than 8 characters is rejected with 400', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Short Pass', email: 'shortpass@example.com', password: 'abc' }),
    })
    const body = await response.json()

    assert.equal(response.status, 400)
    assert.ok(body.details?.some((d) => /password/i.test(d)))
  })

  test('password over 128 characters is rejected with 400', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Long Pass', email: 'longpass@example.com', password: 'a'.repeat(129) }),
    })
    const body = await response.json()

    assert.equal(response.status, 400)
    assert.ok(body.details?.some((d) => /password/i.test(d)))
  })

  test('registration error response does not leak internal information', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Dup', email: 'test@example.com', password: 'correct-password' }),
    })
    const body = await response.json()
    const bodyText = JSON.stringify(body)

    assert.equal(response.status, 409)
    assert.ok(!bodyText.includes('passwordHash'), 'must not expose passwordHash')
    assert.ok(!bodyText.toLowerCase().includes('stack'), 'must not expose stack trace')
    assert.ok(!bodyText.toLowerCase().includes('prisma'), 'must not expose ORM details')
    assert.ok(!bodyText.includes(process.env.JWT_SECRET), 'must not expose JWT_SECRET')
    assert.ok(
      !bodyText.includes(process.env.GROQ_API_KEY ?? 'no-groq-key'),
      'must not expose GROQ_API_KEY',
    )
  })
})

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

describe('login', () => {
  test('succeeds with correct credentials and returns a token', async () => {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'TEST@example.com', password: 'correct-password' }),
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(typeof body.token, 'string', 'token must be a string')
    assert.ok(body.token.length > 0, 'token must not be empty')
    assert.equal(body.user.email, testUser.email)
    assert.equal('passwordHash' in body.user, false, 'passwordHash must not be returned')
    assert.equal('password' in body.user, false, 'raw password must not be returned')
  })

  test('incorrect password returns 401 with generic message', async () => {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testUser.email, password: 'wrong-password' }),
    })
    const body = await response.json()

    assert.equal(response.status, 401)
    assert.ok(body.error, 'error message must be present')
    assert.equal('passwordHash' in body, false)
  })

  test('nonexistent user returns same 401 response as wrong password', async () => {
    const [wrongPasswordRes, missingEmailRes] = await Promise.all([
      request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: testUser.email, password: 'wrong-password' }),
      }),
      request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'missing@example.com', password: 'wrong-password' }),
      }),
    ])

    assert.equal(wrongPasswordRes.status, 401)
    assert.equal(missingEmailRes.status, 401)
    assert.deepEqual(
      await wrongPasswordRes.json(),
      await missingEmailRes.json(),
      'error responses must be identical to prevent user enumeration',
    )
  })

  test('login error response does not leak internal information', async () => {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testUser.email, password: 'wrong-password' }),
    })
    const body = await response.json()
    const bodyText = JSON.stringify(body)

    assert.equal(response.status, 401)
    assert.ok(!bodyText.includes('passwordHash'), 'must not expose passwordHash')
    assert.ok(!bodyText.toLowerCase().includes('stack'), 'must not expose stack trace')
    assert.ok(!bodyText.includes(process.env.JWT_SECRET), 'must not expose JWT_SECRET')
    assert.ok(
      !bodyText.includes(process.env.GROQ_API_KEY ?? 'no-groq-key'),
      'must not expose GROQ_API_KEY',
    )
  })

  test('login with invalid email format is rejected with 400', async () => {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'notanemail', password: 'correct-password' }),
    })

    assert.equal(response.status, 400)
  })
})

// ---------------------------------------------------------------------------
// /api/auth/me
// ---------------------------------------------------------------------------

describe('/api/auth/me', () => {
  test('returns the authenticated user for a valid token', async () => {
    const token = signAccessToken(testUser.id)
    const response = await request('/api/auth/me', {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.user.id, testUser.id)
    assert.equal(body.user.email, testUser.email)
    assert.equal('passwordHash' in body.user, false, 'passwordHash must not be returned')
    assert.equal('password' in body.user, false, 'raw password must not be returned')
  })

  test('returns user ID from the JWT payload, not from a client-supplied value', async () => {
    // Sign a token carrying testUser.id.  Pass a *different* userId via a
    // query-string parameter to simulate a client attempting to override the
    // identity.  The server must derive the user ID from the verified JWT only.
    const token = signAccessToken(testUser.id)
    const response = await request('/api/auth/me?userId=00000000-0000-0000-0000-000000000099', {
      headers: { authorization: `Bearer ${token}` },
    })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.user.id, testUser.id, 'userId must come from JWT, not from a query parameter')
  })

  test('rejects request with no token', async () => {
    const response = await request('/api/auth/me')

    assert.equal(response.status, 401)
    const body = await response.json()
    assert.ok(body.error)
  })

  test('rejects request with an invalid token', async () => {
    const response = await request('/api/auth/me', {
      headers: { authorization: 'Bearer this.is.not.a.valid.jwt' },
    })

    assert.equal(response.status, 401)
  })

  test('rejects request with a token signed by a different secret', async () => {
    const forgotToken = jwt.sign({ sub: testUser.id }, 'wrong-secret', { expiresIn: '1h' })
    const response = await request('/api/auth/me', {
      headers: { authorization: `Bearer ${forgotToken}` },
    })

    assert.equal(response.status, 401)
  })

  test('rejects an expired token', async () => {
    // Sign a token that expired 1 second ago.
    const expiredToken = jwt.sign(
      { sub: testUser.id },
      process.env.JWT_SECRET,
      { expiresIn: -1 },
    )
    const response = await request('/api/auth/me', {
      headers: { authorization: `Bearer ${expiredToken}` },
    })

    assert.equal(response.status, 401)
    const body = await response.json()
    assert.ok(body.error, 'expired token must return an error message')
    assert.equal('passwordHash' in body, false)
  })

  test('rejects a token with a tampered payload', async () => {
    // Build a valid token then mutate the payload segment.
    const validToken = signAccessToken(testUser.id)
    const [header, , signature] = validToken.split('.')
    const tamperedPayload = Buffer.from(
      JSON.stringify({ sub: '00000000-0000-0000-0000-000000000099', exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString('base64url')
    const tamperedToken = `${header}.${tamperedPayload}.${signature}`
    const response = await request('/api/auth/me', {
      headers: { authorization: `Bearer ${tamperedToken}` },
    })

    assert.equal(response.status, 401)
  })

  test('response does not expose JWT_SECRET or GROQ_API_KEY', async () => {
    const token = signAccessToken(testUser.id)
    const response = await request('/api/auth/me', {
      headers: { authorization: `Bearer ${token}` },
    })
    const bodyText = await response.text()

    assert.ok(!bodyText.includes(process.env.JWT_SECRET), 'JWT_SECRET must never appear in a response')
    assert.ok(
      !bodyText.includes(process.env.GROQ_API_KEY ?? 'no-groq-key'),
      'GROQ_API_KEY must never appear in a response',
    )
  })
})
