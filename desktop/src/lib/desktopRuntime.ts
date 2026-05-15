import {
  getDefaultBaseUrl,
  hasExplicitDefaultBaseUrl,
  setBaseUrl,
} from '../api/client'

class FatalHealthcheckError extends Error {}

export function isTauriRuntime() {
  if (typeof window === 'undefined') return false
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}

export async function initializeDesktopServerUrl() {
  const fallbackUrl = getDefaultBaseUrl()

  if (!isTauriRuntime()) {
    return initializeBrowserServerUrl(fallbackUrl)
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const serverUrl = await invoke<string>('get_server_url')
    setBaseUrl(serverUrl)
    await waitForHealth(serverUrl)
    return serverUrl
  } catch (error) {
    const message =
      error instanceof Error ? error.message : `desktop server startup failed: ${String(error)}`
    console.error('[desktop] Failed to initialize desktop server URL', error)
    throw new Error(message || `desktop server startup failed (fallback would be ${fallbackUrl})`)
  }
}

async function initializeBrowserServerUrl(fallbackUrl: string) {
  const query = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : null
  const queryUrl = normalizeServerUrl(query?.get('serverUrl') ?? null)
  const requestedUrl =
    queryUrl ??
    getConfiguredBrowserServerUrl(fallbackUrl) ??
    fallbackUrl
  const fallbackCandidates = getBrowserServerUrlCandidates({
    fallbackUrl,
    requestedUrl,
    hasExplicitRequest: Boolean(queryUrl || hasExplicitDefaultBaseUrl()),
  })
  let lastHealthError: unknown = null

  for (const candidateUrl of fallbackCandidates) {
    if (!isLocalServerUrl(candidateUrl)) {
      lastHealthError = new Error('Non-local browser server URLs are not supported.')
      if (queryUrl === candidateUrl) {
        throw lastHealthError
      }
      continue
    }

    try {
      await waitForHealth(candidateUrl)
      await ensureBrowserApiAccessible(candidateUrl)
      setBaseUrl(candidateUrl)
      return candidateUrl
    } catch (error) {
      lastHealthError = error
    }
  }

  throw lastHealthError instanceof Error
    ? lastHealthError
    : new Error('Server healthcheck failed')
}

async function waitForHealth(serverUrl: string) {
  let lastError: unknown

  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(`${serverUrl}/health`, {
        cache: 'no-store',
      })
      if (response.ok) {
        const contentType = response.headers.get('content-type') ?? ''
        if (!contentType.toLowerCase().includes('application/json')) {
          throw new FatalHealthcheckError(
            `Server healthcheck failed: healthcheck returned non-JSON response from ${serverUrl}/health`,
          )
        } else {
          const body = await response.json().catch(() => null)
          if (body && typeof body === 'object' && 'status' in body && body.status === 'ok') {
            return
          }
          lastError = new Error(`healthcheck returned invalid response from ${serverUrl}/health`)
        }
      } else {
        lastError = new Error(`healthcheck returned ${response.status}`)
      }
    } catch (error) {
      if (error instanceof FatalHealthcheckError) {
        throw error
      }
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(
    lastError instanceof Error
      ? `Server healthcheck failed: ${lastError.message}`
      : 'Server healthcheck failed',
  )
}

async function ensureBrowserApiAccessible(serverUrl: string) {
  const response = await fetch(`${serverUrl}/api/status`, {
    cache: 'no-store',
  })
  if (response.status === 401) {
    throw new Error('Server requires authentication. Browser access only supports unauthenticated local servers.')
  }
}

function normalizeServerUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  try {
    return new URL(trimmed).toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

function getSameOriginServerUrl() {
  if (typeof window === 'undefined') {
    return null
  }

  if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
    return null
  }

  return normalizeServerUrl(window.location.origin)
}

function getConfiguredBrowserServerUrl(fallbackUrl: string) {
  if (hasExplicitDefaultBaseUrl()) {
    return normalizeServerUrl(fallbackUrl)
  }

  return getSameOriginServerUrl()
}

function getBrowserServerUrlCandidates({
  fallbackUrl,
  hasExplicitRequest,
  requestedUrl,
}: {
  fallbackUrl: string
  hasExplicitRequest: boolean
  requestedUrl: string
}) {
  if (hasExplicitRequest) return [requestedUrl]

  const normalizedFallback = normalizeServerUrl(fallbackUrl)
  const candidates = shouldPreferDefaultLocalServer(requestedUrl, normalizedFallback)
    ? [normalizedFallback, requestedUrl]
    : [requestedUrl, normalizedFallback]

  return candidates.filter((url, index, urls): url is string => (
    Boolean(url) && urls.indexOf(url) === index
  ))
}

function shouldPreferDefaultLocalServer(requestedUrl: string, fallbackUrl: string | null) {
  if (!fallbackUrl || requestedUrl === fallbackUrl) return false

  try {
    const requested = new URL(requestedUrl)
    const fallback = new URL(fallbackUrl)
    return (
      isLoopbackHostname(requested.hostname) &&
      isLoopbackHostname(fallback.hostname) &&
      requested.port !== fallback.port
    )
  } catch {
    return false
  }
}

export function isLoopbackHostname(hostname: string) {
  const normalized = hostname.trim().replace(/^\[/, '').replace(/\]$/, '').toLowerCase()
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1'
}

function isLocalServerUrl(serverUrl: string) {
  try {
    return isLoopbackHostname(new URL(serverUrl).hostname)
  } catch {
    return false
  }
}
