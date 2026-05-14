import * as fs from 'fs/promises'
import * as path from 'path'
import { createHash } from 'crypto'
import { ApiError } from '../middleware/errorHandler.js'
import { readRecoverableJsonFile } from './recoverableJsonFile.js'
import {
  ensureCchahatuiManagedConfigDirMigrated,
  getCchahatuiManagedConfigDir,
  getCchahatuiProjectConfigDir,
} from '../../utils/cchahatuiConfig.js'
import { findCanonicalGitRoot } from '../../utils/git.js'
import { sanitizePath } from '../../utils/sessionStoragePortable.js'

const CURRENT_PROJECT_INDEX_SCHEMA_VERSION = 3

export type ProjectGitIdentity = {
  isGit: boolean
  repoRoot: string | null
  remoteUrl: string | null
  repoName: string | null
  branch: string | null
}

export type ProjectIdentity = {
  schemaVersion: 1
  id: string
  key: string
  canonicalPath: string
  git: ProjectGitIdentity
}

type SavedProject = {
  path: string
  addedAt: string
  lastOpenedAt: string
  identity?: ProjectIdentity
}

type ProjectIndex = {
  schemaVersion: typeof CURRENT_PROJECT_INDEX_SCHEMA_VERSION
  projects: SavedProject[]
  hiddenProjectPaths: string[]
}

export type ProjectEntry = {
  projectPath: string
  realPath: string
  projectName: string
  isGit: boolean
  repoName: string | null
  branch: string | null
  identity: ProjectIdentity
  modifiedAt: string
  sessionCount: number
  saved: boolean
}

const DEFAULT_INDEX: ProjectIndex = {
  schemaVersion: CURRENT_PROJECT_INDEX_SCHEMA_VERSION,
  projects: [],
  hiddenProjectPaths: [],
}

const DESKTOP_WORKTREE_MARKER = '/.claude/worktrees/'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeProjectGitIdentity(value: unknown): ProjectGitIdentity | null {
  if (!isRecord(value) || typeof value.isGit !== 'boolean') return null

  const repoRoot = typeof value.repoRoot === 'string' ? value.repoRoot : null
  const remoteUrl = typeof value.remoteUrl === 'string' ? value.remoteUrl : null
  const repoName = typeof value.repoName === 'string' ? value.repoName : null
  const branch = typeof value.branch === 'string' ? value.branch : null
  return {
    isGit: value.isGit,
    repoRoot,
    remoteUrl,
    repoName,
    branch,
  }
}

function normalizeProjectIdentity(value: unknown): ProjectIdentity | undefined {
  if (
    !isRecord(value)
    || value.schemaVersion !== 1
    || typeof value.id !== 'string'
    || typeof value.key !== 'string'
    || typeof value.canonicalPath !== 'string'
  ) {
    return undefined
  }

  const git = normalizeProjectGitIdentity(value.git)
  if (!git) return undefined

  return {
    schemaVersion: 1,
    id: value.id,
    key: value.key,
    canonicalPath: value.canonicalPath,
    git,
  }
}

function normalizeProjectIndex(value: unknown): ProjectIndex | null {
  if (!isRecord(value) || !Array.isArray(value.projects)) {
    return null
  }

  const projects: SavedProject[] = []
  const seen = new Set<string>()
  for (const item of value.projects) {
    if (!isRecord(item) || typeof item.path !== 'string' || !item.path.trim()) continue
    const normalizedPath = path.resolve(item.path)
    if (seen.has(normalizedPath)) continue
    seen.add(normalizedPath)
    const addedAt = typeof item.addedAt === 'string' ? item.addedAt : new Date(0).toISOString()
    const lastOpenedAt = typeof item.lastOpenedAt === 'string' ? item.lastOpenedAt : addedAt
    const identity = normalizeProjectIdentity(item.identity)
    projects.push({ path: normalizedPath, addedAt, lastOpenedAt, ...(identity ? { identity } : {}) })
  }

  projects.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))

  return {
    schemaVersion: CURRENT_PROJECT_INDEX_SCHEMA_VERSION,
    projects,
    hiddenProjectPaths: normalizeHiddenProjectPaths(value.hiddenProjectPaths),
  }
}

function normalizeHiddenProjectPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .map((item) => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean))]
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.tmp.${Date.now()}`
  await fs.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
  await fs.rename(tmpPath, filePath)
}

function projectNameForPath(realPath: string): string {
  const displayRoot = realPath.includes(DESKTOP_WORKTREE_MARKER)
    ? realPath.slice(0, realPath.indexOf(DESKTOP_WORKTREE_MARKER))
    : realPath
  return displayRoot.split(path.sep).filter(Boolean).pop() || realPath
}

function repoNameFromRemote(remote: string | null): string | null {
  if (!remote) return null
  const match = remote.match(/:([^/]+\/[^/]+?)(?:\.git)?$/) || remote.match(/\/([^/]+\/[^/]+?)(?:\.git)?$/)
  return match ? match[1]! : null
}

function redactRemoteUrl(remote: string | null): string | null {
  if (!remote) return null
  try {
    const parsed = new URL(remote)
    parsed.username = ''
    parsed.password = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return remote.replace(/^(https?:\/\/)[^/@]+@/i, '$1')
  }
}

async function runGit(realPath: string, args: string[]): Promise<string | null> {
  try {
    const proc = Bun.spawn(['git', ...args], {
      cwd: realPath,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    void stderr
    if (exitCode !== 0) return null
    return stdout.trim() || null
  } catch {
    return null
  }
}

function makeProjectIdentity(realPath: string, git: ProjectGitIdentity): ProjectIdentity {
  const key = JSON.stringify({
    canonicalPath: realPath,
    git: {
      repoRoot: git.repoRoot,
      remoteUrl: git.remoteUrl,
    },
  })
  const id = `prj_${createHash('sha256').update(key).digest('hex').slice(0, 16)}`
  return {
    schemaVersion: 1,
    id,
    key,
    canonicalPath: realPath,
    git,
  }
}

function getProjectHiddenKey(projectPath: string): string {
  return sanitizePath(projectPath)
}

function getSavedProjectMatchKeys(project: SavedProject): string[] {
  const paths = [
    project.path,
    project.identity?.canonicalPath,
  ].filter((value): value is string => Boolean(value))

  return [...new Set(paths.flatMap((projectPath) => [
    projectPath,
    path.resolve(projectPath),
    getProjectHiddenKey(projectPath),
  ]))]
}

async function getRemovalCandidates(inputPath: string): Promise<Set<string>> {
  const trimmed = inputPath.trim()
  const candidates = new Set<string>([trimmed])
  const resolvedPath = path.resolve(trimmed)
  candidates.add(resolvedPath)
  candidates.add(getProjectHiddenKey(trimmed))
  candidates.add(getProjectHiddenKey(resolvedPath))

  const realPath = await fs.realpath(resolvedPath).catch(() => null)
  if (realPath) {
    candidates.add(realPath)
    candidates.add(getProjectHiddenKey(realPath))
  }

  return candidates
}

async function pathExistsAsDirectory(realPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(realPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

export async function describeProjectPath(
  realPath: string,
  options?: {
    projectPath?: string
    modifiedAt?: string
    sessionCount?: number
    saved?: boolean
  },
): Promise<ProjectEntry> {
  const projectPath = options?.projectPath ?? sanitizePath(realPath)
  let isGit = false
  let repoName: string | null = null
  let branch: string | null = null
  let repoRoot: string | null = null
  let remoteUrl: string | null = null

  const insideWorkTree = await runGit(realPath, ['rev-parse', '--is-inside-work-tree'])
  isGit = insideWorkTree === 'true'

  if (isGit) {
    const [repoRootResult, branchResult, remoteResult] = await Promise.all([
      runGit(realPath, ['rev-parse', '--show-toplevel']),
      runGit(realPath, ['rev-parse', '--abbrev-ref', 'HEAD']),
      runGit(realPath, ['remote', 'get-url', 'origin']),
    ])

    repoRoot = findCanonicalGitRoot(realPath)
      ?? (repoRootResult ? await fs.realpath(repoRootResult).catch(() => path.resolve(repoRootResult)) : null)
    remoteUrl = redactRemoteUrl(remoteResult)
    branch = branchResult && branchResult.startsWith('worktree-desktop-') ? null : branchResult
    repoName = repoNameFromRemote(remoteUrl)
  }

  const identity = makeProjectIdentity(realPath, {
    isGit,
    repoRoot,
    remoteUrl,
    repoName,
    branch,
  })

  return {
    projectPath,
    realPath,
    projectName: projectNameForPath(realPath),
    isGit,
    repoName,
    branch,
    identity,
    modifiedAt: options?.modifiedAt ?? new Date().toISOString(),
    sessionCount: options?.sessionCount ?? 0,
    saved: options?.saved ?? false,
  }
}

export class ProjectService {
  private getConfigDir(): string {
    return getCchahatuiProjectConfigDir()
  }

  private getManagedConfigDir(): string {
    return getCchahatuiManagedConfigDir(this.getConfigDir())
  }

  private getIndexPath(): string {
    return path.join(this.getManagedConfigDir(), 'projects.json')
  }

  private async readIndex(): Promise<ProjectIndex> {
    await ensureCchahatuiManagedConfigDirMigrated(this.getConfigDir()).catch(() => {})
    return await readRecoverableJsonFile({
      filePath: this.getIndexPath(),
      label: 'projects index',
      defaultValue: DEFAULT_INDEX,
      normalize: normalizeProjectIndex,
    })
  }

  private async writeIndex(index: ProjectIndex): Promise<void> {
    await ensureCchahatuiManagedConfigDirMigrated(this.getConfigDir()).catch(() => {})
    await writeJsonFile(this.getIndexPath(), {
      schemaVersion: CURRENT_PROJECT_INDEX_SCHEMA_VERSION,
      projects: index.projects,
      hiddenProjectPaths: index.hiddenProjectPaths,
    })
  }

  async getHiddenProjectPaths(): Promise<Set<string>> {
    const index = await this.readIndex()
    return new Set(index.hiddenProjectPaths)
  }

  async isProjectHidden(projectPath: string): Promise<boolean> {
    const hidden = await this.getHiddenProjectPaths()
    return hidden.has(projectPath) || hidden.has(getProjectHiddenKey(projectPath))
  }

  async listProjects(): Promise<ProjectEntry[]> {
    const index = await this.readIndex()
    const hidden = new Set(index.hiddenProjectPaths)
    const existing = index.projects.filter((project) =>
      project.path &&
      project.lastOpenedAt &&
      !getSavedProjectMatchKeys(project).some((key) => hidden.has(key))
    )
    const projects = await Promise.all(
      existing.map(async (project) => {
        if (!(await pathExistsAsDirectory(project.path))) return null
        return await describeProjectPath(project.path, {
          modifiedAt: project.lastOpenedAt,
          sessionCount: 0,
          saved: true,
        })
      }),
    )
    return projects.filter((project): project is ProjectEntry => project !== null)
  }

  async addProject(inputPath: string): Promise<ProjectEntry> {
    const trimmed = inputPath.trim()
    if (!trimmed) {
      throw ApiError.badRequest('path is required')
    }

    const resolvedPath = path.resolve(trimmed)
    let realPath = resolvedPath
    try {
      realPath = await fs.realpath(resolvedPath)
    } catch {
      // fs.stat below returns the clearer API error.
    }

    if (!(await pathExistsAsDirectory(realPath))) {
      throw ApiError.badRequest('Project path must be an existing directory')
    }

    const index = await this.readIndex()
    const existing = index.projects.find((project) => project.path === realPath)
    const now = new Date().toISOString()
    const entry = await describeProjectPath(realPath, {
      modifiedAt: now,
      sessionCount: 0,
      saved: true,
    })
    const hiddenProjectPaths = index.hiddenProjectPaths.filter((hiddenPath) =>
      hiddenPath !== entry.projectPath &&
      hiddenPath !== getProjectHiddenKey(realPath) &&
      hiddenPath !== getProjectHiddenKey(resolvedPath)
    )
    const projects = existing
      ? index.projects.map((project) =>
        project.path === realPath ? { ...project, identity: entry.identity, lastOpenedAt: now } : project,
      )
      : [{ path: realPath, identity: entry.identity, addedAt: now, lastOpenedAt: now }, ...index.projects]

    projects.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))
    await this.writeIndex({
      schemaVersion: CURRENT_PROJECT_INDEX_SCHEMA_VERSION,
      projects,
      hiddenProjectPaths,
    })

    return entry
  }

  async removeProject(inputPath: string): Promise<{ removed: boolean; hidden: boolean }> {
    const trimmed = inputPath.trim()
    if (!trimmed) {
      throw ApiError.badRequest('path is required')
    }

    const index = await this.readIndex()
    const candidates = await getRemovalCandidates(trimmed)
    const removedProjects: SavedProject[] = []
    const projects = index.projects.filter((project) => {
      const matched = getSavedProjectMatchKeys(project).some((key) => candidates.has(key))
      if (matched) removedProjects.push(project)
      return !matched
    })
    const hiddenCandidates = new Set(index.hiddenProjectPaths)
    for (const candidate of candidates) {
      if (!path.isAbsolute(candidate)) hiddenCandidates.add(candidate)
    }
    for (const project of removedProjects) {
      hiddenCandidates.add(getProjectHiddenKey(project.path))
      if (project.identity?.canonicalPath) {
        hiddenCandidates.add(getProjectHiddenKey(project.identity.canonicalPath))
      }
    }
    const hiddenProjectPaths = [...hiddenCandidates]
      .map((projectPath) => projectPath.trim())
      .filter(Boolean)
      .sort()
    const previousHiddenProjectPaths = new Set(index.hiddenProjectPaths)
    const hidden = hiddenProjectPaths.length !== index.hiddenProjectPaths.length
      || hiddenProjectPaths.some((projectPath) => !previousHiddenProjectPaths.has(projectPath))

    await this.writeIndex({
      schemaVersion: CURRENT_PROJECT_INDEX_SCHEMA_VERSION,
      projects,
      hiddenProjectPaths,
    })
    return {
      removed: projects.length !== index.projects.length,
      hidden,
    }
  }
}

export const projectService = new ProjectService()
