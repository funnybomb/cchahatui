import { afterEach, describe, expect, it } from 'bun:test'
import { requireAuth, validateAuth, validateRequestAuth } from './auth.js'

const originalApiKey = process.env.ANTHROPIC_API_KEY

function makeRequest(authorization?: string): Request {
  const headers = new Headers()
  if (authorization) headers.set('Authorization', authorization)
  return new Request('http://127.0.0.1/api/test', { headers })
}

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.ANTHROPIC_API_KEY
  } else {
    process.env.ANTHROPIC_API_KEY = originalApiKey
  }
})

describe('auth middleware', () => {
  it('rejects missing and malformed bearer headers', () => {
    process.env.ANTHROPIC_API_KEY = 'secret'

    expect(validateAuth(makeRequest())).toEqual({
      valid: false,
      error: 'Missing Authorization header',
    })
    expect(validateAuth(makeRequest('Basic secret'))).toEqual({
      valid: false,
      error: 'Invalid Authorization format. Use: Bearer <token>',
    })
  })

  it('requires a configured API key', () => {
    delete process.env.ANTHROPIC_API_KEY

    expect(validateAuth(makeRequest('Bearer secret'))).toEqual({
      valid: false,
      error: 'Server ANTHROPIC_API_KEY not configured',
    })
  })

  it('accepts matching bearer headers', async () => {
    process.env.ANTHROPIC_API_KEY = 'secret'

    expect(validateAuth(makeRequest('Bearer secret'))).toEqual({ valid: true })
    expect(await validateRequestAuth(makeRequest('Bearer secret'))).toEqual({ valid: true })
  })

  it('rejects invalid bearer headers', async () => {
    process.env.ANTHROPIC_API_KEY = 'secret'

    expect(validateAuth(makeRequest('Bearer other'))).toEqual({
      valid: false,
      error: 'Invalid API key',
    })
  })

  it('returns a 401 response for failed auth', async () => {
    process.env.ANTHROPIC_API_KEY = 'secret'

    const response = await requireAuth(makeRequest('Bearer other'))

    expect(response?.status).toBe(401)
    expect(await response?.json()).toEqual({
      error: 'Unauthorized',
      message: 'Invalid API key',
    })
  })
})
