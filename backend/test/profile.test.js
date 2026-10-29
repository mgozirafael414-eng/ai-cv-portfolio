import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import { signAccessToken } from '../src/utils/jwt.js'

process.env.JWT_SECRET = 'profile-test-secret'
process.env.JWT_EXPIRES_IN = '1h'
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
process.env.CLOUDINARY_API_KEY = 'test-api-key'
process.env.CLOUDINARY_API_SECRET = 'test-api-secret'

const userId = '00000000-0000-0000-0000-000000000010'
const profiles = new Map()
const cloudinaryAssets = new Map()
const originalProfileMethods = {
  findUnique: prisma.profile.findUnique,
  upsert: prisma.profile.upsert,
  update: prisma.profile.update,
}

let server
let baseUrl
let failNextStorageRequest = false
let failNextProfileWrite = false
const destroyedPublicIds = []
const originalFetch = globalThis.fetch

globalThis.fetch = async (input, options) => {
  const url = String(input)
  if (!url.includes('api.cloudinary.com')) return originalFetch(input, options)
  if (failNextStorageRequest) {
    failNextStorageRequest = false
    return new Response(JSON.stringify({ error: { message: 'provider unavailable' } }), { status: 503 })
  }

  if (url.includes('/resources/image/upload/')) {
    const assetPublicId = url.split('/resources/image/upload/')[1].split('/').map(decodeURIComponent).join('/')
    const asset = cloudinaryAssets.get(assetPublicId)
    return new Response(JSON.stringify(asset || { error: { message: 'not found' } }), { status: asset ? 200 : 404 })
  }

  const fields = options.body
  if (url.endsWith('/image/destroy')) destroyedPublicIds.push(fields.get('public_id'))
  const publicId = fields.get('public_id')
  if (url.endsWith('/image/upload')) {
    assert.match(fields.get('signature'), /^[a-f0-9]{40}$/)
    assert.equal(fields.get('api_key'), 'test-api-key')
    assert.equal(fields.get('api_secret'), null)
    const file = fields.get('file')
    const format = file.type === 'image/webp' ? 'webp' : file.type === 'image/jpeg' ? 'jpg' : 'png'
    const assetPublicId = `profile-images/${publicId}`
    const secureUrl = `https://res.cloudinary.com/test-cloud/image/upload/v123/${assetPublicId}.${format}`
    const asset = { secure_url: secureUrl, public_id: assetPublicId, format, bytes: file.size }
    cloudinaryAssets.set(assetPublicId, asset)
    return new Response(JSON.stringify(asset), { status: 200 })
  }
  if (url.endsWith('/image/destroy')) cloudinaryAssets.delete(publicId)
  return new Response(JSON.stringify({ result: 'ok' }), { status: 200 })
}

before(async () => {
  prisma.profile.findUnique = async ({ where }) => profiles.get(where.userId) ?? null
  prisma.profile.upsert = async ({ where, create, update }) => {
    if (failNextProfileWrite) {
      failNextProfileWrite = false
      throw new Error('Database unavailable')
    }
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
  globalThis.fetch = originalFetch
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
  assert.match(uploadBody.profile.profileImage, /^https:\/\/res\.cloudinary\.com\/test-cloud\/image\/upload\//)
})

test('profile image replacement persists the new image and removes the previous Cloudinary asset', async () => {
  const previous = profiles.get(userId).profileImage
  let deletedUrl
  const providerFetch = globalThis.fetch
  globalThis.fetch = async (input, options) => {
    if (String(input).endsWith('/image/destroy')) {
      deletedUrl = options.body.get('public_id')
      destroyedPublicIds.push(deletedUrl)
      return new Response(JSON.stringify({ result: 'ok' }), { status: 200 })
    }
    return providerFetch(input, options)
  }

  const image = new FormData()
  image.append('image', new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }), 'next.png')
  try {
    const response = await request('/api/profile/image', { method: 'POST', token, body: image })
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.notEqual(body.profile.profileImage, previous)
    assert.equal(profiles.get(userId).profileImage, body.profile.profileImage)
    assert.match(deletedUrl, /^profile-images\//)
  } finally {
    globalThis.fetch = providerFetch
  }
})

test('authenticated direct upload signature finalizes only a verified user-owned Cloudinary image', async () => {
  const signatureResponse = await request('/api/profile/image/signature', { method: 'POST', token, body: '{}' })
  const settings = await signatureResponse.json()
  assert.equal(signatureResponse.status, 200)
  assert.equal(settings.directUpload, true)
  assert.equal(settings.cloudName, 'test-cloud')
  assert.match(settings.parameters.public_id, new RegExp(`^${userId}-`))
  assert.match(settings.signature, /^[a-f0-9]{40}$/)

  const uploadForm = new FormData()
  uploadForm.append('file', new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }), 'direct.png')
  uploadForm.append('api_key', settings.apiKey)
  for (const [key, value] of Object.entries(settings.parameters)) uploadForm.append(key, String(value))
  uploadForm.append('signature', settings.signature)
  const providerResponse = await fetch(settings.uploadUrl, { method: 'POST', body: uploadForm })
  const uploaded = await providerResponse.json()

  const completeResponse = await request('/api/profile/image/complete', {
    method: 'POST',
    token,
    body: JSON.stringify({
      secure_url: uploaded.secure_url,
      public_id: uploaded.public_id,
      format: uploaded.format,
      bytes: uploaded.bytes,
    }),
  })
  const body = await completeResponse.json()

  assert.equal(completeResponse.status, 200)
  assert.equal(body.profile.profileImage, uploaded.secure_url)
})

test('provider upload failures do not replace the current saved image', async () => {
  const currentImage = profiles.get(userId).profileImage
  failNextStorageRequest = true
  const image = new FormData()
  image.append('image', new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }), 'failed.png')

  const response = await request('/api/profile/image', { method: 'POST', token, body: image })
  assert.equal(response.status, 502)
  assert.equal(profiles.get(userId).profileImage, currentImage)
})

test('database failures after provider upload trigger cleanup and preserve the saved image', async () => {
  const currentImage = profiles.get(userId).profileImage
  let uploadedId
  let deletedId
  const providerFetch = globalThis.fetch
  globalThis.fetch = async (input, options) => {
    if (String(input).endsWith('/image/upload')) uploadedId = options.body.get('public_id')
    if (String(input).endsWith('/image/destroy')) deletedId = options.body.get('public_id')
    return providerFetch(input, options)
  }
  failNextProfileWrite = true
  const image = new FormData()
  image.append('image', new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }), 'db-failure.png')

  try {
    const response = await request('/api/profile/image', { method: 'POST', token, body: image })
    assert.equal(response.status, 500)
    assert.equal(profiles.get(userId).profileImage, currentImage)
    assert.equal(deletedId, `profile-images/${uploadedId}`)
  } finally {
    globalThis.fetch = providerFetch
  }
})

test('authenticated user can remove their profile image', async () => {
  const imageUrl = profiles.get(userId).profileImage
  const response = await request('/api/profile/image', { method: 'DELETE', token })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.profile.profileImage, null)
  assert.ok(destroyedPublicIds.some((publicId) => imageUrl.endsWith(`/${publicId}.png`)))
})

test('provider delete failures clear the profile reference and return an explicit error', async () => {
  const image = new FormData()
  image.append('image', new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }), 'delete-failure.png')
  await request('/api/profile/image', { method: 'POST', token, body: image })

  failNextStorageRequest = true
  const response = await request('/api/profile/image', { method: 'DELETE', token })
  const body = await response.json()

  assert.equal(response.status, 502)
  assert.match(body.error, /storage cleanup failed/i)
  assert.equal(profiles.get(userId).profileImage, null)
})

test('removing a Cloudinary URL outside the authenticated user namespace does not delete that asset', async () => {
  const foreignImage = 'https://res.cloudinary.com/test-cloud/image/upload/v123/profile-images/00000000-0000-0000-0000-000000000999-foreign.png'
  await request('/api/profile', {
    method: 'PUT',
    token,
    body: JSON.stringify({ profileImage: foreignImage }),
  })
  const deletedBefore = destroyedPublicIds.length

  const response = await request('/api/profile/image', { method: 'DELETE', token })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.profile.profileImage, null)
  assert.equal(destroyedPublicIds.length, deletedBefore)
})
