import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'
import { prisma } from '../src/config/prisma.js'
import { signAccessToken } from '../src/utils/jwt.js'

process.env.JWT_SECRET = 'cv-data-test-secret'
process.env.JWT_EXPIRES_IN = '1h'

const userId = '00000000-0000-4000-8000-000000000010'
const otherUserId = '00000000-0000-4000-8000-000000000020'
const resourceNames = ['education', 'experience', 'skill', 'project', 'certificate']
const stores = Object.fromEntries(resourceNames.map((name) => [name, new Map()]))
const counters = Object.fromEntries(resourceNames.map((name) => [name, 0]))
const originalMethods = {}
let server
let baseUrl

function makeId(resourceName) {
  counters[resourceName] += 1
  return `00000000-0000-4000-8000-${String(counters[resourceName]).padStart(12, '0')}`
}

function installModelStub(resourceName) {
  const model = prisma[resourceName]
  originalMethods[resourceName] = {
    findMany: model.findMany,
    findFirst: model.findFirst,
    create: model.create,
    update: model.update,
    delete: model.delete,
  }

  model.findMany = async ({ where }) => [...stores[resourceName].values()]
    .filter((record) => record.userId === where.userId)
  model.findFirst = async ({ where }) => stores[resourceName].get(where.id)?.userId === where.userId
    ? stores[resourceName].get(where.id)
    : null
  model.create = async ({ data }) => {
    const record = {
      id: makeId(resourceName),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }
    stores[resourceName].set(record.id, record)
    return record
  }
  model.update = async ({ where, data }) => {
    const record = { ...stores[resourceName].get(where.id), ...data, updatedAt: new Date() }
    stores[resourceName].set(where.id, record)
    return record
  }
  model.delete = async ({ where }) => {
    const record = stores[resourceName].get(where.id)
    stores[resourceName].delete(where.id)
    return record
  }
}

before(async () => {
  for (const resourceName of resourceNames) installModelStub(resourceName)
  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  for (const resourceName of resourceNames) {
    const model = prisma[resourceName]
    Object.assign(model, originalMethods[resourceName])
  }
  server.close()
  await prisma.$disconnect()
})

async function request(path, token, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })
}

const token = signAccessToken(userId)
const otherToken = signAccessToken(otherUserId)

const cases = [
  {
    name: 'education',
    path: '/api/education',
    body: { institution: 'State University', startDate: '2020-09-01', endDate: null },
    update: { description: 'Updated description' },
  },
  {
    name: 'experience',
    path: '/api/experience',
    body: { company: 'Acme', position: 'Engineer', startDate: '2022-01-01', endDate: null },
    update: { description: 'Updated role' },
  },
  {
    name: 'skill',
    path: '/api/skills',
    body: { name: 'JavaScript', category: 'Languages', proficiency: 90 },
    update: { proficiency: 95 },
  },
  {
    name: 'project',
    path: '/api/projects',
    body: { title: 'Portfolio', description: 'A project', technologies: ['React'], githubUrl: 'https://github.com/example/project' },
    update: { liveUrl: 'https://example.com/project' },
  },
  {
    name: 'certificate',
    path: '/api/certificates',
    body: { name: 'Cloud Certificate', issuer: 'Example Institute', issueDate: '2024-05-01', credentialUrl: 'https://example.com/cert' },
    update: { issuer: 'Updated Institute' },
  },
]

for (const resource of cases) {
  test(`${resource.name} requires authentication`, async () => {
    const response = await request(resource.path)
    assert.equal(response.status, 401)
  })

  test(`${resource.name} supports owned CRUD operations`, async () => {
    const createdResponse = await request(resource.path, token, {
      method: 'POST',
      body: JSON.stringify(resource.body),
    })
    const createdBody = await createdResponse.json()
    const record = createdBody[resource.name]
    assert.equal(createdResponse.status, 201)
    assert.equal(record.userId, userId)

    const listResponse = await request(resource.path, token)
    const listBody = await listResponse.json()
    assert.equal(listResponse.status, 200)
    assert.equal(listBody[`${resource.name}s`].length, 1)

    const updateResponse = await request(`${resource.path}/${record.id}`, token, {
      method: 'PUT',
      body: JSON.stringify(resource.update),
    })
    const updateBody = await updateResponse.json()
    assert.equal(updateResponse.status, 200)
    assert.deepEqual(
      Object.entries(resource.update).map(([key]) => updateBody[resource.name][key]),
      Object.values(resource.update),
    )

    const deleteResponse = await request(`${resource.path}/${record.id}`, token, { method: 'DELETE' })
    assert.equal(deleteResponse.status, 204)
  })
}

test('ownership prevents another user from updating or deleting a record', async () => {
  const response = await request('/api/education', token, {
    method: 'POST',
    body: JSON.stringify({ institution: 'Private University' }),
  })
  const record = (await response.json()).education

  const updateResponse = await request(`/api/education/${record.id}`, otherToken, {
    method: 'PUT',
    body: JSON.stringify({ institution: 'Unauthorized' }),
  })
  const deleteResponse = await request(`/api/education/${record.id}`, otherToken, { method: 'DELETE' })

  assert.equal(updateResponse.status, 404)
  assert.equal(deleteResponse.status, 404)
  assert.equal(stores.education.get(record.id).institution, 'Private University')
})

test('education create does not require a client record id', async () => {
  const response = await request('/api/education', token, {
    method: 'POST',
    body: JSON.stringify({
      institution: 'No-ID University',
      degree: 'BSc',
      field: 'Computer Science',
      startDate: '2021-09-01',
      endDate: null,
      description: 'Created without an id supplied by the client.',
    }),
  })
  const body = await response.json()

  assert.equal(response.status, 201)
  assert.match(body.education.id, /^[0-9a-f-]{36}$/i)
  assert.equal(body.education.userId, userId)
})

test('education rejects invalid update and delete ids', async () => {
  const updateResponse = await request('/api/education/not-an-id', token, {
    method: 'PUT',
    body: JSON.stringify({ institution: 'Updated' }),
  })
  const deleteResponse = await request('/api/education/not-an-id', token, { method: 'DELETE' })

  assert.equal(updateResponse.status, 400)
  assert.equal(deleteResponse.status, 400)
})

test('education ownership blocks another user from modifying a record', async () => {
  const createResponse = await request('/api/education', token, {
    method: 'POST',
    body: JSON.stringify({ institution: 'Owned University' }),
  })
  const record = (await createResponse.json()).education

  const updateResponse = await request(`/api/education/${record.id}`, otherToken, {
    method: 'PUT',
    body: JSON.stringify({ institution: 'Unauthorized University' }),
  })
  const deleteResponse = await request(`/api/education/${record.id}`, otherToken, { method: 'DELETE' })

  assert.equal(updateResponse.status, 404)
  assert.equal(deleteResponse.status, 404)
  assert.equal(stores.education.get(record.id).institution, 'Owned University')
})

test('duplicate skill names are rejected for the same user', async () => {
  const first = await request('/api/skills', token, {
    method: 'POST',
    body: JSON.stringify({ name: 'TypeScript' }),
  })
  const duplicate = await request('/api/skills', token, {
    method: 'POST',
    body: JSON.stringify({ name: 'typescript' }),
  })

  assert.equal(first.status, 201)
  assert.equal(duplicate.status, 409)
})

test('invalid fields, IDs, dates, URLs, and unexpected userId are rejected', async () => {
  const invalidEducation = await request('/api/education', token, {
    method: 'POST',
    body: JSON.stringify({ institution: 'School', startDate: 'not-a-date' }),
  })
  const invalidProject = await request('/api/projects', token, {
    method: 'POST',
    body: JSON.stringify({ title: 'Project', githubUrl: 'not-a-url' }),
  })
  const unexpectedField = await request('/api/skills', token, {
    method: 'POST',
    body: JSON.stringify({ name: 'Go', userId: otherUserId }),
  })
  const invalidId = await request('/api/certificates/not-an-id', token, {
    method: 'PUT',
    body: JSON.stringify({ name: 'Updated' }),
  })

  assert.equal(invalidEducation.status, 400)
  assert.equal(invalidProject.status, 400)
  assert.equal(unexpectedField.status, 400)
  assert.equal(invalidId.status, 400)
})
