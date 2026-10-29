import assert from 'node:assert/strict'
import test from 'node:test'
import { toResourceFormValues, toResourcePayload } from '../src/pages/resourceFormValues.js'

test('resource edit values include editable fields but exclude database metadata', () => {
  const values = toResourceFormValues({
    id: 'record-id',
    userId: 'owner-id',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-02T00:00:00.000Z',
    institution: 'Example University',
    startDate: '2021-09-01T00:00:00.000Z',
    endDate: null,
  }, ['institution', 'startDate', 'endDate'])

  assert.deepEqual(values, {
    institution: 'Example University',
    startDate: '2021-09-01',
    endDate: '',
  })
  assert.equal(Object.hasOwn(values, 'id'), false)
  assert.equal(Object.hasOwn(values, 'userId'), false)
})

test('project edit values convert technologies and omit fields not in the form', () => {
  const values = toResourceFormValues({
    title: 'Example project',
    technologies: ['React', 'Node.js'],
    isPublished: true,
  }, ['title', 'technologies'])

  assert.deepEqual(values, {
    title: 'Example project',
    technologies: 'React, Node.js',
  })
})

test('empty optional date controls are sent as null for backend date validation', () => {
  assert.deepEqual(toResourcePayload({
    institution: 'Example University',
    startDate: '',
    endDate: '',
  }), {
    institution: 'Example University',
    startDate: null,
    endDate: null,
  })
})
