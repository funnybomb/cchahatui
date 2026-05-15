export function normalizeServerHost(host: string): string {
  return host.trim().replace(/^\[/, '').replace(/\]$/, '').toLowerCase()
}

export function isLoopbackServerHost(host: string): boolean {
  const normalized = normalizeServerHost(host)
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1'
}

export function assertSafeServerHost(host: string): void {
  if (isLoopbackServerHost(host)) return

  throw new Error(
    `Refusing to bind cchahatui server to non-loopback host: ${host}. ` +
      'The web server is local-only.',
  )
}
