/**
 * CORS middleware for local desktop and web development.
 */

export function corsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigin = origin || 'http://localhost:3000'
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function baseCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export type CorsResolution = {
  allowed: boolean
  rejected: boolean
  headers: Record<string, string>
}

const LOCAL_ORIGINS = new Set([
  'http://tauri.localhost',
  'https://tauri.localhost',
  'tauri://localhost',
])

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname
    .trim()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .toLowerCase()
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
}

function isLocalOrigin(origin?: string | null): boolean {
  if (!origin) {
    return true
  }

  if (LOCAL_ORIGINS.has(origin)) {
    return true
  }

  try {
    return isLoopbackHost(new URL(origin).hostname)
  } catch {
    return false
  }
}

export async function resolveCors(
  origin?: string | null,
  _requestOrigin?: string | null,
): Promise<CorsResolution> {
  if (!origin) {
    return {
      allowed: true,
      rejected: false,
      headers: corsHeaders(origin),
    }
  }

  if (isLocalOrigin(origin)) {
    return {
      allowed: true,
      rejected: false,
      headers: {
        ...baseCorsHeaders(),
        'Access-Control-Allow-Origin': origin,
      },
    }
  }

  return {
    allowed: false,
    rejected: true,
    headers: baseCorsHeaders(),
  }
}
