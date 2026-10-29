import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApp } from '../src/express-app.js'
import { prisma } from '../src/config/prisma.js'
import { signAccessToken } from '../src/utils/jwt.js'

process.env.JWT_SECRET = 'portfolio-test-secret'
process.env.JWT_EXPIRES_IN = '1h'

const userId = '00000000-0000-0000-0000-000000000020'
const otherUserId = '00000000-0000-0000-0000-000000000021'
const portfolioStore = new Map()
const profileStore = new Map()
const skillStore = new Map()

const originalMethods = {
  portfolioFindUnique: prisma.portfolio.findUnique,
  portfolioFindFirst: prisma.portfolio.findFirst,
  portfolioFindMany: prisma.portfolio.findMany,
  portfolioCreate: prisma.portfolio.create,
  portfolioUpdate: prisma.portfolio.update,
  portfolioDelete: prisma.portfolio.delete,
  profileFindUnique: prisma.profile.findUnique,
  skillFindMany: prisma.skill.findMany,
  educationFindMany: prisma.education.findMany,
  experienceFindMany: prisma.experience.findMany,
  projectFindMany: prisma.project.findMany,
  certificateFindMany: prisma.certificate.findMany,
}

let server
let baseUrl

before(async () => {
  prisma.portfolio.findUnique = async ({ where }) => {
    if (where.id) return portfolioStore.get(where.id) ?? null
    if (where.slug) return portfolioStore.get(where.slug) ?? null
    return null
  }
  prisma.portfolio.findFirst = async ({ where }) => {
    const result = [...portfolioStore.values()].find((portfolio) => portfolio.userId === where.userId)
    return result ?? null
  }
  prisma.portfolio.findMany = async ({ where }) => [...portfolioStore.values()].filter((portfolio) => portfolio.userId === where.userId)
  prisma.portfolio.create = async ({ data }) => {
    const portfolio = {
      id: `00000000-0000-0000-0000-${String(portfolioStore.size + 101).padStart(12, '0')}`,
      userId: data.userId,
      title: data.title,
      slug: data.slug,
      template: data.template ?? 'professional',
      isPublished: data.isPublished ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: data.userId,
        name: data.userId === otherUserId ? 'Other User' : 'Test User',
        profile: profileStore.get(data.userId) ?? null,
        education: [],
        experience: [],
        skills: skillStore.get(data.userId) ?? [],
        projects: [],
        certificates: [],
      },
    }
    portfolioStore.set(portfolio.id, portfolio)
    portfolioStore.set(portfolio.slug, portfolio)
    return portfolio
  }
  prisma.portfolio.update = async ({ where, data }) => {
    const current = portfolioStore.get(where.id) ?? portfolioStore.get(where.slug)
    if (!current) throw new Error('Portfolio not found')
    const next = { ...current, ...data, updatedAt: new Date() }
    if (data.slug && data.slug !== current.slug) {
      portfolioStore.delete(current.slug)
    }
    portfolioStore.set(next.id, next)
    portfolioStore.set(next.slug, next)
    return next
  }
  prisma.portfolio.delete = async ({ where }) => {
    const current = portfolioStore.get(where.id) ?? portfolioStore.get(where.slug)
    if (!current) throw new Error('Portfolio not found')
    portfolioStore.delete(current.id)
    portfolioStore.delete(current.slug)
    return current
  }

  prisma.profile.findUnique = async ({ where }) => {
    const profile = profileStore.get(where.userId)
    if (!profile) return null
    return { ...profile }
  }
  prisma.skill.findMany = async ({ where }) => skillStore.get(where.userId) ?? []
  prisma.education.findMany = async ({ where }) => []
  prisma.experience.findMany = async ({ where }) => []
  prisma.project.findMany = async ({ where }) => []
  prisma.certificate.findMany = async ({ where }) => []

  profileStore.set(userId, {
    id: '00000000-0000-0000-0000-000000000030',
    userId,
    phone: '+123456789',
    location: 'Paris, France',
    headline: 'Senior full-stack developer',
    bio: 'Building elegant systems with clear UX.',
    profileImage: null,
    linkedinUrl: 'https://linkedin.com/in/example',
    githubUrl: 'https://github.com/example',
    websiteUrl: 'https://example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  skillStore.set(userId, [
    { id: 'a', userId, name: 'React', category: 'Frontend', proficiency: 90 },
    { id: 'b', userId, name: 'Node.js', category: 'Backend', proficiency: 88 },
  ])

  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  prisma.portfolio.findUnique = originalMethods.portfolioFindUnique
  prisma.portfolio.findFirst = originalMethods.portfolioFindFirst
  prisma.portfolio.findMany = originalMethods.portfolioFindMany
  prisma.portfolio.create = originalMethods.portfolioCreate
  prisma.portfolio.update = originalMethods.portfolioUpdate
  prisma.portfolio.delete = originalMethods.portfolioDelete
  prisma.profile.findUnique = originalMethods.profileFindUnique
  prisma.skill.findMany = originalMethods.skillFindMany
  prisma.education.findMany = originalMethods.educationFindMany
  prisma.experience.findMany = originalMethods.experienceFindMany
  prisma.project.findMany = originalMethods.projectFindMany
  prisma.certificate.findMany = originalMethods.certificateFindMany
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

const token = signAccessToken(userId)
const otherToken = signAccessToken(otherUserId)

test('publishing requires authentication, a saved portfolio, and a boolean state', async () => {
  const unauthenticatedResponse = await request('/api/portfolio/publish', {
    method: 'PATCH',
    body: JSON.stringify({ isPublished: true }),
  })
  assert.equal(unauthenticatedResponse.status, 401)

  const missingPortfolioResponse = await request('/api/portfolio/publish', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ isPublished: true }),
  })
  assert.equal(missingPortfolioResponse.status, 404)

  const invalidStateResponse = await request('/api/portfolio/publish', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ isPublished: 'true' }),
  })
  assert.equal(invalidStateResponse.status, 400)
})

test('authenticated user can create and read their portfolio', async () => {
  const createResponse = await request('/api/portfolio', {
    method: 'POST',
    token,
    body: JSON.stringify({ title: 'Rafael Mgozi', slug: 'rafael-mgozi', template: 'professional' }),
  })

  assert.equal(createResponse.status, 201)
  const createBody = await createResponse.json()
  assert.equal(createBody.portfolio.userId, userId)
  assert.equal(createBody.portfolio.slug, 'rafael-mgozi')

  const listResponse = await request('/api/portfolio', { token })
  assert.equal(listResponse.status, 200)
  const listBody = await listResponse.json()
  assert.equal(listBody.portfolio.userId, userId)
  assert.equal(listBody.portfolio.slug, 'rafael-mgozi')
})

test('portfolio publish state controls public access', async () => {
  const privateResponse = await request('/api/public/portfolio/rafael-mgozi')
  assert.equal(privateResponse.status, 404)

  const publishResponse = await request('/api/portfolio/publish', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ isPublished: true }),
  })
  assert.equal(publishResponse.status, 200)
  const publishBody = await publishResponse.json()
  assert.equal(publishBody.portfolio.isPublished, true)

  const refreshedResponse = await request('/api/portfolio', { token })
  assert.equal(refreshedResponse.status, 200)
  assert.equal((await refreshedResponse.json()).portfolio.isPublished, true)

  const publicResponse = await request('/api/public/portfolio/rafael-mgozi')
  assert.equal(publicResponse.status, 200)
  const publicBody = await publicResponse.json()
  assert.equal(publicBody.portfolio.slug, 'rafael-mgozi')
  assert.equal(publicBody.portfolio.user.name, 'Test User')
  assert.equal('passwordHash' in publicBody.portfolio.user, false)

  const unpublishResponse = await request('/api/portfolio/publish', {
    method: 'PATCH',
    token,
    body: JSON.stringify({ isPublished: false }),
  })
  assert.equal(unpublishResponse.status, 200)
  const unpublishBody = await unpublishResponse.json()
  assert.equal(unpublishBody.portfolio.isPublished, false)

  const hiddenResponse = await request('/api/public/portfolio/rafael-mgozi')
  assert.equal(hiddenResponse.status, 404)
})

test('public route rejects invalid or unpublished portfolio slugs', async () => {
  const invalidResponse = await request('/api/public/portfolio/does-not-exist')
  assert.equal(invalidResponse.status, 404)

  const otherUserPortfolio = await request('/api/portfolio', {
    method: 'POST',
    token: otherToken,
    body: JSON.stringify({ title: 'Other portfolio', slug: 'other-portfolio', template: 'modern' }),
  })
  assert.equal(otherUserPortfolio.status, 201)

  const forbiddenResponse = await request('/api/portfolio', {
    method: 'PUT',
    token,
    body: JSON.stringify({ title: 'Attempted takeover', slug: 'other-portfolio' }),
  })
  assert.equal(forbiddenResponse.status, 409)
})
