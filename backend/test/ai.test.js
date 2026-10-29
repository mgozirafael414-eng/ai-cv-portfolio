import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApp } from '../src/express-app.js'
import { prisma } from '../src/config/prisma.js'
import { getLastMockUserPrompt } from '../src/config/groq.js'
import { signAccessToken } from '../src/utils/jwt.js'

process.env.JWT_SECRET = 'ai-test-secret'
process.env.JWT_EXPIRES_IN = '1h'
process.env.GROQ_API_KEY = 'test-key'
process.env.GROQ_MOCK_MODE = 'true'

const userId = '00000000-0000-0000-0000-000000000200'
const otherUserId = '00000000-0000-0000-0000-000000000201'

const profileRecord = {
  id: '00000000-0000-0000-0000-000000000210',
  userId,
  headline: 'Computer science student with programming skills.',
  bio: 'Computer science student with programming skills.',
  location: 'Nairobi, Kenya',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const experienceRecords = [
  {
    id: '00000000-0000-0000-0000-000000000211',
    userId,
    company: 'Open Source',
    position: 'Frontend Developer',
    startDate: '2023-01-01',
    endDate: null,
    description: 'Built a website using React and CSS.',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const projectRecords = [
  {
    id: '00000000-0000-0000-0000-000000000212',
    userId,
    title: 'Portfolio App',
    description: 'Built a portfolio app for managing content.',
    technologies: ['React', 'Node.js'],
    githubUrl: 'https://github.com/example/portfolio',
    liveUrl: null,
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const skillRecords = [
  { id: '00000000-0000-0000-0000-000000000213', userId, name: 'React', category: 'Frontend', proficiency: 85 },
  { id: '00000000-0000-0000-0000-000000000214', userId, name: 'Node.js', category: 'Backend', proficiency: 80 },
]
const educationRecords = [
  { id: '00000000-0000-0000-0000-000000000215', userId, institution: 'University', degree: 'BSc', field: 'Computer Science' },
]

const storedGenerations = []

const originalMethods = {
  profileFindUnique: prisma.profile.findUnique,
  profileUpdate: prisma.profile.update,
  experienceFindMany: prisma.experience.findMany,
  projectFindMany: prisma.project.findMany,
  projectFindUnique: prisma.project.findUnique,
  projectUpdate: prisma.project.update,
  skillFindMany: prisma.skill.findMany,
  educationFindMany: prisma.education.findMany,
  aIGenerationCreate: prisma.aIGeneration.create,
  aIGenerationFindMany: prisma.aIGeneration.findMany,
  aIGenerationFindUnique: prisma.aIGeneration.findUnique,
  aIGenerationUpdate: prisma.aIGeneration.update,
}

let server
let baseUrl

before(async () => {
  prisma.profile.findUnique = async ({ where }) => {
    if (where.id === profileRecord.id) return profileRecord
    if (where.userId === userId) return profileRecord
    return null
  }
  prisma.profile.update = async ({ where, data }) => {
    if (where.id !== profileRecord.id) throw new Error('Profile not found')
    Object.assign(profileRecord, data, { updatedAt: new Date() })
    return profileRecord
  }
  prisma.experience.findMany = async ({ where }) => (where.userId === userId ? experienceRecords : [])
  prisma.project.findMany = async ({ where }) => (where.userId === userId ? projectRecords : [])
  prisma.project.findUnique = async ({ where }) => projectRecords.find((project) => project.id === where.id) ?? null
  prisma.project.update = async ({ where, data }) => {
    const project = projectRecords.find((entry) => entry.id === where.id)
    if (!project) throw new Error('Project not found')
    Object.assign(project, data)
    return project
  }
  prisma.skill.findMany = async ({ where }) => (where.userId === userId ? skillRecords : [])
  prisma.education.findMany = async ({ where }) => (where.userId === userId ? educationRecords : [])
  prisma.aIGeneration.create = async ({ data }) => {
    const generation = {
      id: `00000000-0000-0000-0000-${String(storedGenerations.length + 1).padStart(12, '0')}`,
      status: 'PENDING',
      targetType: null,
      targetId: null,
      editedText: null,
      updatedAt: new Date(),
      ...data,
      createdAt: new Date(),
    }
    storedGenerations.push(generation)
    return generation
  }
  prisma.aIGeneration.findMany = async ({ where }) => storedGenerations.filter((entry) => entry.userId === where.userId)
  prisma.aIGeneration.findUnique = async ({ where }) => storedGenerations.find((entry) => entry.id === where.id) ?? null
  prisma.aIGeneration.update = async ({ where, data }) => {
    const index = storedGenerations.findIndex((entry) => entry.id === where.id)
    if (index === -1) throw new Error('Recommendation not found')
    const updated = {
      ...storedGenerations[index],
      ...data,
      updatedAt: new Date(),
    }
    storedGenerations[index] = updated
    return updated
  }

  server = createApp().listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  prisma.profile.findUnique = originalMethods.profileFindUnique
  prisma.profile.update = originalMethods.profileUpdate
  prisma.experience.findMany = originalMethods.experienceFindMany
  prisma.project.findMany = originalMethods.projectFindMany
  prisma.project.findUnique = originalMethods.projectFindUnique
  prisma.project.update = originalMethods.projectUpdate
  prisma.skill.findMany = originalMethods.skillFindMany
  prisma.education.findMany = originalMethods.educationFindMany
  prisma.aIGeneration.create = originalMethods.aIGenerationCreate
  prisma.aIGeneration.findMany = originalMethods.aIGenerationFindMany
  prisma.aIGeneration.findUnique = originalMethods.aIGenerationFindUnique
  prisma.aIGeneration.update = originalMethods.aIGenerationUpdate
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

test('unauthorized AI request is rejected', async () => {
  const response = await request('/api/ai/improve-summary', {
    method: 'POST',
    body: JSON.stringify({ text: 'Test text' }),
  })

  assert.equal(response.status, 401)
})

test('authorized summary improvement returns a suggestion', async () => {
  const response = await request('/api/ai/improve-summary', {
    method: 'POST',
    token,
    body: JSON.stringify({ text: 'Computer science student with programming skills.' }),
  })

  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.type, 'professional_summary')
  assert.ok(typeof body.suggestion === 'string')
  assert.ok(body.suggestion.length > 20)
})

test('summary improvement uses stored CV context and remains pending', async () => {
  const response = await request('/api/ai/improve-summary', {
    method: 'POST',
    token,
    body: JSON.stringify({ text: profileRecord.bio }),
  })
  const body = await response.json()
  const saved = storedGenerations.find((record) => record.id === body.id)

  assert.equal(response.status, 200)
  assert.equal(body.status, 'PENDING')
  assert.equal(body.original, profileRecord.bio)
  assert.notEqual(body.suggestion.trim(), profileRecord.bio.trim())
  assert.ok(body.reasoning[0])
  assert.equal(saved.targetType, 'PROFILE')
  assert.equal(saved.targetId, profileRecord.id)
  assert.equal(saved.inputText, profileRecord.bio)
  assert.match(getLastMockUserPrompt(), /Computer science student/)
  assert.match(getLastMockUserPrompt(), /Frontend Developer/)
  assert.match(getLastMockUserPrompt(), /Computer Science/)
})

test('summary improvement avoids fabrication when CV data is insufficient', async () => {
  const originalBio = profileRecord.bio
  profileRecord.bio = 'Student.'
  process.env.GROQ_MOCK_RESPONSE = 'summary-insufficient'
  const response = await request('/api/ai/improve-summary', {
    method: 'POST',
    token,
    body: JSON.stringify({ text: profileRecord.bio }),
  })
  delete process.env.GROQ_MOCK_RESPONSE
  profileRecord.bio = originalBio
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.status, 'PENDING')
  assert.doesNotMatch(body.suggestion, /years|certified|\d+%|managed|led/i)
})

test('unchanged summary includes an explicit no-change explanation', async () => {
  const currentSummary = profileRecord.bio
  process.env.GROQ_MOCK_RESPONSE = 'summary-unchanged'
  const response = await request('/api/ai/improve-summary', {
    method: 'POST',
    token,
    body: JSON.stringify({ text: currentSummary }),
  })
  delete process.env.GROQ_MOCK_RESPONSE
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.suggestion, currentSummary)
  assert.match(body.reasoning[0], /No substantial change was necessary/i)
  assert.equal(body.status, 'PENDING')
})

test('experience improvement preserves facts and returns structured advice', async () => {
  const response = await request('/api/ai/improve-experience', {
    method: 'POST',
    token,
    body: JSON.stringify({
      experienceId: experienceRecords[0].id,
      description: 'Built a website using React and CSS.',
    }),
  })

  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.type, 'experience_improvement')
  assert.ok(body.suggestion.includes('React'))
  assert.ok(Array.isArray(body.reasoning))
})

test('experience generation rejects another user target', async () => {
  const response = await request('/api/ai/improve-experience', {
    method: 'POST',
    token: signAccessToken(otherUserId),
    body: JSON.stringify({ experienceId: experienceRecords[0].id, description: experienceRecords[0].description }),
  })

  assert.equal(response.status, 404)
})

test('project improvement returns improved project guidance', async () => {
  const response = await request('/api/ai/improve-project', {
    method: 'POST',
    token,
    body: JSON.stringify({
      projectId: projectRecords[0].id,
      description: 'Built a portfolio app for managing content.',
    }),
  })

  const body = await response.json()
  assert.equal(response.status, 200, JSON.stringify(body))
  assert.equal(body.type, 'project_improvement')
  assert.ok(typeof body.suggestion === 'string')
})

test('project improvement uses full stored context and remains pending', async () => {
  const response = await request('/api/ai/improve-project', {
    method: 'POST',
    token,
    body: JSON.stringify({
      projectId: projectRecords[0].id,
      description: projectRecords[0].description,
    }),
  })
  const body = await response.json()
  const saved = storedGenerations.find((record) => record.id === body.id)

  assert.equal(response.status, 200)
  assert.equal(body.status, 'PENDING')
  assert.notEqual(body.suggestion.trim(), projectRecords[0].description.trim())
  assert.equal(saved.targetType, 'PROJECT')
  assert.equal(saved.targetId, projectRecords[0].id)
  assert.match(saved.inputText, /Portfolio App/)
  assert.match(saved.inputText, /React/)
  assert.match(saved.inputText, /github.com\/example\/portfolio/)
  assert.match(saved.inputText, /Frontend Developer/)
  assert.match(saved.inputText, /Computer Science/)
})

test('project improvement rejects fabricated numeric claims', async () => {
  const beforeCount = storedGenerations.length
  process.env.GROQ_MOCK_RESPONSE = 'fabricated-project'
  const response = await request('/api/ai/improve-project', {
    method: 'POST',
    token,
    body: JSON.stringify({ projectId: projectRecords[0].id, description: projectRecords[0].description }),
  })
  delete process.env.GROQ_MOCK_RESPONSE

  assert.equal(response.status, 502)
  assert.equal(storedGenerations.length, beforeCount)
})

test('project context recognizes stored URLs and rejects unsupported features', async () => {
  assert.match(JSON.stringify(projectRecords[0]), /github.com\/example\/portfolio/)
  process.env.GROQ_MOCK_RESPONSE = 'fabricated-project-feature'
  const response = await request('/api/ai/improve-project', {
    method: 'POST',
    token,
    body: JSON.stringify({ projectId: projectRecords[0].id, description: projectRecords[0].description }),
  })
  delete process.env.GROQ_MOCK_RESPONSE

  assert.equal(response.status, 502)
})

test('project recommendation reject leaves the project unchanged', async () => {
  const originalDescription = projectRecords[0].description
  const response = await request('/api/ai/improve-project', {
    method: 'POST',
    token,
    body: JSON.stringify({ projectId: projectRecords[0].id, description: originalDescription }),
  })
  const created = await response.json()
  const rejectResponse = await request(`/api/ai/recommendations/${created.id}/reject`, { method: 'POST', token })
  const rejected = await rejectResponse.json()

  assert.equal(rejectResponse.status, 200)
  assert.equal(rejected.recommendation.status, 'REJECTED')
  assert.equal(projectRecords[0].description, originalDescription)
})

test('project recommendation edit then accept updates only the owned project', async () => {
  const response = await request('/api/ai/improve-project', {
    method: 'POST',
    token,
    body: JSON.stringify({ projectId: projectRecords[0].id, description: projectRecords[0].description }),
  })
  const created = await response.json()
  const editedText = 'Built the Portfolio App with React and Node.js, using the stored project scope to manage professional content.'
  const editResponse = await request(`/api/ai/recommendations/${created.id}/edit`, {
    method: 'POST',
    token,
    body: JSON.stringify({ editedText }),
  })
  const acceptResponse = await request(`/api/ai/recommendations/${created.id}/accept`, {
    method: 'POST',
    token,
    body: JSON.stringify({ targetType: 'PROJECT', targetId: projectRecords[0].id, field: 'description' }),
  })
  const accepted = await acceptResponse.json()

  assert.equal(editResponse.status, 200)
  assert.equal(acceptResponse.status, 200)
  assert.equal(accepted.recommendation.status, 'ACCEPTED')
  assert.equal(projectRecords[0].description, editedText)
  assert.equal(projectRecords[0].userId, userId)
})

test('skill suggestions separate existing skills from suggested skills', async () => {
  const response = await request('/api/ai/suggest-skills', {
    method: 'POST',
    token,
    body: JSON.stringify({
      experience: experienceRecords,
      projects: projectRecords,
      skills: skillRecords,
    }),
  })

  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.type, 'skill_suggestions')
  assert.ok(Array.isArray(body.existingSkills))
  assert.ok(Array.isArray(body.suggestedSkills))
  assert.ok(!body.suggestedSkills.some((skill) => ['react', 'node.js'].includes(skill.toLowerCase())))
  assert.ok(typeof body.suggestion === 'string')
})

test('cv optimization returns structured suggestions', async () => {
  const response = await request('/api/ai/optimize-cv', {
    method: 'POST',
    token,
    body: JSON.stringify({
      profile: profileRecord,
      experience: experienceRecords,
      projects: projectRecords,
      skills: skillRecords,
    }),
  })

  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.type, 'cv_optimization')
  assert.ok(Array.isArray(body.suggestions))
  assert.ok(body.suggestions.some((suggestion) => /existing education/i.test(suggestion)))
  assert.ok(body.suggestions.every((suggestion) => !/add an education section/i.test(suggestion)))
  assert.ok(typeof body.suggestion === 'string')
})

test('job description analysis compares skills and gaps', async () => {
  const response = await request('/api/ai/analyze-job-description', {
    method: 'POST',
    token,
    body: JSON.stringify({
      jobTitle: 'Frontend Developer',
      description: 'We need React, TypeScript, API integration, and UX design skills.',
      skills: skillRecords,
    }),
  })

  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.type, 'job_analysis')
  assert.ok(Array.isArray(body.matchingSkills))
  assert.ok(Array.isArray(body.missingSkills) || Array.isArray(body.suggestions))
  assert.ok(typeof body.suggestion === 'string')
})

test('failed approval preserves pending recommendation', async () => {
  const response = await request('/api/ai/improve-project', {
    method: 'POST',
    token,
    body: JSON.stringify({ projectId: projectRecords[0].id, description: projectRecords[0].description }),
  })
  const created = await response.json()
  const acceptResponse = await request(`/api/ai/recommendations/${created.id}/accept`, {
    method: 'POST',
    token,
    body: JSON.stringify({ targetType: 'PROJECT', targetId: projectRecords[0].id, field: 'unsupported' }),
  })
  const stored = storedGenerations.find((record) => record.id === created.id)

  assert.equal(acceptResponse.status, 422)
  assert.equal(stored.status, 'PENDING')
})

test('advisory skill recommendation can be accepted without CV mutation', async () => {
  const response = await request('/api/ai/suggest-skills', {
    method: 'POST',
    token,
    body: JSON.stringify({ skills: skillRecords }),
  })
  const created = await response.json()
  const acceptResponse = await request(`/api/ai/recommendations/${created.id}/accept`, { method: 'POST', token })
  const accepted = await acceptResponse.json()

  assert.equal(acceptResponse.status, 200)
  assert.equal(accepted.recommendation.status, 'ACCEPTED')
  assert.equal(skillRecords.length, 2)
})

test('invalid AI request input is rejected', async () => {
  const response = await request('/api/ai/improve-summary', {
    method: 'POST',
    token,
    body: JSON.stringify({ text: 123 }),
  })

  assert.equal(response.status, 400)
})

test('missing Groq API key is handled as a safe error', async () => {
  const originalKey = process.env.GROQ_API_KEY
  delete process.env.GROQ_API_KEY
  delete process.env.AI_PROVIDER_MODE

  const response = await request('/api/ai/improve-summary', {
    method: 'POST',
    token,
    body: JSON.stringify({ text: 'Example summary' }),
  })

  assert.equal(response.status, 503)

  if (originalKey) {
    process.env.GROQ_API_KEY = originalKey
  }
})

test('provider failure is handled as a safe error', async () => {
  process.env.AI_PROVIDER_MODE = 'disabled'
  const response = await request('/api/ai/improve-summary', {
    method: 'POST',
    token,
    body: JSON.stringify({ text: 'Example summary' }),
  })

  assert.equal(response.status, 503)
  delete process.env.AI_PROVIDER_MODE
})

test('recommendations are stored and marked pending for the authenticated user', async () => {
  const response = await request('/api/ai/improve-summary', {
    method: 'POST',
    token,
    body: JSON.stringify({ text: 'Motivated software developer with a focus on product delivery.' }),
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.type, 'professional_summary')
  assert.ok(body.id)
  assert.ok(Array.isArray(storedGenerations))
  const saved = storedGenerations.at(-1)
  assert.equal(saved.userId, userId)
  assert.equal(saved.status, 'PENDING')
})

test('authenticated user can retrieve own recommendations', async () => {
  const response = await request('/api/ai/recommendations', { token })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.ok(Array.isArray(body.recommendations))
  assert.ok(body.recommendations.length > 0)
  assert.equal(body.recommendations[0].userId, userId)
})

test('user cannot access another user recommendation', async () => {
  const target = storedGenerations[0]
  const response = await request(`/api/ai/recommendations/${target.id}`, {
    token: signAccessToken(otherUserId),
  })

  assert.equal(response.status, 404)
})

test('recommendation can be accepted and status is updated', async () => {
  const target = storedGenerations.find((record) => record.userId === userId && record.status === 'PENDING')
  const response = await request(`/api/ai/recommendations/${target.id}/accept`, {
    method: 'POST',
    token,
    body: JSON.stringify({ targetType: 'profile', targetId: profileRecord.id, field: 'bio' }),
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.recommendation.status, 'ACCEPTED')
  assert.equal(body.recommendation.userId, userId)
})

test('recommendation can be rejected and is not applied to CV data', async () => {
  const response = await request('/api/ai/improve-summary', {
    method: 'POST',
    token,
    body: JSON.stringify({ text: 'Another strong summary draft.' }),
  })
  const created = await response.json()
  const rejectResponse = await request(`/api/ai/recommendations/${created.id}/reject`, {
    method: 'POST',
    token,
  })
  const rejectBody = await rejectResponse.json()

  assert.equal(rejectResponse.status, 200)
  assert.equal(rejectBody.recommendation.status, 'REJECTED')
})

test('pending recommendation can be edited before review', async () => {
  const response = await request('/api/ai/improve-summary', {
    method: 'POST',
    token,
    body: JSON.stringify({ text: 'Editable summary draft.' }),
  })
  const created = await response.json()
  const editResponse = await request(`/api/ai/recommendations/${created.id}/edit`, {
    method: 'POST',
    token,
    body: JSON.stringify({ editedText: 'Edited summary draft.' }),
  })
  const edited = await editResponse.json()

  assert.equal(editResponse.status, 200)
  assert.equal(edited.recommendation.status, 'PENDING')
  assert.equal(edited.recommendation.suggestion, 'Edited summary draft.')
})

test('already accepted recommendation cannot be accepted again', async () => {
  const target = storedGenerations.find((record) => record.userId === userId && record.status === 'ACCEPTED')
  const response = await request(`/api/ai/recommendations/${target.id}/accept`, {
    method: 'POST',
    token,
    body: JSON.stringify({ targetType: 'profile', targetId: profileRecord.id, field: 'bio' }),
  })

  assert.equal(response.status, 409)
})

test('arbitrary CV field names are rejected during accept', async () => {
  const response = await request('/api/ai/improve-summary', {
    method: 'POST',
    token,
    body: JSON.stringify({ text: 'Another item for approval.' }),
  })
  const created = await response.json()
  const rejectResponse = await request(`/api/ai/recommendations/${created.id}/accept`, {
    method: 'POST',
    token,
    body: JSON.stringify({ targetType: 'profile', targetId: profileRecord.id, field: 'password' }),
  })

  assert.equal(rejectResponse.status, 422)
})

test('malformed provider output is rejected safely', async () => {
  process.env.GROQ_MOCK_RESPONSE = 'malformed'
  const response = await request('/api/ai/improve-summary', {
    method: 'POST',
    token,
    body: JSON.stringify({ text: 'Malformed response test.' }),
  })
  const body = await response.json()

  assert.equal(response.status, 502)
  assert.equal(body.error, 'AI provider returned an invalid response')
  delete process.env.GROQ_MOCK_RESPONSE
})

test('provider rate limits are classified separately', async () => {
  process.env.GROQ_MOCK_ERROR_STATUS = '429'
  const response = await request('/api/ai/improve-summary', {
    method: 'POST',
    token,
    body: JSON.stringify({ text: 'Rate limit test.' }),
  })
  const body = await response.json()

  assert.equal(response.status, 429)
  assert.equal(body.error, 'AI provider rate limit reached')
  delete process.env.GROQ_MOCK_ERROR_STATUS
})
