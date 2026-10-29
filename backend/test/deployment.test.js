import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { access } from 'node:fs/promises'

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  FRONTEND_URL: process.env.FRONTEND_URL,
  CORS_ORIGINS: process.env.CORS_ORIGINS,
}

process.env.NODE_ENV = 'production'
process.env.FRONTEND_URL = 'https://portfolio.example'
process.env.CORS_ORIGINS = 'https://preview.example'

const { default: app } = await import('../src/index.js')

let server
let baseUrl

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

test('exports an Express app suitable for Vercel and serves its health endpoint', async () => {
  assert.equal(typeof app, 'function')
  assert.equal(typeof app.listen, 'function')
  await assert.rejects(access(new URL('../src/app.js', import.meta.url)))
  await assert.rejects(access(new URL('../src/server.js', import.meta.url)))
  const response = await fetch(`${baseUrl}/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { name: 'AI CV Portfolio API', status: 'ok' })
})

test('production CORS allows only configured frontend origins, not local development origins', async () => {
  const allowed = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'https://portfolio.example' },
  })
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://portfolio.example')

  const preview = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'https://preview.example' },
  })
  assert.equal(preview.headers.get('access-control-allow-origin'), 'https://preview.example')

  const local = await fetch(`${baseUrl}/health`, {
    headers: { Origin: 'http://localhost:5173' },
  })
  assert.equal(local.headers.get('access-control-allow-origin'), null)
})
