import { describe, expect, it } from 'bun:test'
import { corsHeaders, resolveCors } from './cors'

describe('corsHeaders', () => {
  it('allows localhost browser origins', () => {
    expect(corsHeaders('http://127.0.0.1:1420')['Access-Control-Allow-Origin']).toBe('http://127.0.0.1:1420')
    expect(corsHeaders('http://localhost:3000')['Access-Control-Allow-Origin']).toBe('http://localhost:3000')
  })

  it('allows tauri webview origins used in production builds', () => {
    expect(corsHeaders('http://tauri.localhost')['Access-Control-Allow-Origin']).toBe('http://tauri.localhost')
    expect(corsHeaders('https://tauri.localhost')['Access-Control-Allow-Origin']).toBe('https://tauri.localhost')
    expect(corsHeaders('tauri://localhost')['Access-Control-Allow-Origin']).toBe('tauri://localhost')
  })

  it('falls back to localhost when no origin is provided', () => {
    expect(corsHeaders(null)['Access-Control-Allow-Origin']).toBe('http://localhost:3000')
  })
})

describe('resolveCors', () => {
  it('allows loopback browser origins for local web development', async () => {
    const result = await resolveCors('http://127.0.0.1:1431', 'http://127.0.0.1:3456')

    expect(result).toEqual({
      allowed: true,
      rejected: false,
      headers: {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:1431',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      },
    })
  })

  it('rejects non-local browser origins', async () => {
    const result = await resolveCors('https://blocked.example.com', 'http://127.0.0.1:3456')

    expect(result).toEqual({
      allowed: false,
      rejected: true,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      },
    })
  })

  it('keeps trusted local desktop origins allowed', async () => {
    for (const origin of ['http://tauri.localhost', 'http://127.0.0.1:5179']) {
      const result = await resolveCors(origin, 'http://127.0.0.1:3456')

      expect(result.allowed).toBe(true)
      expect(result.rejected).toBe(false)
      expect(result.headers['Access-Control-Allow-Origin']).toBe(origin)
    }
  })
})
