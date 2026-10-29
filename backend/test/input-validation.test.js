/**
 * Phase 11 — Step 3: Input Validation & API Security
 *
 * Covers:
 *  - Malformed route parameters (non-UUID IDs, oversized slugs)
 *  - Malformed request bodies (wrong types, empty required fields, oversized strings)
 *  - Unexpected / forbidden fields (userId, passwordHash, createdAt, updatedAt, id)
 *  - URL validation (dangerous schemes, non-HTTP URLs)
 *  - Mass assignment attempts across all CV resources
 *  - AI endpoint input validation (UUID IDs, length limits, bad payloads)
 *  - File upload security (MIME type, magic bytes, size, unauthenticated upload)
 *  - API security (unauthenticated access, malformed auth headers, CORS preflight)
 *  - Injection strings (SQL fragments, script tags, oversized payloads)
 *  - Database non-mutation: invalid update must not change stored record
 *  - Error responses must not leak stack traces, Prisma details, or secrets
 */

import assert from 'node:assert/strict'
import { after, before, describe, test } from 'node:test'
import { createApp } from '../src/express-app.js'
import { prisma } from '../src/config/prisma.js'
import { signAccessToken } from '../src/utils/jwt.js'

process.env.JWT_SECRET = 'input-validation-test-secret'
process.env.JWT_EXPIRES_IN = '1h'
process.env.GROQ_API_KEY = 'test-key'
process.env.GROQ_MOCK_MODE = 'true'

// ---------------------------------------------------------------------------
// Test identity
// ---------------------------------------------------------------------------

const userId = '00000000-dd00-4000-8000-000000000001'
const token = signAccessToken(userId)

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

const profileStore = new Map()
const resourceStores = {
  education: new Map(),
  experience: new Map(),
  skill: new Map(),
  project: new Map(),
  certificate: new Map(),
}
const portfolioStore = new Map()
const portfolioBySlug = new Map()
const aiGenerations = new Map()

let idSeq = 0
function newId() {
  idSeq += 1
  return `00000000-dd00-4000-8000-${String(idSeq).padStart(12, '0')}`
}

// ---------------------------------------------------------------------------
// Saved originals
// ---------------------------------------------------------------------------

const originals = {}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

let server
let baseUrl

before(async () => {
  // Save originals
  const models = ['profile', 'education', 'experience', 'skill', 'project', 'certificate', 'portfolio', 'aIGeneration']
  const fns = ['findUnique', 'findFirst', 'findMany', 'create', 'update', 'delete', 'upsert']
  for (const m of models) {
    originals[m] = {}
    for (const fn of fns) {
      if (typeof prisma[m]?.[fn] === 'function') originals[m][fn] = prisma[m][fn]
    }
  }

  // Profile
  prisma.profile.findUnique = async ({ where }) => profileStore.get(where.userId ?? where.id) ?? null
  prisma.profile.upsert = async ({ where, create, update }) => {
    const existing = profileStore.get(where.userId)
    const record = existing
      ? { ...existing, ...update, updatedAt: new Date() }
      : { id: newId(), createdAt: new Date(), updatedAt: new Date(), ...create }
    profileStore.set(where.userId, record)
    return record
  }
  prisma.profile.update = async ({ where, data }) => {
    const record = profileStore.get(where.userId)
    if (!record) throw Object.assign(new Error('not found'), { code: 'P2025' })
    const next = { ...record, ...data, updatedAt: new Date() }
    profileStore.set(where.userId, next)
    return next
  }

  // Generic CV resource stub
  const stubResource = (name) => {
    const store = resourceStores[name]
    prisma[name].findMany = async ({ where }) =>
      [...store.values()].filter((r) => !where.userId || r.userId === where.userId)
    prisma[name].findFirst = async ({ where }) => {
      const r = store.get(where.id)
      return (r && (!where.userId || r.userId === where.userId)) ? r : null
    }
    prisma[name].findUnique = async ({ where }) => store.get(where.id) ?? null
    prisma[name].create = async ({ data }) => {
      const r = { id: newId(), createdAt: new Date(), updatedAt: new Date(), ...data }
      store.set(r.id, r)
      return r
    }
    prisma[name].update = async ({ where, data }) => {
      const r = store.get(where.id)
      if (!r) throw Object.assign(new Error('not found'), { code: 'P2025' })
      const next = { ...r, ...data, updatedAt: new Date() }
      store.set(where.id, next)
      return next
    }
    prisma[name].delete = async ({ where }) => {
      const r = store.get(where.id)
      if (!r) throw Object.assign(new Error('not found'), { code: 'P2025' })
      store.delete(where.id)
      return r
    }
  }
  for (const name of ['education', 'experience', 'skill', 'project', 'certificate']) stubResource(name)

  // Portfolio
  prisma.portfolio.findFirst = async ({ where }) =>
    [...portfolioStore.values()].find((p) => p.userId === where.userId) ?? null
  prisma.portfolio.findUnique = async ({ where }) =>
    (where.id ? portfolioStore.get(where.id) : portfolioBySlug.get(where.slug)) ?? null
  prisma.portfolio.create = async ({ data }) => {
    const r = { id: newId(), isPublished: false, template: 'professional', createdAt: new Date(), updatedAt: new Date(), ...data }
    portfolioStore.set(r.id, r)
    portfolioBySlug.set(r.slug, r)
    return r
  }
  prisma.portfolio.update = async ({ where, data }) => {
    const r = portfolioStore.get(where.id) ?? portfolioBySlug.get(where.slug)
    if (!r) throw Object.assign(new Error('not found'), { code: 'P2025' })
    if (data.slug && data.slug !== r.slug) portfolioBySlug.delete(r.slug)
    const next = { ...r, ...data, updatedAt: new Date() }
    portfolioStore.set(next.id, next)
    portfolioBySlug.set(next.slug, next)
    return next
  }

  // AI Generations
  prisma.aIGeneration.create = async ({ data }) => {
    const r = { id: newId(), status: 'PENDING', targetType: null, targetId: null, editedText: null, createdAt: new Date(), updatedAt: new Date(), ...data }
    aiGenerations.set(r.id, r)
    return r
  }
  prisma.aIGeneration.findMany = async ({ where }) =>
    [...aiGenerations.values()].filter((r) => r.userId === where.userId)
  prisma.aIGeneration.findUnique = async ({ where }) => aiGenerations.get(where.id) ?? null
  prisma.aIGeneration.update = async ({ where, data }) => {
    const r = aiGenerations.get(where.id)
    if (!r) throw Object.assign(new Error('not found'), { code: 'P2025' })
    const next = { ...r, ...data, updatedAt: new Date() }
    aiGenerations.set(where.id, next)
    return next
  }

  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  const models = ['profile', 'education', 'experience', 'skill', 'project', 'certificate', 'portfolio', 'aIGeneration']
  for (const m of models) for (const fn of Object.keys(originals[m] ?? {})) prisma[m][fn] = originals[m][fn]
  server.close()
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function req(path, { method = 'GET', body, tok = token, rawAuth, contentType = 'application/json' } = {}) {
  const headers = { 'content-type': contentType }
  if (rawAuth !== undefined) {
    headers.authorization = rawAuth
  } else if (tok) {
    headers.authorization = `Bearer ${tok}`
  }
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

function assertNoLeaks(bodyText) {
  // Must not expose stack traces (look for typical Node.js stack frame pattern)
  assert.ok(!/at \w.*:\d+:\d+/.test(bodyText), 'must not expose stack trace frames')
  // Must not expose Prisma internal error structures
  assert.ok(!bodyText.includes('PrismaClientKnownRequestError'), 'must not expose Prisma error class')
  assert.ok(!bodyText.includes('PrismaClientValidationError'), 'must not expose Prisma validation error')
  // Must not expose JWT secret value
  assert.ok(!bodyText.includes(process.env.JWT_SECRET), 'must not expose JWT_SECRET value')
  // Must not expose raw password hash values (not the word "passwordHash" in a validation message)
  assert.ok(!/\$2[aby]\$\d+\$/.test(bodyText), 'must not expose bcrypt hash')
}

// ---------------------------------------------------------------------------
// API security — authentication
// ---------------------------------------------------------------------------

describe('unauthenticated access is rejected', () => {
  const protectedPaths = [
    ['GET', '/api/profile'],
    ['PUT', '/api/profile'],
    ['GET', '/api/education'],
    ['POST', '/api/education'],
    ['GET', '/api/experience'],
    ['POST', '/api/experience'],
    ['GET', '/api/skills'],
    ['POST', '/api/skills'],
    ['GET', '/api/projects'],
    ['POST', '/api/projects'],
    ['GET', '/api/certificates'],
    ['POST', '/api/certificates'],
    ['GET', '/api/portfolio'],
    ['POST', '/api/portfolio'],
    ['GET', '/api/ai/recommendations'],
    ['POST', '/api/ai/improve-summary'],
    ['GET', '/api/cv/pdf'],
  ]

  for (const [method, path] of protectedPaths) {
    test(`${method} ${path} without token returns 401`, async () => {
      const r = await req(path, { method, tok: null })
      assert.equal(r.status, 401)
      const body = await r.text()
      assertNoLeaks(body)
    })
  }

  test('malformed authorization header (no Bearer scheme) returns 401', async () => {
    const r = await req('/api/profile', { rawAuth: 'Basic dXNlcjpwYXNz' })
    assert.equal(r.status, 401)
  })

  test('empty authorization header returns 401', async () => {
    const r = await req('/api/profile', { rawAuth: '' })
    assert.equal(r.status, 401)
  })

  test('Bearer with empty token returns 401', async () => {
    const r = await req('/api/profile', { rawAuth: 'Bearer ' })
    assert.equal(r.status, 401)
  })

  test('Bearer with random string returns 401', async () => {
    const r = await req('/api/profile', { rawAuth: 'Bearer this.is.garbage' })
    assert.equal(r.status, 401)
  })
})

// ---------------------------------------------------------------------------
// Route parameter validation — non-UUID IDs
// ---------------------------------------------------------------------------

describe('non-UUID route parameters are rejected', () => {
  const idRoutes = [
    ['PUT', '/api/education/not-a-uuid', { institution: 'X' }],
    ['DELETE', '/api/education/not-a-uuid', undefined],
    ['PUT', '/api/experience/not-a-uuid', { company: 'X', position: 'X' }],
    ['DELETE', '/api/experience/not-a-uuid', undefined],
    ['PUT', '/api/skills/not-a-uuid', { name: 'X' }],
    ['DELETE', '/api/skills/not-a-uuid', undefined],
    ['PUT', '/api/projects/not-a-uuid', { title: 'X' }],
    ['DELETE', '/api/projects/not-a-uuid', undefined],
    ['PUT', '/api/certificates/not-a-uuid', { name: 'X' }],
    ['DELETE', '/api/certificates/not-a-uuid', undefined],
  ]

  for (const [method, path, body] of idRoutes) {
    test(`${method} ${path} returns 400`, async () => {
      const r = await req(path, { method, body })
      assert.equal(r.status, 400)
      assertNoLeaks(await r.text())
    })
  }

  test('GET /api/ai/recommendations/not-a-uuid returns 400', async () => {
    const r = await req('/api/ai/recommendations/not-a-uuid')
    assert.equal(r.status, 400)
    assertNoLeaks(await r.text())
  })

  test('POST /api/ai/recommendations/not-a-uuid/accept returns 400', async () => {
    const r = await req('/api/ai/recommendations/not-a-uuid/accept', { method: 'POST', body: {} })
    assert.equal(r.status, 400)
  })

  test('POST /api/ai/recommendations/not-a-uuid/reject returns 400', async () => {
    const r = await req('/api/ai/recommendations/not-a-uuid/reject', { method: 'POST', body: {} })
    assert.equal(r.status, 400)
  })

  test('POST /api/ai/recommendations/not-a-uuid/edit returns 400', async () => {
    const r = await req('/api/ai/recommendations/not-a-uuid/edit', { method: 'POST', body: { editedText: 'x' } })
    assert.equal(r.status, 400)
  })

  test('injection string as route ID returns 400 without leaking errors', async () => {
    const r = await req("/api/education/'; DROP TABLE users; --", { method: 'PUT', body: { institution: 'X' } })
    assert.equal(r.status, 400)
    assertNoLeaks(await r.text())
  })
})

describe('oversized portfolio slug returns 404 not a Prisma error', () => {
  test('slug longer than 160 chars returns 404', async () => {
    const longSlug = 'a'.repeat(200)
    const r = await req(`/api/public/portfolio/${longSlug}`, { tok: null })
    assert.equal(r.status, 404)
    assertNoLeaks(await r.text())
  })
})

// ---------------------------------------------------------------------------
// Request body validation — unexpected fields (mass assignment)
// ---------------------------------------------------------------------------

describe('mass assignment fields are rejected', () => {
  const massPayloads = [
    {
      path: '/api/education',
      body: { institution: 'Hack U', userId: 'evil-id', createdAt: '2020-01-01', updatedAt: '2020-01-01', id: 'custom-id' },
    },
    {
      path: '/api/experience',
      body: { company: 'Evil Corp', position: 'Hacker', userId: 'evil-id', passwordHash: 'fake', id: 'x' },
    },
    {
      path: '/api/skills',
      body: { name: 'SQL', userId: 'attacker', createdAt: '2020-01-01' },
    },
    {
      path: '/api/projects',
      body: { title: 'Hack', userId: 'attacker', updatedAt: '2020-01-01' },
    },
    {
      path: '/api/certificates',
      body: { name: 'Cert', userId: 'attacker', id: 'injected' },
    },
    {
      path: '/api/portfolio',
      method: 'PUT',
      body: { title: 'P', userId: 'attacker', id: 'x', createdAt: '2020-01-01' },
    },
  ]

  for (const { path, method = 'POST', body } of massPayloads) {
    test(`${method} ${path} with forbidden fields returns 400`, async () => {
      const r = await req(path, { method, body })
      assert.equal(r.status, 400)
      const text = await r.text()
      assertNoLeaks(text)
    })
  }

  test('profile PUT with userId field returns 400', async () => {
    const r = await req('/api/profile', {
      method: 'PUT',
      body: { headline: 'Hacked', userId: 'evil', passwordHash: 'x' },
    })
    assert.equal(r.status, 400)
    const body = await r.json()
    assert.ok(body.details?.some((d) => /userId/i.test(d)))
  })

  test('profile PUT with passwordHash field returns 400', async () => {
    const r = await req('/api/profile', {
      method: 'PUT',
      body: { headline: 'Fine', passwordHash: 'hacked' },
    })
    assert.equal(r.status, 400)
  })

  test('mass assignment does not mutate any stored record', async () => {
    // Create a clean education record
    const create = await req('/api/education', {
      method: 'POST',
      body: { institution: 'Original University' },
    })
    assert.equal(create.status, 201)
    const { education: orig } = await create.json()

    // Attempt mass assignment update
    const attack = await req(`/api/education/${orig.id}`, {
      method: 'PUT',
      body: { institution: 'Hacked', userId: 'evil', passwordHash: 'fake', createdAt: '2000-01-01' },
    })
    assert.equal(attack.status, 400)

    // Record must be unchanged
    const stored = resourceStores.education.get(orig.id)
    assert.equal(stored.institution, 'Original University')
    assert.equal(stored.userId, userId)
  })
})

// ---------------------------------------------------------------------------
// String length limits
// ---------------------------------------------------------------------------

describe('oversized string fields are rejected', () => {
  const OVER = 'x'.repeat(10001)
  const OVER_BIO = 'x'.repeat(5001)
  const OVER_URL = 'https://example.com/' + 'x'.repeat(2048)

  test('education institution over 200 chars is rejected', async () => {
    const r = await req('/api/education', {
      method: 'POST',
      body: { institution: 'x'.repeat(201) },
    })
    assert.equal(r.status, 400)
  })

  test('education description over 5000 chars is rejected', async () => {
    const r = await req('/api/education', {
      method: 'POST',
      body: { institution: 'Uni', description: OVER_BIO + 'x' },
    })
    assert.equal(r.status, 400)
  })

  test('experience description over 5000 chars is rejected', async () => {
    const r = await req('/api/experience', {
      method: 'POST',
      body: { company: 'Co', position: 'Dev', description: OVER_BIO + 'x' },
    })
    assert.equal(r.status, 400)
  })

  test('project description over 10000 chars is rejected', async () => {
    const r = await req('/api/projects', {
      method: 'POST',
      body: { title: 'P', description: OVER },
    })
    assert.equal(r.status, 400)
  })

  test('skill name over 120 chars is rejected', async () => {
    const r = await req('/api/skills', {
      method: 'POST',
      body: { name: 'x'.repeat(121) },
    })
    assert.equal(r.status, 400)
  })

  test('certificate name over 200 chars is rejected', async () => {
    const r = await req('/api/certificates', {
      method: 'POST',
      body: { name: 'x'.repeat(201) },
    })
    assert.equal(r.status, 400)
  })

  test('profile headline over 200 chars is rejected', async () => {
    const r = await req('/api/profile', {
      method: 'PUT',
      body: { headline: 'x'.repeat(201) },
    })
    assert.equal(r.status, 400)
  })

  test('profile bio over 5000 chars is rejected', async () => {
    const r = await req('/api/profile', {
      method: 'PUT',
      body: { bio: OVER_BIO + 'x' },
    })
    assert.equal(r.status, 400)
  })

  test('oversized project URL is rejected', async () => {
    const r = await req('/api/projects', {
      method: 'POST',
      body: { title: 'P', githubUrl: OVER_URL },
    })
    assert.equal(r.status, 400)
  })

  test('AI improve-summary text over 20000 chars is rejected', async () => {
    const r = await req('/api/ai/improve-summary', {
      method: 'POST',
      body: { text: 'x'.repeat(20001) },
    })
    assert.equal(r.status, 400)
  })

  test('AI job analysis jobTitle over 200 chars is rejected', async () => {
    const r = await req('/api/ai/analyze-job-description', {
      method: 'POST',
      body: { jobTitle: 'x'.repeat(201), description: 'Valid job description.', skills: [] },
    })
    assert.equal(r.status, 400)
  })

  test('AI job analysis description over 20000 chars is rejected', async () => {
    const r = await req('/api/ai/analyze-job-description', {
      method: 'POST',
      body: { jobTitle: 'Engineer', description: 'x'.repeat(20001), skills: [] },
    })
    assert.equal(r.status, 400)
  })
})

// ---------------------------------------------------------------------------
// URL validation — dangerous schemes and malformed URLs
// ---------------------------------------------------------------------------

describe('URL fields reject dangerous schemes and malformed values', () => {
  const dangerousUrls = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'not-a-url',
    'ftp://example.com',
    'http://',
    '',
  ]

  for (const url of dangerousUrls) {
    test(`profile linkedinUrl "${url.slice(0, 40)}" is rejected`, async () => {
      const r = await req('/api/profile', {
        method: 'PUT',
        body: { linkedinUrl: url },
      })
      // Empty string is treated as null (no error), all others must be rejected
      if (url === '') {
        assert.ok([200, 201].includes(r.status))
      } else {
        assert.equal(r.status, 400, `Expected 400 for url: ${url}`)
        assertNoLeaks(await r.text())
      }
    })
  }

  test('project githubUrl with javascript: scheme is rejected', async () => {
    const r = await req('/api/projects', {
      method: 'POST',
      body: { title: 'P', githubUrl: 'javascript:alert(document.cookie)' },
    })
    assert.equal(r.status, 400)
  })

  test('certificate credentialUrl with data: scheme is rejected', async () => {
    const r = await req('/api/certificates', {
      method: 'POST',
      body: { name: 'Cert', credentialUrl: 'data:text/html,<script>xss</script>' },
    })
    assert.equal(r.status, 400)
  })

  test('valid https URLs are accepted', async () => {
    const r = await req('/api/projects', {
      method: 'POST',
      body: {
        title: 'Valid Project',
        githubUrl: 'https://github.com/example/repo',
        liveUrl: 'https://example.com',
      },
    })
    assert.equal(r.status, 201)
  })
})

// ---------------------------------------------------------------------------
// Required field validation
// ---------------------------------------------------------------------------

describe('missing required fields are rejected', () => {
  test('education without institution returns 400', async () => {
    const r = await req('/api/education', { method: 'POST', body: { degree: 'BSc' } })
    assert.equal(r.status, 400)
  })

  test('experience without company and position returns 400', async () => {
    const r = await req('/api/experience', { method: 'POST', body: { description: 'Work' } })
    assert.equal(r.status, 400)
  })

  test('skill without name returns 400', async () => {
    const r = await req('/api/skills', { method: 'POST', body: { category: 'Lang' } })
    assert.equal(r.status, 400)
  })

  test('project without title returns 400', async () => {
    const r = await req('/api/projects', { method: 'POST', body: { description: 'A project' } })
    assert.equal(r.status, 400)
  })

  test('certificate without name returns 400', async () => {
    const r = await req('/api/certificates', { method: 'POST', body: { issuer: 'AWS' } })
    assert.equal(r.status, 400)
  })

  test('portfolio create without title returns 400', async () => {
    const r = await req('/api/portfolio', { method: 'POST', body: { slug: 'my-portfolio' } })
    assert.equal(r.status, 400)
  })

  test('empty string for required fields returns 400', async () => {
    const r = await req('/api/education', { method: 'POST', body: { institution: '   ' } })
    assert.equal(r.status, 400)
  })

  test('null body returns 400 (not 500)', async () => {
    const r = await fetch(`${baseUrl}/api/education`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: 'null',
    })
    assert.equal(r.status, 400)
    assertNoLeaks(await r.text())
  })

  test('array body returns 400 (not 500)', async () => {
    const r = await fetch(`${baseUrl}/api/education`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: '[{"institution":"X"}]',
    })
    assert.equal(r.status, 400)
    assertNoLeaks(await r.text())
  })
})

// ---------------------------------------------------------------------------
// Invalid type values
// ---------------------------------------------------------------------------

describe('invalid field types are rejected', () => {
  test('education startDate as integer returns 400', async () => {
    const r = await req('/api/education', {
      method: 'POST',
      body: { institution: 'Uni', startDate: 20200101 },
    })
    assert.equal(r.status, 400)
  })

  test('education startDate as invalid string returns 400', async () => {
    const r = await req('/api/education', {
      method: 'POST',
      body: { institution: 'Uni', startDate: 'not-a-date' },
    })
    assert.equal(r.status, 400)
  })

  test('skill proficiency as string returns 400', async () => {
    const r = await req('/api/skills', {
      method: 'POST',
      body: { name: 'JS', proficiency: 'expert' },
    })
    assert.equal(r.status, 400)
  })

  test('skill proficiency below 0 returns 400', async () => {
    const r = await req('/api/skills', {
      method: 'POST',
      body: { name: 'JS', proficiency: -1 },
    })
    assert.equal(r.status, 400)
  })

  test('skill proficiency above 100 returns 400', async () => {
    const r = await req('/api/skills', {
      method: 'POST',
      body: { name: 'JS', proficiency: 101 },
    })
    assert.equal(r.status, 400)
  })

  test('portfolio template with invalid value returns 400', async () => {
    const r = await req('/api/portfolio', {
      method: 'POST',
      body: { title: 'P', slug: 'my-port', template: 'hacker-template' },
    })
    assert.equal(r.status, 400)
  })

  test('portfolio isPublished as string returns 400', async () => {
    const r = await req('/api/portfolio', {
      method: 'POST',
      body: { title: 'P', slug: 'my-port-2', isPublished: 'yes' },
    })
    assert.equal(r.status, 400)
  })

  test('project technologies as string returns 400', async () => {
    const r = await req('/api/projects', {
      method: 'POST',
      body: { title: 'P', technologies: 'React,Node' },
    })
    assert.equal(r.status, 400)
  })

  test('experience endDate before startDate returns 400', async () => {
    const r = await req('/api/experience', {
      method: 'POST',
      body: { company: 'Co', position: 'Dev', startDate: '2023-01-01', endDate: '2022-01-01' },
    })
    assert.equal(r.status, 400)
  })
})

// ---------------------------------------------------------------------------
// AI endpoint input validation
// ---------------------------------------------------------------------------

describe('AI endpoint input validation', () => {
  test('non-UUID experienceId returns 400', async () => {
    const r = await req('/api/ai/improve-experience', {
      method: 'POST',
      body: { experienceId: 'not-a-uuid', description: 'Valid description text.' },
    })
    assert.equal(r.status, 400)
    const body = await r.json()
    assert.ok(body.details?.some((d) => /experienceId/i.test(d)))
  })

  test('non-UUID projectId returns 400', async () => {
    const r = await req('/api/ai/improve-project', {
      method: 'POST',
      body: { projectId: 'not-a-uuid', description: 'Valid description text.' },
    })
    assert.equal(r.status, 400)
    const body = await r.json()
    assert.ok(body.details?.some((d) => /projectId/i.test(d)))
  })

  test('improve-summary missing text field returns 400', async () => {
    const r = await req('/api/ai/improve-summary', { method: 'POST', body: {} })
    assert.equal(r.status, 400)
  })

  test('improve-experience missing description returns 400', async () => {
    const r = await req('/api/ai/improve-experience', {
      method: 'POST',
      body: { experienceId: '00000000-dd00-4000-8000-000000000001' },
    })
    assert.equal(r.status, 400)
  })

  test('improve-project missing projectId returns 400', async () => {
    const r = await req('/api/ai/improve-project', {
      method: 'POST',
      body: { description: 'Some text' },
    })
    assert.equal(r.status, 400)
  })

  test('job analysis missing jobTitle returns 400', async () => {
    const r = await req('/api/ai/analyze-job-description', {
      method: 'POST',
      body: { description: 'Some job desc.', skills: [] },
    })
    assert.equal(r.status, 400)
  })

  test('job analysis missing skills array returns 400', async () => {
    const r = await req('/api/ai/analyze-job-description', {
      method: 'POST',
      body: { jobTitle: 'Engineer', description: 'Some job desc.' },
    })
    assert.equal(r.status, 400)
  })

  test('AI non-UUID recommendation params returns 400 and does not crash', async () => {
    const paths = [
      '/api/ai/recommendations/INVALID-ID',
      "/api/ai/recommendations/'; SELECT * FROM users; --",
    ]
    for (const p of paths) {
      const r = await req(p)
      assert.equal(r.status, 400, `Expected 400 for ${p}`)
      assertNoLeaks(await r.text())
    }

    // Path traversal is neutralized by the router — results in 404 (no matching route), not a crash
    const traversal = await req('/api/ai/recommendations/../../../../etc/passwd')
    assert.ok([400, 404].includes(traversal.status), 'Path traversal must not produce 500')
    assertNoLeaks(await traversal.text())
  })
})

// ---------------------------------------------------------------------------
// File upload security
// ---------------------------------------------------------------------------

describe('profile image upload security', () => {
  test('unauthenticated upload is rejected with 401', async () => {
    const formData = new FormData()
    formData.append('image', new Blob(['fake'], { type: 'image/jpeg' }), 'test.jpg')
    const r = await fetch(`${baseUrl}/api/profile/image`, { method: 'POST', body: formData })
    assert.equal(r.status, 401)
  })

  test('upload with wrong MIME type (text/plain) is rejected', async () => {
    const formData = new FormData()
    formData.append('image', new Blob(['fake content'], { type: 'text/plain' }), 'file.txt')
    const r = await fetch(`${baseUrl}/api/profile/image`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: formData,
    })
    assert.equal(r.status, 400)
  })

  test('upload with image MIME type but invalid magic bytes is rejected', async () => {
    // Claim JPEG MIME type but content is plain text (no FF D8 FF header)
    const formData = new FormData()
    formData.append('image', new Blob(['This is not a JPEG file at all'], { type: 'image/jpeg' }), 'fake.jpg')
    const r = await fetch(`${baseUrl}/api/profile/image`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: formData,
    })
    assert.equal(r.status, 400)
    assertNoLeaks(await r.text())
  })

  test('upload of an HTML file with image MIME type is rejected', async () => {
    const htmlContent = '<html><script>alert(1)</script></html>'
    const formData = new FormData()
    formData.append('image', new Blob([htmlContent], { type: 'image/png' }), 'evil.png')
    const r = await fetch(`${baseUrl}/api/profile/image`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: formData,
    })
    assert.equal(r.status, 400)
  })

  test('upload of oversized file is rejected with 400', async () => {
    // 5MB + 1 byte: just over the limit
    const oversized = new Uint8Array(5 * 1024 * 1024 + 1).fill(0)
    // Give it a valid JPEG magic header so it does not fail on bytes check first
    oversized[0] = 0xff; oversized[1] = 0xd8; oversized[2] = 0xff
    const formData = new FormData()
    formData.append('image', new Blob([oversized], { type: 'image/jpeg' }), 'big.jpg')
    const r = await fetch(`${baseUrl}/api/profile/image`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: formData,
    })
    assert.equal(r.status, 400)
  })
})

// ---------------------------------------------------------------------------
// Injection strings — must not crash server or leak internals
// ---------------------------------------------------------------------------

describe('injection strings are safely handled', () => {
  const injectionStrings = [
    "'; DROP TABLE users; --",
    '<script>alert(document.cookie)</script>',
    '{"$gt": ""}',
    '\x00\x01\x02\x03',
    'A'.repeat(5000),
    '{"__proto__": {"admin": true}}',
  ]

  for (const payload of injectionStrings) {
    test(`institution field handles injection string "${payload.slice(0, 30)}"`, async () => {
      const r = await req('/api/education', {
        method: 'POST',
        body: { institution: payload },
      })

      // Either accepted (stored safely) or rejected (too long / invalid). Must never crash.
      assert.ok([200, 201, 400, 422].includes(r.status), `Unexpected status ${r.status}`)
      const text = await r.text()
      assertNoLeaks(text)
    })
  }

  test('SQL injection in project title does not produce 500 or leak errors', async () => {
    const r = await req('/api/projects', {
      method: 'POST',
      body: { title: "'; DROP TABLE projects; --" },
    })
    // Title is a valid string — stored safely or accepted
    assert.ok([200, 201, 400].includes(r.status))
    assertNoLeaks(await r.text())
  })

  test('XSS string in profile bio is stored safely, not executed', async () => {
    const r = await req('/api/profile', {
      method: 'PUT',
      body: { bio: '<script>alert(1)</script>' },
    })
    // Bio has a 5000 char limit, this is short enough to accept
    assert.ok([200, 201].includes(r.status))
    const body = await r.json()
    // Stored as plain text — never interpreted as HTML
    assert.equal(body.profile.bio, '<script>alert(1)</script>')
  })
})

// ---------------------------------------------------------------------------
// Error responses must not leak internals
// ---------------------------------------------------------------------------

describe('error responses do not leak internal details', () => {
  test('invalid UUID route param returns clean 400 with no stack trace', async () => {
    const r = await req('/api/education/DEFINITELY-NOT-UUID', { method: 'DELETE' })
    assert.equal(r.status, 400)
    assertNoLeaks(await r.text())
  })

  test('validation failure response does not contain Prisma or stack info', async () => {
    const r = await req('/api/projects', {
      method: 'POST',
      body: { title: 'P', githubUrl: 'javascript:xss()' },
    })
    assert.equal(r.status, 400)
    const text = await r.text()
    assertNoLeaks(text)
    assert.ok(!text.includes('javascript:'), 'Should not reflect the dangerous URL back verbatim in a way that enables attack')
  })

  test('nonexistent record update returns 404 with no internal detail', async () => {
    const r = await req('/api/education/00000000-0000-0000-0000-000000000099', { method: 'DELETE' })
    assert.equal(r.status, 404)
    assertNoLeaks(await r.text())
  })

  test('response for rejected mass assignment contains no secret values', async () => {
    const r = await req('/api/skills', {
      method: 'POST',
      body: { name: 'Go', userId: 'attacker-id-value', passwordHash: 'my-secret-hash-value' },
    })
    assert.equal(r.status, 400)
    const text = await r.text()
    // The submitted VALUES must not be reflected back (field names in error messages are fine)
    assert.ok(!text.includes('my-secret-hash-value'), 'Submitted passwordHash value must not be reflected')
    assert.ok(!text.includes('attacker-id-value'), 'Submitted userId value must not be reflected')
    assertNoLeaks(text)
  })
})

// ---------------------------------------------------------------------------
// CORS preflight
// ---------------------------------------------------------------------------

describe('CORS preflight', () => {
  test('preflight from allowed local origin is accepted', async () => {
    const r = await fetch(`${baseUrl}/api/education`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type,authorization',
      },
    })
    assert.equal(r.status, 204)
    assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5173')
    assert.equal(r.headers.get('access-control-allow-credentials'), 'true')
  })

  test('preflight from disallowed origin is rejected', async () => {
    const r = await fetch(`${baseUrl}/api/education`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://evil-attacker.com',
        'access-control-request-method': 'POST',
      },
    })
    assert.ok(r.status !== 204 || r.headers.get('access-control-allow-origin') !== 'https://evil-attacker.com',
      'Disallowed origin must not be granted CORS access')
  })
})
