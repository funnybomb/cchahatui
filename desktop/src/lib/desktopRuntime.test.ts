import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clientMocks = vi.hoisted(() => ({
  defaultBaseUrl: 'http://127.0.0.1:3456',
  explicitDefaultBaseUrl: false,
  setBaseUrl: vi.fn(),
}))

vi.mock('../api/client', () => ({
  getDefaultBaseUrl: () => clientMocks.defaultBaseUrl,
  hasExplicitDefaultBaseUrl: () => clientMocks.explicitDefaultBaseUrl,
  setBaseUrl: clientMocks.setBaseUrl,
}))

import {
  initializeDesktopServerUrl,
  isLoopbackHostname,
} from './desktopRuntime'

function healthOkResponse() {
  return Response.json({ status: 'ok' })
}

describe('desktopRuntime browser bootstrap', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    clientMocks.defaultBaseUrl = 'http://127.0.0.1:3456'
    clientMocks.explicitDefaultBaseUrl = false
    vi.useRealTimers()
    window.history.pushState({}, '', '/')
    globalThis.fetch = originalFetch
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.fetch = originalFetch
  })

  it('treats IPv6 loopback as local', () => {
    expect(isLoopbackHostname('[::1]')).toBe(true)
    expect(isLoopbackHostname('::1')).toBe(true)
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('192.168.0.102')).toBe(false)
    expect(isLoopbackHostname('example.invalid')).toBe(false)
  })

  it('uses the current browser origin when served by the desktop server', async () => {
    clientMocks.defaultBaseUrl = window.location.origin
    globalThis.fetch = vi.fn().mockResolvedValue(healthOkResponse()) as typeof fetch

    await expect(initializeDesktopServerUrl()).resolves.toBe(window.location.origin)

    expect(clientMocks.setBaseUrl).toHaveBeenLastCalledWith(window.location.origin)
    expect(globalThis.fetch).toHaveBeenCalledWith(`${window.location.origin}/health`, {
      cache: 'no-store',
    })
    expect(globalThis.fetch).toHaveBeenCalledWith(`${window.location.origin}/api/status`, {
      cache: 'no-store',
    })
  })

  it('prefers the default local server over the Vite dev origin', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(healthOkResponse()) as typeof fetch

    await expect(initializeDesktopServerUrl()).resolves.toBe('http://127.0.0.1:3456')

    expect(clientMocks.setBaseUrl).toHaveBeenLastCalledWith('http://127.0.0.1:3456')
    expect(globalThis.fetch).not.toHaveBeenCalledWith(`${window.location.origin}/health`, expect.anything())
    expect(globalThis.fetch).toHaveBeenCalledWith('http://127.0.0.1:3456/health', {
      cache: 'no-store',
    })
    expect(globalThis.fetch).toHaveBeenCalledWith('http://127.0.0.1:3456/api/status', {
      cache: 'no-store',
    })
  })

  it('falls back to same-origin when the default local server is unavailable', async () => {
    vi.useFakeTimers()
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).startsWith('http://127.0.0.1:3456/')) {
        throw new TypeError('backend offline')
      }
      return healthOkResponse()
    }) as typeof fetch

    const startup = expect(initializeDesktopServerUrl()).resolves.toBe(window.location.origin)
    await vi.runAllTimersAsync()
    await startup

    expect(globalThis.fetch).toHaveBeenCalledWith('http://127.0.0.1:3456/health', {
      cache: 'no-store',
    })
    expect(globalThis.fetch).toHaveBeenCalledWith(`${window.location.origin}/health`, {
      cache: 'no-store',
    })
    expect(clientMocks.setBaseUrl).toHaveBeenLastCalledWith(window.location.origin)
  })

  it('prefers an explicit local server URL over the dev server origin', async () => {
    clientMocks.defaultBaseUrl = 'http://127.0.0.1:55189'
    clientMocks.explicitDefaultBaseUrl = true
    globalThis.fetch = vi.fn().mockResolvedValue(healthOkResponse()) as typeof fetch

    await expect(initializeDesktopServerUrl()).resolves.toBe('http://127.0.0.1:55189')

    expect(clientMocks.setBaseUrl).toHaveBeenLastCalledWith('http://127.0.0.1:55189')
    expect(globalThis.fetch).toHaveBeenCalledWith('http://127.0.0.1:55189/health', {
      cache: 'no-store',
    })
    expect(globalThis.fetch).toHaveBeenCalledWith('http://127.0.0.1:55189/api/status', {
      cache: 'no-store',
    })
  })

  it('rejects explicit non-local browser server URLs', async () => {
    window.history.pushState({}, '', '/?serverUrl=https%3A%2F%2Fexample.invalid%2Fapp')

    await expect(initializeDesktopServerUrl()).rejects.toThrow(
      'Non-local browser server URLs are not supported.',
    )

    expect(clientMocks.setBaseUrl).not.toHaveBeenCalled()
  })
})
