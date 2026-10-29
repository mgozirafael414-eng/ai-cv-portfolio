import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { rm } from 'node:fs/promises'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import { signAccessToken } from '../src/utils/jwt.js'

process.env.JWT_SECRET = 'profile-test-secret'
process.env.JWT_EXPIRES_IN = '1h'

const userId = '00000000-0000-0000-0000-000000000010'
const profiles = new Map()
const originalProfileMethods = {
  findUnique: prisma.profile.findUnique,
  upsert: prisma.profile.upsert,
  update: prisma.profile.update,
}

let server
let baseUrl

before(async () => {
  prisma.profile.findUnique = async ({ where }) => profiles.get(where.userId) ?? null
  prisma.profile.upsert = async ({ where, create, update }) => {
    const current = profiles.get(where.userId)
    const profile = {
      id: current?.id ?? '00000000-0000-0000-0000-000000000011',
      userId: where.userId,
      phone: null,
      location: null,
      headline: null,
      bio: null,
      profileImage: null,
      linkedinUrl: null,
      githubUrl: null,
      websiteUrl: null,
      createdAt: current?.createdAt ?? new Date(),
      updatedAt: new Date(),
      ...(current ?? {}),
      ...(current ? update : create),
    }
    profiles.set(where.userId, profile)
    return profile
  }
  prisma.profile.update = async ({ where, data }) => {
    const current = profiles.get(where.userId)
    if (!current) throw new Error('Profile not found')
    const profile = { ...current, ...data, updatedAt: new Date() }
    profiles.set(where.userId, profile)
    return profile
  }

  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  prisma.profile.findUnique = originalProfileMethods.findUnique
  prisma.profile.upsert = originalProfileMethods.upsert
  prisma.profile.update = originalProfileMethods.update
  await rm('uploads/profile-images', { recursive: true, force: true })
  server.close()
  await prisma.$disconnect()
})

async function request(path, options = {}) {
  const isMultipart = options.body instanceof FormData
  return fetch(`${baseUrl}${path}`, {
    headers: {
      ...(isMultipart ? {} : { 'content-type': 'application/json' }),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  })
}

const token = signAccessToken(userId)

test('unauthenticated profile access is rejected', async () => {
  const response = await request('/api/profile')
  assert.equal(response.status, 401)
})

test('authenticated user receives 404 when no profile exists', async () => {
  const response = await request('/api/profile', { token })
  assert.equal(response.status, 404)
})

test('authenticated user can create a profile without client ownership data', async () => {
  const response = await request('/api/profile', {
    method: 'PUT',
    token,
    body: JSON.stringify({
      headline: 'Full-stack developer',
      location: 'Remote',
    }),
  })
  const body = await response.json()

  assert.equal(response.status, 201)
  assert.equal(body.profile.userId, userId)
  assert.equal(body.profile.headline, 'Full-stack developer')
})

test('authenticated user can retrieve their profile', async () => {
  const response = await request('/api/profile', { token })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.profile.userId, userId)
  assert.equal(body.profile.location, 'Remote')
})

test('authenticated user can partially update their profile', async () => {
  const response = await request('/api/profile', {
    method: 'PUT',
    token,
    body: JSON.stringify({ bio: 'Builds useful products.' }),
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.profile.bio, 'Builds useful products.')
  assert.equal(body.profile.headline, 'Full-stack developer')
})

test('profile updates reject client-supplied ownership data', async () => {
  const response = await request('/api/profile', {
    method: 'PUT',
    token,
    body: JSON.stringify({
      userId: '00000000-0000-0000-0000-000000000999',
      headline: 'Should be rejected',
    }),
  })

  assert.equal(response.status, 400)
})

test('invalid profile input is rejected', async () => {
  const response = await request('/api/profile', {
    method: 'PUT',
    token,
    body: JSON.stringify({ linkedinUrl: 'not-a-url' }),
  })

  assert.equal(response.status, 400)
})

test('profile image upload requires authentication and a valid image', async () => {
  const unauthenticated = await request('/api/profile/image', { method: 'POST' })
  assert.equal(unauthenticated.status, 401)

  const invalid = new FormData()
  invalid.append('image', new Blob(['not an image'], { type: 'text/plain' }), 'notes.txt')
  const invalidResponse = await request('/api/profile/image', { method: 'POST', token, body: invalid })
  assert.equal(invalidResponse.status, 400)

  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const valid = new FormData()
  valid.append('image', new Blob([png], { type: 'image/png' }), 'profile.png')
  const uploadResponse = await request('/api/profile/image', { method: 'POST', token, body: valid })
  const uploadBody = await uploadResponse.json()
  assert.equal(uploadResponse.status, 200)
  assert.match(uploadBody.profile.profileImage, /^\/uploads\/profile-images\//)
})

test('authenticated user can remove their profile image', async () => {
  const response = await request('/api/profile/image', { method: 'DELETE', token })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.profile.profileImage, null)
})
