const UNSCOPED_PROJECT_KEY = '__unscoped__'
const UNKNOWN_PROJECT_KEY = '_unknown'
const WORKTREE_MARKERS = [
  '/.claude/worktrees/',
  '/.codex/worktrees/',
  '\\.claude\\worktrees\\',
  '\\.codex\\worktrees\\',
]

const SANITIZED_PATH_ROOT_RE = /^-*(?:users|home|private|var|tmp|volumes|mnt|workspace|workspaces|project|projects|repo|repos)(?:-|$)/i
const SANITIZED_WINDOWS_PATH_RE = /^[a-z]--/i
const POSIX_HOME_PATH_RE = /^\/(?:Users|home)\/[^/\\]+(?=$|[\\/])/i
const WINDOWS_HOME_PATH_RE = /^[a-z]:[\\/]+Users[\\/]+[^\\/]+(?=$|[\\/])/i

export function getProjectDisplayName(projectPath: string | null | undefined, fallback = ''): string {
  const trimmed = (projectPath ?? '').trim()
  if (!trimmed || trimmed === UNSCOPED_PROJECT_KEY || trimmed === UNKNOWN_PROJECT_KEY) return fallback

  const displayRoot = stripWorktreePath(trimmed)
  const urlName = getUrlProjectName(displayRoot)
  if (urlName) return urlName

  const normalized = displayRoot.replace(/[\\/]+$/, '')
  const pathParts = normalized.split(/[\\/]+/).filter(Boolean)
  if (pathParts.length > 0 && isPathLike(normalized)) {
    return pathParts[pathParts.length - 1] || fallback
  }

  if (isSanitizedPathSlug(normalized)) {
    const segments = normalized.split('-').filter(Boolean)
    return segments[segments.length - 1] || fallback
  }

  return normalized || fallback
}

export function getProjectDisplayPath(projectPath: string | null | undefined, fallback = ''): string {
  const trimmed = (projectPath ?? '').trim()
  if (!trimmed || trimmed === UNSCOPED_PROJECT_KEY || trimmed === UNKNOWN_PROJECT_KEY) return fallback

  const posixHomeMatch = trimmed.match(POSIX_HOME_PATH_RE)
  if (posixHomeMatch) {
    const rest = trimmed.slice(posixHomeMatch[0].length).replace(/^[\\/]+/, '')
    return rest ? `~/${rest}` : '~'
  }

  const windowsHomeMatch = trimmed.match(WINDOWS_HOME_PATH_RE)
  if (windowsHomeMatch) {
    const rest = trimmed.slice(windowsHomeMatch[0].length).replace(/^[\\/]+/, '').replace(/[\\/]+/g, '\\')
    return rest ? `~\\${rest}` : '~'
  }

  if (isSanitizedPathSlug(trimmed)) {
    return getProjectDisplayName(trimmed, fallback)
  }

  return trimmed || fallback
}

function stripWorktreePath(projectPath: string): string {
  const lower = projectPath.toLowerCase()
  for (const marker of WORKTREE_MARKERS) {
    const index = lower.indexOf(marker.toLowerCase())
    if (index >= 0) return projectPath.slice(0, index)
  }
  return projectPath
}

function getUrlProjectName(projectPath: string): string | null {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(projectPath)) return null
  try {
    const parsed = new URL(projectPath)
    const name = parsed.pathname.split('/').filter(Boolean).pop()
    return name || parsed.hostname || null
  } catch {
    return null
  }
}

function isPathLike(projectPath: string): boolean {
  return projectPath.startsWith('/') ||
    projectPath.startsWith('\\') ||
    /^[a-z]:[\\/]/i.test(projectPath) ||
    projectPath.includes('/') ||
    projectPath.includes('\\')
}

function isSanitizedPathSlug(projectPath: string): boolean {
  const segments = projectPath.split('-').filter(Boolean)
  return projectPath.startsWith('-') ||
    SANITIZED_WINDOWS_PATH_RE.test(projectPath) ||
    (segments.length >= 3 && SANITIZED_PATH_ROOT_RE.test(projectPath))
}
