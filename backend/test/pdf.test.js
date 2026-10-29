import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import { signAccessToken } from '../src/utils/jwt.js'

process.env.JWT_SECRET = 'ai-test-secret'
process.env.JWT_EXPIRES_IN = '1h'
process.env.FRONTEND_URL = 'https://my-frontend.vercel.app'
process.env.CORS_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud'
process.env.CLOUDINARY_API_KEY = 'test-api-key'
process.env.CLOUDINARY_API_SECRET = 'test-api-secret'

const userId = '00000000-0000-0000-0000-000000000300'
const otherUserId = '00000000-0000-0000-0000-000000000301'

const originalMethods = {
  userFindUnique: prisma.user.findUnique,
  profileFindUnique: prisma.profile.findUnique,
  educationFindMany: prisma.education.findMany,
  experienceFindMany: prisma.experience.findMany,
  skillFindMany: prisma.skill.findMany,
  projectFindMany: prisma.project.findMany,
  certificateFindMany: prisma.certificate.findMany,
}

let server
let baseUrl
let profileImage = null
let longCvDescription = ''
let remoteImageMode = 'success'
const originalFetch = globalThis.fetch
const profileImageFilename = `pdf-test-${randomUUID()}.png`
const pngFixture = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')

globalThis.fetch = async (input, options) => {
  const url = String(input)
  if (!url.startsWith('https://res.cloudinary.com/')) return originalFetch(input, options)
  if (remoteImageMode === 'failure') return new Response('Unavailable', { status: 503 })
  if (remoteImageMode === 'oversized') {
    return new Response(new Uint8Array(10), {
      status: 200,
      headers: { 'content-type': 'image/png', 'content-length': String(6 * 1024 * 1024) },
    })
  }
  return new Response(pngFixture, {
    status: 200,
    headers: { 'content-type': 'image/png', 'content-length': String(pngFixture.length) },
  })
}

before(async () => {
  await mkdir('uploads/profile-images', { recursive: true })
  prisma.user.findUnique = async ({ where }) => {
    if (where.id === userId) {
      return {
        id: userId,
        name: 'Rafael Mgozi',
        email: 'rafael@example.com',
      }
    }
    if (where.id === otherUserId) {
      return {
        id: otherUserId,
        name: 'Other User',
        email: 'other@example.com',
      }
    }
    return null
  }

  prisma.profile.findUnique = async ({ where }) => {
    if (where.userId === userId) {
      return {
        id: '00000000-0000-0000-0000-000000000310',
        userId,
        headline: 'Product-minded software developer',
        bio: 'Software developer focused on clean product experiences and reliable systems.',
        phone: '+254700000000',
        location: 'Nairobi, Kenya',
        linkedinUrl: 'https://linkedin.com/in/rafaelmgozi',
        githubUrl: 'https://github.com/rafaelmgozi',
        websiteUrl: 'https://rafaelmgozi.dev',
        profileImage,
      }
    }
    return null
  }

  prisma.education.findMany = async ({ where }) => {
    if (where.userId !== userId) return []
    return [{
      id: '00000000-0000-0000-0000-000000000311',
      userId,
      institution: 'University of Nairobi',
      degree: 'BSc Computer Science',
      field: 'Computer Science',
      startDate: new Date('2020-01-01'),
      endDate: new Date('2024-01-01'),
      description: 'Graduate degree in computer science.',
    }]
  }

  prisma.experience.findMany = async ({ where }) => {
    if (where.userId !== userId) return []
    return [{
      id: '00000000-0000-0000-0000-000000000312',
      userId,
      company: 'Open Source Studio',
      position: 'Frontend Developer',
      startDate: new Date('2023-01-01'),
      endDate: null,
      description: longCvDescription || 'Built product experiences for clients and collaborated on engineering teams.',
    }]
  }

  prisma.skill.findMany = async ({ where }) => {
    if (where.userId !== userId) return []
    return [
      { id: '00000000-0000-0000-0000-000000000313', userId, name: 'React', category: 'Frontend', proficiency: 90 },
      { id: '00000000-0000-0000-0000-000000000314', userId, name: 'Node.js', category: 'Backend', proficiency: 85 },
    ]
  }

  prisma.project.findMany = async ({ where }) => {
    if (where.userId !== userId) return []
    return [{
      id: '00000000-0000-0000-0000-000000000315',
      userId,
      title: 'Portfolio Platform',
      description: 'Built a portfolio platform for professionals to manage and publish their work.',
      technologies: ['React', 'Node.js', 'PostgreSQL'],
      githubUrl: 'https://github.com/example/portfolio-platform',
      liveUrl: 'https://example.com',
      imageUrl: null,
    }]
  }

  prisma.certificate.findMany = async ({ where }) => {
    if (where.userId !== userId) return []
    return [{
      id: '00000000-0000-0000-0000-000000000316',
      userId,
      name: 'Full Stack Web Development',
      issuer: 'Coursera',
      issueDate: new Date('2024-06-01'),
      credentialUrl: 'https://example.com/certificate',
    }]
  }

  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await rm(`uploads/profile-images/${profileImageFilename}`, { force: true })
  prisma.user.findUnique = originalMethods.userFindUnique
  prisma.profile.findUnique = originalMethods.profileFindUnique
  prisma.education.findMany = originalMethods.educationFindMany
  prisma.experience.findMany = originalMethods.experienceFindMany
  prisma.skill.findMany = originalMethods.skillFindMany
  prisma.project.findMany = originalMethods.projectFindMany
  prisma.certificate.findMany = originalMethods.certificateFindMany
  globalThis.fetch = originalFetch
  server.close()
  await prisma.$disconnect()
})

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  })
}

test('unauthenticated user cannot generate PDF', async () => {
  const response = await request('/api/cv/pdf')
  assert.equal(response.status, 401)
})

test('PDF preflight allows the deployed frontend origin without authentication', async () => {
  const response = await request('/api/cv/pdf', {
    method: 'OPTIONS',
    headers: {
      origin: 'https://my-frontend.vercel.app',
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'authorization',
    },
  })

  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://my-frontend.vercel.app')
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
  assert.match(response.headers.get('access-control-allow-methods') || '', /GET/)
  assert.match(response.headers.get('access-control-allow-headers') || '', /Authorization/i)
})

test('PDF preflight allows the local frontend origin', async () => {
  const response = await request('/api/cv/pdf', {
    method: 'OPTIONS',
    headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'GET',
      'access-control-request-headers': 'authorization',
    },
  })

  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
})

test('authenticated user can generate their own PDF', async () => {
  const response = await request('/api/cv/pdf', {
    headers: {
      origin: 'https://my-frontend.vercel.app',
      authorization: `Bearer ${signAccessToken(userId)}`,
    },
  })
  const pdf = Buffer.from(await response.arrayBuffer())

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://my-frontend.vercel.app')
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
  assert.match(response.headers.get('access-control-expose-headers') || '', /Content-Disposition/i)
  assert.match(response.headers.get('content-disposition') || '', /attachment/i)
  assert.ok(pdf.length > 100)
  assert.match(pdf.toString('latin1'), /^%PDF/)
})

test('authenticated local frontend can request the PDF endpoint', async () => {
  const response = await request('/api/cv/pdf', {
    headers: {
      origin: 'http://localhost:5173',
      authorization: `Bearer ${signAccessToken(userId)}`,
    },
  })

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173')
  assert.equal(response.headers.get('content-type'), 'application/pdf')
})

test('authenticated user can export each CV template and color preset', async () => {
  const selections = [
    ['professional', 'navy'],
    ['modern', 'teal'],
    ['classic', 'royal'],
    ['minimal', 'burgundy'],
    ['creative', 'forest'],
    ['professional', 'monochrome'],
  ]

  for (const [template, colorPreset] of selections) {
    const query = new URLSearchParams({
      template,
      colorPreset,
      title: 'Selected CV',
      sections: 'summary,experience,skills,projects',
    })
    const response = await request(`/api/cv/pdf?${query}`, { token: signAccessToken(userId) })
    const pdf = Buffer.from(await response.arrayBuffer())

    assert.equal(response.status, 200, `${template}/${colorPreset} should export`)
    assert.match(pdf.toString('latin1'), /^%PDF/)
  }
})

test('long CV descriptions flow onto additional PDF pages', async () => {
  longCvDescription = 'Designed, implemented, tested, and documented accessible software experiences. '.repeat(180)
  try {
    const response = await request('/api/cv/pdf?template=professional&colorPreset=navy', { token: signAccessToken(userId) })
    const pdf = Buffer.from(await response.arrayBuffer())
    const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length

    assert.equal(response.status, 200)
    assert.ok(pageCount > 1, `expected multiple PDF pages, received ${pageCount}`)
  } finally {
    longCvDescription = ''
  }
})

test('PDF succeeds with a valid stored profile image', async () => {
  await mkdir('uploads/profile-images', { recursive: true })
  await writeFile(`uploads/profile-images/${profileImageFilename}`, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'))
  profileImage = `/uploads/profile-images/${profileImageFilename}`

  const response = await request('/api/cv/pdf', { token: signAccessToken(userId) })
  const pdf = Buffer.from(await response.arrayBuffer())

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  assert.match(response.headers.get('content-disposition') || '', /Rafael-Mgozi-cv\.pdf/)
  assert.match(pdf.toString('latin1'), /^%PDF/)
})

test('PDF succeeds when the stored profile image is missing', async () => {
  profileImage = '/uploads/profile-images/missing.png'

  const response = await request('/api/cv/pdf', { token: signAccessToken(userId) })
  const pdf = Buffer.from(await response.arrayBuffer())

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  assert.match(pdf.toString('latin1'), /^%PDF/)
})

test('PDF embeds a validated remote Cloudinary profile image', async () => {
  profileImage = 'https://res.cloudinary.com/test-cloud/image/upload/v123/profile-images/cv-test.png'
  remoteImageMode = 'success'

  const response = await request('/api/cv/pdf', { token: signAccessToken(userId) })
  const pdf = Buffer.from(await response.arrayBuffer())

  assert.equal(response.status, 200)
  assert.match(pdf.toString('latin1'), /^%PDF/)
})

test('PDF generation continues without a remote image when storage fails or exceeds the size limit', async () => {
  profileImage = 'https://res.cloudinary.com/test-cloud/image/upload/v123/profile-images/cv-test.png'

  for (const mode of ['failure', 'oversized']) {
    remoteImageMode = mode
    const response = await request('/api/cv/pdf', { token: signAccessToken(userId) })
    const pdf = Buffer.from(await response.arrayBuffer())
    assert.equal(response.status, 200, `${mode} image fetch should not fail PDF generation`)
    assert.match(pdf.toString('latin1'), /^%PDF/)
  }
})

test('PDF does not fetch arbitrary remote profile image URLs', async () => {
  let attemptedExternalFetch = false
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (input, options) => {
    if (String(input).startsWith('https://outside.example/')) attemptedExternalFetch = true
    return previousFetch(input, options)
  }
  profileImage = 'https://outside.example/profile.png'
  try {
    const response = await request('/api/cv/pdf', { token: signAccessToken(userId) })
    assert.equal(response.status, 200)
    assert.equal(attemptedExternalFetch, false)
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('user cannot generate another user PDF', async () => {
  const response = await request('/api/cv/pdf', { token: signAccessToken(otherUserId) })
  assert.equal(response.status, 404)
})
