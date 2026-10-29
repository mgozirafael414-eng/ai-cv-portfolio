/**
 * Phase 11 — Step 2: Authorization and Ownership Protection
 *
 * Two users (User A and User B) are used throughout.
 * User A owns all created records. User B attempts every
 * cross-user operation — all must fail safely.
 */

import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { createApp } from '../src/express-app.js'
import { prisma } from '../src/config/prisma.js'
import { signAccessToken } from '../src/utils/jwt.js'

process.env.JWT_SECRET = 'authorization-test-secret'
process.env.JWT_EXPIRES_IN = '1h'
process.env.GROQ_API_KEY = 'test-key'
process.env.GROQ_MOCK_MODE = 'true'

// ---------------------------------------------------------------------------
// User identities
// ---------------------------------------------------------------------------

const userA = {
  id: '00000000-aaaa-4000-8000-000000000001',
  name: 'User A',
  email: 'usera@example.com',
}
const userB = {
  id: '00000000-bbbb-4000-8000-000000000002',
  name: 'User B',
  email: 'userb@example.com',
}

const tokenA = signAccessToken(userA.id)
const tokenB = signAccessToken(userB.id)

// ---------------------------------------------------------------------------
// In-memory stores (keyed by record ID)
// ---------------------------------------------------------------------------

const stores = {
  profile: new Map(),       // keyed by userId
  education: new Map(),
  experience: new Map(),
  skill: new Map(),
  project: new Map(),
  certificate: new Map(),
  portfolio: new Map(),     // also keyed by slug
  portfolioBySlug: new Map(),
  aIGeneration: new Map(),
}

let idCounter = 0
function makeId() {
  idCounter += 1
  return `00000000-cccc-4000-8000-${String(idCounter).padStart(12, '0')}`
}

// ---------------------------------------------------------------------------
// Saved original Prisma methods (restored in after())
// ---------------------------------------------------------------------------

const originals = {}
const modelNames = ['profile', 'education', 'experience', 'skill', 'project', 'certificate', 'portfolio', 'aIGeneration']
const methodNames = ['findUnique', 'findFirst', 'findMany', 'create', 'update', 'delete', 'upsert']

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

let server
let baseUrl

before(async () => {
  // Save originals
  for (const m of modelNames) {
    originals[m] = {}
    for (const fn of methodNames) {
      if (typeof prisma[m]?.[fn] === 'function') {
        originals[m][fn] = prisma[m][fn]
      }
    }
  }

  // --- Profile stubs ---
  prisma.profile.findUnique = async ({ where }) => {
    if (where.userId) return stores.profile.get(where.userId) ?? null
    if (where.id) return [...stores.profile.values()].find((p) => p.id === where.id) ?? null
    return null
  }
  prisma.profile.upsert = async ({ where, create, update }) => {
    const existing = stores.profile.get(where.userId)
    const record = existing
      ? { ...existing, ...update, updatedAt: new Date() }
      : { id: makeId(), createdAt: new Date(), updatedAt: new Date(), ...create }
    stores.profile.set(where.userId, record)
    return record
  }
  prisma.profile.update = async ({ where, data }) => {
    const record = stores.profile.get(where.userId)
    if (!record) throw Object.assign(new Error('Profile not found'), { code: 'P2025' })
    const next = { ...record, ...data, updatedAt: new Date() }
    stores.profile.set(where.userId, next)
    return next
  }

  // --- Generic CRUD resource stub factory ---
  function stubResource(modelName) {
    const store = stores[modelName]
    prisma[modelName].findMany = async ({ where }) => {
      if (where.userId) return [...store.values()].filter((r) => r.userId === where.userId)
      return [...store.values()]
    }
    prisma[modelName].findFirst = async ({ where }) => {
      const r = store.get(where.id)
      if (!r) return null
      if (where.userId && r.userId !== where.userId) return null
      return r
    }
    prisma[modelName].findUnique = async ({ where }) => store.get(where.id) ?? null
    prisma[modelName].create = async ({ data }) => {
      const record = { id: makeId(), createdAt: new Date(), updatedAt: new Date(), ...data }
      store.set(record.id, record)
      return record
    }
    prisma[modelName].update = async ({ where, data }) => {
      const record = store.get(where.id)
      if (!record) throw Object.assign(new Error(`${modelName} not found`), { code: 'P2025' })
      const next = { ...record, ...data, updatedAt: new Date() }
      store.set(where.id, next)
      return next
    }
    prisma[modelName].delete = async ({ where }) => {
      const record = store.get(where.id)
      if (!record) throw Object.assign(new Error(`${modelName} not found`), { code: 'P2025' })
      store.delete(where.id)
      return record
    }
  }

  for (const name of ['education', 'experience', 'skill', 'project', 'certificate']) {
    stubResource(name)
  }

  // --- Portfolio stubs ---
  prisma.portfolio.findFirst = async ({ where }) =>
    [...stores.portfolio.values()].find((p) => p.userId === where.userId) ?? null
  prisma.portfolio.findUnique = async ({ where }) => {
    if (where.id) return stores.portfolio.get(where.id) ?? null
    if (where.slug) return stores.portfolioBySlug.get(where.slug) ?? null
    return null
  }
  prisma.portfolio.create = async ({ data }) => {
    const record = {
      id: makeId(),
      isPublished: false,
      template: 'professional',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
      // include nested user for public portfolio endpoint
      user: {
        id: data.userId,
        name: data.userId === userA.id ? userA.name : userB.name,
        profile: stores.profile.get(data.userId) ?? null,
        education: [],
        experience: [],
        skills: [],
        projects: [],
        certificates: [],
      },
    }
    stores.portfolio.set(record.id, record)
    stores.portfolioBySlug.set(record.slug, record)
    return record
  }
  prisma.portfolio.update = async ({ where, data }) => {
    const record = stores.portfolio.get(where.id) ?? stores.portfolioBySlug.get(where.slug)
    if (!record) throw Object.assign(new Error('Portfolio not found'), { code: 'P2025' })
    if (data.slug && data.slug !== record.slug) stores.portfolioBySlug.delete(record.slug)
    const next = { ...record, ...data, updatedAt: new Date() }
    stores.portfolio.set(next.id, next)
    stores.portfolioBySlug.set(next.slug, next)
    return next
  }

  // --- AIGeneration stubs ---
  prisma.aIGeneration.create = async ({ data }) => {
    const record = {
      id: makeId(),
      status: 'PENDING',
      targetType: null,
      targetId: null,
      editedText: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }
    stores.aIGeneration.set(record.id, record)
    return record
  }
  prisma.aIGeneration.findMany = async ({ where }) =>
    [...stores.aIGeneration.values()].filter((r) => r.userId === where.userId)
  prisma.aIGeneration.findUnique = async ({ where }) =>
    stores.aIGeneration.get(where.id) ?? null
  prisma.aIGeneration.update = async ({ where, data }) => {
    const record = stores.aIGeneration.get(where.id)
    if (!record) throw Object.assign(new Error('AIGeneration not found'), { code: 'P2025' })
    const next = { ...record, ...data, updatedAt: new Date() }
    stores.aIGeneration.set(where.id, next)
    return next
  }

  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  for (const m of modelNames) {
    for (const fn of Object.keys(originals[m] ?? {})) {
      prisma[m][fn] = originals[m][fn]
    }
  }
  server.close()
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

async function req(path, { token, method = 'GET', body } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

// ---------------------------------------------------------------------------
// Setup: User A creates one record of every type
// ---------------------------------------------------------------------------

// These are populated during the "User A setup" describe block and referenced
// throughout the cross-user attack tests below.
const created = {}

describe('User A setup — create one record of every resource type', () => {
  test('User A creates a profile', async () => {
    const r = await req('/api/profile', {
      token: tokenA,
      method: 'PUT',
      body: { headline: 'Software Engineer', bio: 'Builds things.' },
    })
    assert.ok([200, 201].includes(r.status), `Expected 200/201 but got ${r.status}`)
    const body = await r.json()
    assert.equal(body.profile.userId, userA.id)
    created.profileUserId = userA.id
  })

  test('User A creates an education record', async () => {
    const r = await req('/api/education', {
      token: tokenA,
      method: 'POST',
      body: { institution: 'University A', degree: 'BSc', field: 'CS' },
    })
    assert.equal(r.status, 201)
    const body = await r.json()
    created.educationId = body.education.id
    assert.equal(body.education.userId, userA.id)
  })

  test('User A creates an experience record', async () => {
    const r = await req('/api/experience', {
      token: tokenA,
      method: 'POST',
      body: { company: 'Acme Corp', position: 'Engineer' },
    })
    assert.equal(r.status, 201)
    const body = await r.json()
    created.experienceId = body.experience.id
    assert.equal(body.experience.userId, userA.id)
  })

  test('User A creates a skill record', async () => {
    const r = await req('/api/skills', {
      token: tokenA,
      method: 'POST',
      body: { name: 'TypeScript' },
    })
    assert.equal(r.status, 201)
    const body = await r.json()
    created.skillId = body.skill.id
    assert.equal(body.skill.userId, userA.id)
  })

  test('User A creates a project record', async () => {
    const r = await req('/api/projects', {
      token: tokenA,
      method: 'POST',
      body: { title: 'User A Project', description: 'A project by User A.' },
    })
    assert.equal(r.status, 201)
    const body = await r.json()
    created.projectId = body.project.id
    assert.equal(body.project.userId, userA.id)
  })

  test('User A creates a certificate record', async () => {
    const r = await req('/api/certificates', {
      token: tokenA,
      method: 'POST',
      body: { name: 'AWS Certified', issuer: 'Amazon' },
    })
    assert.equal(r.status, 201)
    const body = await r.json()
    created.certificateId = body.certificate.id
    assert.equal(body.certificate.userId, userA.id)
  })

  test('User A creates a portfolio', async () => {
    const r = await req('/api/portfolio', {
      token: tokenA,
      method: 'POST',
      body: { title: 'User A Portfolio', slug: 'user-a-portfolio' },
    })
    assert.equal(r.status, 201)
    const body = await r.json()
    created.portfolioId = body.portfolio.id
    created.portfolioSlug = body.portfolio.slug
    assert.equal(body.portfolio.userId, userA.id)
  })

  test('User A creates an AI recommendation (improve summary)', async () => {
    const r = await req('/api/ai/improve-summary', {
      token: tokenA,
      method: 'POST',
      body: { text: 'Software engineer with experience in web development.' },
    })
    assert.ok([200, 201].includes(r.status), `Expected 200/201 but got ${r.status}`)
    const body = await r.json()
    // Find the stored recommendation for User A
    const gen = [...stores.aIGeneration.values()].find((g) => g.userId === userA.id)
    assert.ok(gen, 'AI generation record must be stored for User A')
    created.recommendationId = gen.id
  })
})

// ---------------------------------------------------------------------------
// User B cross-user attack tests
// ---------------------------------------------------------------------------

describe('User B cannot read User A private records', () => {
  test('User B list education returns only User B records (empty)', async () => {
    const r = await req('/api/education', { token: tokenB })
    assert.equal(r.status, 200)
    const body = await r.json()
    const ids = body.educations.map((e) => e.id)
    assert.ok(!ids.includes(created.educationId), 'User B must not see User A education')
  })

  test('User B list experience returns only User B records (empty)', async () => {
    const r = await req('/api/experience', { token: tokenB })
    assert.equal(r.status, 200)
    const body = await r.json()
    assert.ok(!body.experiences.some((e) => e.userId === userA.id))
  })

  test('User B list skills returns only User B records (empty)', async () => {
    const r = await req('/api/skills', { token: tokenB })
    assert.equal(r.status, 200)
    const body = await r.json()
    assert.ok(!body.skills.some((s) => s.userId === userA.id))
  })

  test('User B list projects returns only User B records (empty)', async () => {
    const r = await req('/api/projects', { token: tokenB })
    assert.equal(r.status, 200)
    const body = await r.json()
    assert.ok(!body.projects.some((p) => p.userId === userA.id))
  })

  test('User B list certificates returns only User B records (empty)', async () => {
    const r = await req('/api/certificates', { token: tokenB })
    assert.equal(r.status, 200)
    const body = await r.json()
    assert.ok(!body.certificates.some((c) => c.userId === userA.id))
  })

  test('User B GET profile returns 404 (no profile for User B)', async () => {
    const r = await req('/api/profile', { token: tokenB })
    // User B has no profile — must not return User A profile
    assert.ok([404].includes(r.status))
    if (r.status === 200) {
      const body = await r.json()
      assert.notEqual(body.profile?.userId, userA.id, 'User B must never receive User A profile')
    }
  })

  test('User B list AI recommendations returns only User B records (empty)', async () => {
    const r = await req('/api/ai/recommendations', { token: tokenB })
    assert.equal(r.status, 200)
    const body = await r.json()
    assert.ok(Array.isArray(body.recommendations))
    assert.ok(
      !body.recommendations.some((rec) => rec.userId === userA.id),
      'User B must not see User A AI recommendations',
    )
  })

  test('User B cannot GET User A AI recommendation by ID', async () => {
    const r = await req(`/api/ai/recommendations/${created.recommendationId}`, { token: tokenB })
    assert.equal(r.status, 404)
  })
})

describe('User B cannot update User A records', () => {
  test('User B cannot update User A education', async () => {
    const r = await req(`/api/education/${created.educationId}`, {
      token: tokenB,
      method: 'PUT',
      body: { institution: 'Hacked University' },
    })
    assert.equal(r.status, 404)
    // Record must be unchanged
    assert.equal(stores.education.get(created.educationId).institution, 'University A')
  })

  test('User B cannot update User A experience', async () => {
    const r = await req(`/api/experience/${created.experienceId}`, {
      token: tokenB,
      method: 'PUT',
      body: { company: 'Hacked Corp', position: 'Hacker' },
    })
    assert.equal(r.status, 404)
    assert.equal(stores.experience.get(created.experienceId).company, 'Acme Corp')
  })

  test('User B cannot update User A skill', async () => {
    const r = await req(`/api/skills/${created.skillId}`, {
      token: tokenB,
      method: 'PUT',
      body: { name: 'HackedSkill' },
    })
    assert.equal(r.status, 404)
    assert.equal(stores.skill.get(created.skillId).name, 'TypeScript')
  })

  test('User B cannot update User A project', async () => {
    const r = await req(`/api/projects/${created.projectId}`, {
      token: tokenB,
      method: 'PUT',
      body: { title: 'Hacked Project' },
    })
    assert.equal(r.status, 404)
    assert.equal(stores.project.get(created.projectId).title, 'User A Project')
  })

  test('User B cannot update User A certificate', async () => {
    const r = await req(`/api/certificates/${created.certificateId}`, {
      token: tokenB,
      method: 'PUT',
      body: { name: 'Hacked Cert' },
    })
    assert.equal(r.status, 404)
    assert.equal(stores.certificate.get(created.certificateId).name, 'AWS Certified')
  })

  test('User B cannot update User A profile', async () => {
    const r = await req('/api/profile', {
      token: tokenB,
      method: 'PUT',
      body: { headline: 'Hacked by User B' },
    })
    // User B has no profile — upsert creates one for User B, not User A
    if (r.status === 200 || r.status === 201) {
      const body = await r.json()
      assert.notEqual(body.profile?.userId, userA.id, 'User B update must not affect User A profile')
    }
    // User A profile remains untouched
    assert.equal(stores.profile.get(userA.id)?.headline, 'Software Engineer')
  })
})

describe('User B cannot delete User A records', () => {
  // We use a separate record for deletion tests to avoid breaking later tests.
  let tempEducationId
  let tempProjectId

  test('setup: User A creates temporary records for deletion attack tests', async () => {
    const edu = await req('/api/education', {
      token: tokenA,
      method: 'POST',
      body: { institution: 'Temp University' },
    })
    tempEducationId = (await edu.json()).education.id

    const proj = await req('/api/projects', {
      token: tokenA,
      method: 'POST',
      body: { title: 'Temp Project' },
    })
    tempProjectId = (await proj.json()).project.id
  })

  test('User B cannot delete User A education', async () => {
    const r = await req(`/api/education/${tempEducationId}`, {
      token: tokenB,
      method: 'DELETE',
    })
    assert.equal(r.status, 404)
    assert.ok(stores.education.has(tempEducationId), 'Record must still exist after unauthorized delete attempt')
  })

  test('User B cannot delete User A project', async () => {
    const r = await req(`/api/projects/${tempProjectId}`, {
      token: tokenB,
      method: 'DELETE',
    })
    assert.equal(r.status, 404)
    assert.ok(stores.project.has(tempProjectId))
  })

  test('User B cannot delete User A certificate', async () => {
    const r = await req(`/api/certificates/${created.certificateId}`, {
      token: tokenB,
      method: 'DELETE',
    })
    assert.equal(r.status, 404)
    assert.ok(stores.certificate.has(created.certificateId))
  })
})

describe('User B cannot act on User A AI recommendations', () => {
  test('User B cannot accept User A recommendation', async () => {
    const r = await req(`/api/ai/recommendations/${created.recommendationId}/accept`, {
      token: tokenB,
      method: 'POST',
      body: {},
    })
    assert.equal(r.status, 404)
    // Recommendation must still be PENDING
    assert.equal(stores.aIGeneration.get(created.recommendationId).status, 'PENDING')
  })

  test('User B cannot reject User A recommendation', async () => {
    const r = await req(`/api/ai/recommendations/${created.recommendationId}/reject`, {
      token: tokenB,
      method: 'POST',
      body: {},
    })
    assert.equal(r.status, 404)
    assert.equal(stores.aIGeneration.get(created.recommendationId).status, 'PENDING')
  })

  test('User B cannot edit User A recommendation', async () => {
    const r = await req(`/api/ai/recommendations/${created.recommendationId}/edit`, {
      token: tokenB,
      method: 'POST',
      body: { editedText: 'Hacked edit by User B' },
    })
    assert.equal(r.status, 404)
    assert.equal(stores.aIGeneration.get(created.recommendationId).editedText, null)
  })
})

describe('User B cannot use User A resource IDs in AI operations', () => {
  test('User B cannot use User A experience ID for AI experience improvement', async () => {
    const r = await req('/api/ai/improve-experience', {
      token: tokenB,
      method: 'POST',
      body: { experienceId: created.experienceId, description: 'Trying to hijack User A experience' },
    })
    assert.equal(r.status, 404)
  })

  test('User B cannot use User A project ID for AI project improvement', async () => {
    const r = await req('/api/ai/improve-project', {
      token: tokenB,
      method: 'POST',
      body: { projectId: created.projectId, description: 'Trying to hijack User A project' },
    })
    assert.equal(r.status, 404)
  })

  test('User B AI suggest-skills returns only User B CV context (not User A data)', async () => {
    const r = await req('/api/ai/suggest-skills', {
      token: tokenB,
      method: 'POST',
      body: { skills: [] },
    })
    assert.ok([200, 201].includes(r.status))
    const body = await r.json()
    // existingSkills should reflect User B's data (empty), not User A's TypeScript skill
    const existing = body.existingSkills ?? []
    assert.ok(
      !existing.some((s) => s === 'TypeScript' || s?.name === 'TypeScript'),
      'User B suggest-skills must not expose User A skills',
    )
  })
})

describe('userId injection — User A cannot assign records to User B', () => {
  test('userId in education create body is rejected', async () => {
    const r = await req('/api/education', {
      token: tokenA,
      method: 'POST',
      body: { institution: 'Injection University', userId: userB.id },
    })
    // Validators reject unexpected fields — must be 400
    assert.equal(r.status, 400)
  })

  test('userId in skill create body is rejected', async () => {
    const r = await req('/api/skills', {
      token: tokenA,
      method: 'POST',
      body: { name: 'InjectedSkill', userId: userB.id },
    })
    assert.equal(r.status, 400)
  })

  test('userId in project create body is rejected', async () => {
    const r = await req('/api/projects', {
      token: tokenA,
      method: 'POST',
      body: { title: 'Injected Project', userId: userB.id },
    })
    assert.equal(r.status, 400)
  })

  test('userId in certificate create body is rejected', async () => {
    const r = await req('/api/certificates', {
      token: tokenA,
      method: 'POST',
      body: { name: 'Injected Cert', userId: userB.id },
    })
    assert.equal(r.status, 400)
  })

  test('userId in experience create body is rejected', async () => {
    const r = await req('/api/experience', {
      token: tokenA,
      method: 'POST',
      body: { company: 'Injected Corp', position: 'Dev', userId: userB.id },
    })
    assert.equal(r.status, 400)
  })

  test('userId in profile update body is rejected', async () => {
    const r = await req('/api/profile', {
      token: tokenA,
      method: 'PUT',
      body: { headline: 'Injected headline', userId: userB.id },
    })
    assert.equal(r.status, 400)
    const body = await r.json()
    assert.ok(body.details?.some((d) => /userId/i.test(d)))
  })
})

describe('public portfolio does not expose private fields', () => {
  test('setup: publish User A portfolio', async () => {
    const r = await req('/api/portfolio/publish', {
      token: tokenA,
      method: 'PATCH',
      body: { isPublished: true },
    })
    assert.equal(r.status, 200)
  })

  test('public portfolio response does not contain passwordHash or email', async () => {
    const r = await req(`/api/public/portfolio/${created.portfolioSlug}`)
    assert.equal(r.status, 200)
    const body = await r.json()
    const bodyText = JSON.stringify(body)
    assert.ok(!bodyText.includes('passwordHash'), 'passwordHash must not appear in public portfolio')
    assert.ok(!bodyText.includes('password_hash'), 'password_hash must not appear in public portfolio')
    // email is deliberately excluded from the public user object
    const publicUser = body.portfolio?.user
    assert.ok(publicUser, 'public portfolio must include user data')
    assert.equal('email' in publicUser, false, 'email must not appear in public portfolio user')
    assert.equal('passwordHash' in publicUser, false)
  })

  test('unpublished portfolio is not accessible publicly', async () => {
    // Unpublish first
    await req('/api/portfolio/publish', {
      token: tokenA,
      method: 'PATCH',
      body: { isPublished: false },
    })
    const r = await req(`/api/public/portfolio/${created.portfolioSlug}`)
    assert.equal(r.status, 404)
  })

  test('User B portfolio is isolated from User A portfolio endpoint', async () => {
    // User B creates their own portfolio
    const create = await req('/api/portfolio', {
      token: tokenB,
      method: 'POST',
      body: { title: 'User B Portfolio', slug: 'user-b-portfolio' },
    })
    assert.equal(create.status, 201)

    // User A GET /api/portfolio returns only User A's portfolio
    const r = await req('/api/portfolio', { token: tokenA })
    assert.equal(r.status, 200)
    const body = await r.json()
    assert.equal(body.portfolio.userId, userA.id, 'User A portfolio endpoint must return only User A portfolio')
    assert.notEqual(body.portfolio.userId, userB.id)
  })
})

describe('cross-user access does not leak record existence', () => {
  test('User B update on User A record returns 404 not 403', async () => {
    const r = await req(`/api/education/${created.educationId}`, {
      token: tokenB,
      method: 'PUT',
      body: { institution: 'Probe' },
    })
    assert.equal(r.status, 404, 'Must return 404 to avoid confirming record existence')
  })

  test('User B delete on User A record returns 404 not 403', async () => {
    const r = await req(`/api/education/${created.educationId}`, {
      token: tokenB,
      method: 'DELETE',
    })
    assert.equal(r.status, 404)
  })

  test('User B GET AI recommendation for User A returns 404 not 403', async () => {
    const r = await req(`/api/ai/recommendations/${created.recommendationId}`, { token: tokenB })
    assert.equal(r.status, 404)
  })
})
