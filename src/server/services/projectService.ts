import * as fs from 'fs/promises'
import * as path from 'path'
import { ApiError } from '../middleware/errorHandler.js'
import { readRecoverableJsonFile } from './recoverableJsonFile.js'
import {
  ensureCchahatuiManagedConfigDirMigrated,
  getCchahatuiManagedConfigDir,
  getCchahatuiProjectConfigDir,
} from '../../utils/cchahatuiConfig.js'
import { sanitizePath } from '../../utils/sessionStoragePortable.js'

const CURRENT_PROJECT_INDEX_SCHEMA_VERSION = 1

type SavedProject = {
  path: string
  addedAt: string
  lastOpenedAt: string
}

type ProjectIndex = {
  schemaVersion: typeof CURRENT_PROJECT_INDEX_SCHEMA_VERSION
  projects: SavedProject[]
}

export type ProjectEntry = {
  projectPath: string
  realPath: string
  projectName: string
  isGit: boolean
  repoName: string | null
  branch: string | null
  modifiedAt: string
  sessionCount: number
  saved: boolean
}

const DEFAULT_INDEX: ProjectIndex = {
  schemaVersion: CURRENT_PROJECT_INDEX_SCHEMA_VERSION,
  projects: [],
}

const DESKTOP_WORKTREE_MARKER = '/.claude/worktrees/'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
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
    projects.push({ path: normalizedPath, addedAt, lastOpenedAt })
  }

  projects.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))

  return {
    schemaVersion: CURRENT_PROJECT_INDEX_SCHEMA_VERSION,
    projects,
  }
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

  try {
    const proc = Bun.spawn(['git', 'rev-parse', '--is-inside-work-tree'], {
      cwd: realPath,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const out = await new Response(proc.stdout).text()
    isGit = out.trim() === 'true'

    if (isGit) {
      const [branchResult, remoteResult] = await Promise.all([
        (async () => {
          const branchProc = Bun.spawn(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], {
            cwd: realPath,
            stdout: 'pipe',
            stderr: 'pipe',
          })
          return (await new Response(branchProc.stdout).text()).trim() || null
        })(),
        (async () => {
          try {
            const remoteProc = Bun.spawn(['git', 'remote', 'get-url', 'origin'], {
              cwd: realPath,
              stdout: 'pipe',
              stderr: 'pipe',
            })
            const remote = (await new Response(remoteProc.stdout).text()).trim()
            const match = remote.match(/:([^/]+\/[^/]+?)(?:\.git)?$/) || remote.match(/\/([^/]+\/[^/]+?)(?:\.git)?$/)
            return match ? match[1]! : null
          } catch {
            return null
          }
        })(),
      ])
      branch = branchResult && branchResult.startsWith('worktree-desktop-') ? null : branchResult
      repoName = remoteResult
    }
  } catch {
    // Non-git project directories are valid projects.
  }

  return {
    projectPath,
    realPath,
    projectName: projectNameForPath(realPath),
    isGit,
    repoName,
    branch,
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
    })
  }

  async listProjects(): Promise<ProjectEntry[]> {
    const index = await this.readIndex()
    const existing = index.projects.filter((project) => project.path && project.lastOpenedAt)
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

    const now = new Date().toISOString()
    const index = await this.readIndex()
    const existing = index.projects.find((project) => project.path === realPath)
    const projects = existing
      ? index.projects.map((project) =>
        project.path === realPath ? { ...project, lastOpenedAt: now } : project,
      )
      : [{ path: realPath, addedAt: now, lastOpenedAt: now }, ...index.projects]

    projects.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt))
    await this.writeIndex({
      schemaVersion: CURRENT_PROJECT_INDEX_SCHEMA_VERSION,
      projects,
    })

    return await describeProjectPath(realPath, {
      modifiedAt: now,
      sessionCount: 0,
      saved: true,
    })
  }

  async removeProject(inputPath: string): Promise<boolean> {
    const trimmed = inputPath.trim()
    if (!trimmed) {
      throw ApiError.badRequest('path is required')
    }

    const resolvedPath = path.resolve(trimmed)
    const realPath = await fs.realpath(resolvedPath).catch(() => resolvedPath)
    const index = await this.readIndex()
    const projects = index.projects.filter((project) => project.path !== realPath)
    if (projects.length === index.projects.length) {
      return false
    }
    await this.writeIndex({
      schemaVersion: CURRENT_PROJECT_INDEX_SCHEMA_VERSION,
      projects,
    })
    return true
  }
}

export const projectService = new ProjectService()
