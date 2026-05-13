import { create } from 'zustand'

export const PROJECT_NAVIGATION_STORAGE_KEY = 'cc-haha-project-navigation'
export const PROJECT_NAVIGATION_STORAGE_VERSION = 1

type ProjectNavigationPersistence = {
  version: typeof PROJECT_NAVIGATION_STORAGE_VERSION
  pinnedProjectPaths: string[]
}

type ProjectNavigationStore = {
  pinnedProjectPaths: string[]
  isPinned: (projectPath: string | null | undefined) => boolean
  pinProject: (projectPath: string) => void
  unpinProject: (projectPath: string) => void
  togglePinned: (projectPath: string) => void
}

function normalizeProjectPath(projectPath: string | null | undefined) {
  return (projectPath ?? '').trim()
}

export function normalizeProjectNavigationPersistence(value: unknown): ProjectNavigationPersistence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { version: PROJECT_NAVIGATION_STORAGE_VERSION, pinnedProjectPaths: [] }
  }

  const record = value as Record<string, unknown>
  const rawPinned = Array.isArray(record.pinnedProjectPaths)
    ? record.pinnedProjectPaths
    : Array.isArray(record.pinnedProjects)
      ? record.pinnedProjects
      : []

  return {
    version: PROJECT_NAVIGATION_STORAGE_VERSION,
    pinnedProjectPaths: [...new Set(rawPinned
      .map((item) => typeof item === 'string' ? normalizeProjectPath(item) : '')
      .filter(Boolean))],
  }
}

function readPinnedProjectPaths() {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(PROJECT_NAVIGATION_STORAGE_KEY)
    if (!raw) return []
    return normalizeProjectNavigationPersistence(JSON.parse(raw)).pinnedProjectPaths
  } catch {
    return []
  }
}

function writePinnedProjectPaths(pinnedProjectPaths: string[]) {
  if (typeof localStorage === 'undefined') return
  try {
    const payload: ProjectNavigationPersistence = {
      version: PROJECT_NAVIGATION_STORAGE_VERSION,
      pinnedProjectPaths,
    }
    localStorage.setItem(PROJECT_NAVIGATION_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export const useProjectNavigationStore = create<ProjectNavigationStore>((set, get) => ({
  pinnedProjectPaths: readPinnedProjectPaths(),

  isPinned: (projectPath) => {
    const key = normalizeProjectPath(projectPath)
    return Boolean(key && get().pinnedProjectPaths.includes(key))
  },

  pinProject: (projectPath) => {
    const key = normalizeProjectPath(projectPath)
    if (!key) return
    set((state) => {
      if (state.pinnedProjectPaths.includes(key)) return state
      const pinnedProjectPaths = [...state.pinnedProjectPaths, key]
      writePinnedProjectPaths(pinnedProjectPaths)
      return { pinnedProjectPaths }
    })
  },

  unpinProject: (projectPath) => {
    const key = normalizeProjectPath(projectPath)
    if (!key) return
    set((state) => {
      const pinnedProjectPaths = state.pinnedProjectPaths.filter((path) => path !== key)
      writePinnedProjectPaths(pinnedProjectPaths)
      return { pinnedProjectPaths }
    })
  },

  togglePinned: (projectPath) => {
    if (get().isPinned(projectPath)) {
      get().unpinProject(projectPath)
    } else {
      get().pinProject(projectPath)
    }
  },
}))
