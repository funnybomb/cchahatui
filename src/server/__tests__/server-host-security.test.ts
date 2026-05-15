import { describe, expect, it } from 'bun:test'
import { startServer } from '../index.js'
import {
  assertSafeServerHost,
  isLoopbackServerHost,
  normalizeServerHost,
} from '../serverHostSecurity.js'

describe('server host security', () => {
  it('normalizes bracketed and padded hosts', () => {
    expect(normalizeServerHost(' [::1] ')).toBe('::1')
    expect(normalizeServerHost(' LOCALHOST ')).toBe('localhost')
  })

  it('allows loopback hosts without auth', () => {
    for (const host of ['127.0.0.1', 'localhost', '::1', '[::1]']) {
      expect(isLoopbackServerHost(host)).toBe(true)
      expect(() => assertSafeServerHost(host)).not.toThrow()
    }
  })

  it('rejects non-loopback hosts', () => {
    for (const host of ['0.0.0.0', '::', '[::]', '192.168.1.10']) {
      expect(isLoopbackServerHost(host)).toBe(false)
      expect(() => assertSafeServerHost(host)).toThrow(
        'Refusing to bind cchahatui server to non-loopback host',
      )
    }
  })

  it('rejects non-loopback server startup even when auth is required', () => {
    const original = process.env.SERVER_AUTH_REQUIRED
    process.env.SERVER_AUTH_REQUIRED = '1'
    try {
      expect(() => startServer(0, '0.0.0.0')).toThrow(
        'Refusing to bind cchahatui server to non-loopback host',
      )
    } finally {
      if (original === undefined) {
        delete process.env.SERVER_AUTH_REQUIRED
      } else {
        process.env.SERVER_AUTH_REQUIRED = original
      }
    }
  })
})
