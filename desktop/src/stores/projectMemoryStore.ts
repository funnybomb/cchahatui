import { create } from 'zustand'

export const PROJECT_MEMORY_STORAGE_KEY = 'cc-haha-project-memory'
export const PROJECT_MEMORY_STORAGE_VERSION = 1

export type ProjectMemoryEntry = {
  projectPath: string
  summary: string
  updatedAt: string
}

type ProjectMemoryPersistence = {
  version: typeof PROJECT_MEMORY_STORAGE_VERSION
  projects: Record<string, ProjectMemoryEntry>
}

type ProjectMemoryStore = {
  memories: Record<string, ProjectMemoryEntry>
  getMemory: (projectPath: string | null | undefined) => ProjectMemoryEntry | null
  setMemory: (projectPath: string, summary: string) => void
  clearMemory: (projectPath: string) => void
}

function normalizeProjectPath(projectPath: string | null | undefined): string {
  return (projectPath ?? '').trim()
}

function getDefaultMemory(projectPath: string, summary: string, updatedAt?: string): ProjectMemoryEntry {
  return {
    projectPath,
    summary,
    updatedAt: updatedAt || new Date().toISOString(),
  }
}

export function normalizeProjectMemoryPersistence(value: unknown): ProjectMemoryPersistence {
  if (!value || typeof value !== 'object') {
    return { version: PROJECT_MEMORY_STORAGE_VERSION, projects: {} }
  }

  if (Array.isArray(value)) {
    const projects: Record<string, ProjectMemoryEntry> = {}
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const record = item as Record<string, unknown>
      const projectPath = normalizeProjectPath(
        typeof record.projectPath === 'string' ? record.projectPath : '',
      )
      const summary = typeof record.summary === 'string' ? record.summary.trim() : ''
      if (!projectPath || !summary) continue
      projects[projectPath] = getDefaultMemory(
        projectPath,
        summary,
        typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
      )
    }
    return { version: PROJECT_MEMORY_STORAGE_VERSION, projects }
  }

  const record = value as Record<string, unknown>
  const rawProjects = record.projects && typeof record.projects === 'object' && !Array.isArray(record.projects)
    ? record.projects as Record<string, unknown>
    : record
  const projects: Record<string, ProjectMemoryEntry> = {}

  for (const [key, rawEntry] of Object.entries(rawProjects)) {
    const projectPath = normalizeProjectPath(key)
    if (!projectPath) continue

    if (typeof rawEntry === 'string') {
      const summary = rawEntry.trim()
      if (summary) projects[projectPath] = getDefaultMemory(projectPath, summary)
      continue
    }

    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue
    const entry = rawEntry as Record<string, unknown>
    const entryProjectPath = normalizeProjectPath(
      typeof entry.projectPath === 'string' ? entry.projectPath : '',
    ) || projectPath
    const summary = typeof entry.summary === 'string' ? entry.summary.trim() : ''
    if (!summary) continue
    projects[entryProjectPath] = getDefaultMemory(
      entryProjectPath,
      summary,
      typeof entry.updatedAt === 'string' ? entry.updatedAt : undefined,
    )
  }

  return { version: PROJECT_MEMORY_STORAGE_VERSION, projects }
}

function readMemories(): Record<string, ProjectMemoryEntry> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(PROJECT_MEMORY_STORAGE_KEY)
    if (!raw) return {}
    return normalizeProjectMemoryPersistence(JSON.parse(raw)).projects
  } catch {
    return {}
  }
}

function writeMemories(memories: Record<string, ProjectMemoryEntry>): void {
  if (typeof localStorage === 'undefined') return
  try {
    const payload: ProjectMemoryPersistence = {
      version: PROJECT_MEMORY_STORAGE_VERSION,
      projects: memories,
    }
    localStorage.setItem(PROJECT_MEMORY_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

export function formatProjectMemoryPrompt(projectName: string, summary: string): string {
  const normalized = summary.trim()
  if (!normalized) return ''
  return [
    '<project-memory>',
    `Project: ${projectName}`,
    'Use the following persistent project memory as context for this conversation. Do not quote it unless it is directly useful.',
    normalized,
    '</project-memory>',
  ].join('\n')
}

export const useProjectMemoryStore = create<ProjectMemoryStore>((set, get) => ({
  memories: readMemories(),

  getMemory: (projectPath) => {
    const key = normalizeProjectPath(projectPath)
    if (!key) return null
    return get().memories[key] ?? null
  },

  setMemory: (projectPath, summary) => {
    const key = normalizeProjectPath(projectPath)
    if (!key) return
    const trimmed = summary.trim()
    set((state) => {
      const memories = { ...state.memories }
      if (trimmed) {
        memories[key] = getDefaultMemory(key, trimmed)
      } else {
        delete memories[key]
      }
      writeMemories(memories)
      return { memories }
    })
  },

  clearMemory: (projectPath) => {
    const key = normalizeProjectPath(projectPath)
    if (!key) return
    set((state) => {
      const memories = { ...state.memories }
      delete memories[key]
      writeMemories(memories)
      return { memories }
    })
  },
}))
