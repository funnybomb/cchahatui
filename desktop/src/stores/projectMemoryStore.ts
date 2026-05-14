import { create } from 'zustand'

export const PROJECT_MEMORY_STORAGE_KEY = 'cc-haha-project-memory'
export const PROJECT_MEMORY_STORAGE_VERSION = 3

export type ProjectMemorySections = {
  facts: string[]
  decisions: string[]
  openTasks: string[]
}

export type ProjectMemoryEntry = {
  projectPath: string
  summary: string
  sections: ProjectMemorySections
  includeInContext: boolean
  updatedAt: string
  source: 'manual'
}

export type ProjectMemorySanitizationResult = {
  summary: string
  sections: ProjectMemorySections
  blockedCount: number
  blockedReasons: string[]
}

type ProjectMemoryPersistence = {
  version: typeof PROJECT_MEMORY_STORAGE_VERSION
  projects: Record<string, ProjectMemoryEntry>
}

type ProjectMemoryStore = {
  memories: Record<string, ProjectMemoryEntry>
  getMemory: (projectPath: string | null | undefined) => ProjectMemoryEntry | null
  setMemory: (
    projectPath: string,
    summary: string,
    sections?: Partial<ProjectMemorySections>,
    includeInContext?: boolean,
  ) => void
  setMemoryContextEnabled: (projectPath: string, includeInContext: boolean) => void
  clearMemory: (projectPath: string) => void
}

function normalizeProjectPath(projectPath: string | null | undefined): string {
  return (projectPath ?? '').trim()
}

const EMPTY_SECTIONS: ProjectMemorySections = {
  facts: [],
  decisions: [],
  openTasks: [],
}

const RESTRICTED_MEMORY_PATTERNS: Array<{ reason: string; pattern: RegExp }> = [
  { reason: 'secret', pattern: /\b(api[-_\s]?key|secret|password|bearer\s+token|access[-_\s]?token|refresh[-_\s]?token|client[-_\s]?secret)\b/i },
  { reason: 'secret', pattern: /\b(sk-[A-Za-z0-9_-]{12,}|xox[baprs]-[A-Za-z0-9-]+|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+|AKIA[0-9A-Z]{16})\b/ },
  { reason: 'oauth', pattern: /\boauth\b/i },
  { reason: 'private-key', pattern: /BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY/i },
  { reason: 'private-path', pattern: /(^|\s)(\/Users\/[^\s]+|\/home\/[^\s]+|[A-Za-z]:\\Users\\[^\s]+)/i },
  { reason: 'chat-raw', pattern: /\b(chat transcript|raw chat|jsonl transcript|聊天原文|会话原文|原始对话)\b/i },
  { reason: 'chat-raw', pattern: /"(role|content|timestamp|uuid)"\s*:/ },
  { reason: 'temporary', pattern: /\b(scratch|temporary thought|temp thought|failed attempt|failure attempt)\b/i },
  { reason: 'temporary', pattern: /(临时思路|临时想法|失败尝试)/ },
]

function normalizeLines(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .map((item) => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean))]
}

function normalizeSections(value: unknown): ProjectMemorySections {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_SECTIONS }
  const record = value as Record<string, unknown>
  return {
    facts: normalizeLines(record.facts),
    decisions: normalizeLines(record.decisions),
    openTasks: normalizeLines(record.openTasks),
  }
}

function getRestrictedMemoryReason(line: string): string | null {
  for (const { reason, pattern } of RESTRICTED_MEMORY_PATTERNS) {
    if (pattern.test(line)) return reason
  }
  return null
}

function sanitizeMemoryLines(lines: string[]) {
  const kept: string[] = []
  const blockedReasons: string[] = []
  let blockedCount = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const reason = getRestrictedMemoryReason(trimmed)
    if (reason) {
      blockedCount += 1
      blockedReasons.push(reason)
      continue
    }
    kept.push(trimmed)
  }

  return {
    lines: [...new Set(kept)],
    blockedCount,
    blockedReasons,
  }
}

export function sanitizeProjectMemoryDraft(
  summary: string,
  sections: Partial<ProjectMemorySections> = {},
): ProjectMemorySanitizationResult {
  const summaryResult = sanitizeMemoryLines(summary.split('\n'))
  const factsResult = sanitizeMemoryLines(normalizeLines(sections.facts ?? []))
  const decisionsResult = sanitizeMemoryLines(normalizeLines(sections.decisions ?? []))
  const openTasksResult = sanitizeMemoryLines(normalizeLines(sections.openTasks ?? []))

  return {
    summary: summaryResult.lines.join('\n'),
    sections: {
      facts: factsResult.lines,
      decisions: decisionsResult.lines,
      openTasks: openTasksResult.lines,
    },
    blockedCount: summaryResult.blockedCount + factsResult.blockedCount + decisionsResult.blockedCount + openTasksResult.blockedCount,
    blockedReasons: [...new Set([
      ...summaryResult.blockedReasons,
      ...factsResult.blockedReasons,
      ...decisionsResult.blockedReasons,
      ...openTasksResult.blockedReasons,
    ])],
  }
}

function getSafeDefaultMemory(
  projectPath: string,
  summary: string,
  sections: Partial<ProjectMemorySections> = {},
  updatedAt?: string,
  includeInContext = true,
): ProjectMemoryEntry | null {
  const sanitized = sanitizeProjectMemoryDraft(summary, sections)
  if (!hasReusableMemory(sanitized.summary, sanitized.sections)) return null
  return getDefaultMemory(projectPath, sanitized.summary, sanitized.sections, updatedAt, includeInContext)
}

function hasReusableMemory(summary: string, sections: ProjectMemorySections) {
  return Boolean(
    summary.trim() ||
    sections.facts.length > 0 ||
    sections.decisions.length > 0 ||
    sections.openTasks.length > 0
  )
}

export function hasProjectMemory(entry: ProjectMemoryEntry | null | undefined): entry is ProjectMemoryEntry {
  return entry ? hasReusableMemory(entry.summary, entry.sections) : false
}

function getDefaultMemory(
  projectPath: string,
  summary: string,
  sections: Partial<ProjectMemorySections> = {},
  updatedAt?: string,
  includeInContext = true,
): ProjectMemoryEntry {
  const normalizedSections: ProjectMemorySections = {
    facts: normalizeLines(sections.facts ?? []),
    decisions: normalizeLines(sections.decisions ?? []),
    openTasks: normalizeLines(sections.openTasks ?? []),
  }
  return {
    projectPath,
    summary: summary.trim(),
    sections: normalizedSections,
    includeInContext,
    updatedAt: updatedAt || new Date().toISOString(),
    source: 'manual',
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
      const sections = normalizeSections(record.sections)
      if (!projectPath) continue
      const memory = getSafeDefaultMemory(
        projectPath,
        summary,
        sections,
        typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
        record.includeInContext !== false,
      )
      if (!memory) continue
      projects[projectPath] = memory
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
      const memory = getSafeDefaultMemory(projectPath, summary)
      if (memory) projects[projectPath] = memory
      continue
    }

    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue
    const entry = rawEntry as Record<string, unknown>
    const entryProjectPath = normalizeProjectPath(
      typeof entry.projectPath === 'string' ? entry.projectPath : '',
    ) || projectPath
    const summary = typeof entry.summary === 'string' ? entry.summary.trim() : ''
    const sections = normalizeSections(entry.sections)
    const memory = getSafeDefaultMemory(
      entryProjectPath,
      summary,
      sections,
      typeof entry.updatedAt === 'string' ? entry.updatedAt : undefined,
      entry.includeInContext !== false,
    )
    if (!memory) continue
    projects[entryProjectPath] = memory
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

function formatSection(title: string, lines: string[]) {
  if (lines.length === 0) return ''
  return [title, ...lines.map((line) => `- ${line}`)].join('\n')
}

export function formatProjectMemoryPrompt(projectName: string, memory: ProjectMemoryEntry | string): string {
  const entry = typeof memory === 'string'
    ? getDefaultMemory(projectName, memory)
    : memory
  if (entry.includeInContext === false) return ''
  const sanitized = sanitizeProjectMemoryDraft(entry.summary, entry.sections)
  if (!hasReusableMemory(sanitized.summary, sanitized.sections)) return ''
  const normalized = sanitized.summary.trim()
  const body = [
    normalized ? `Summary:\n${normalized}` : '',
    formatSection('Facts:', sanitized.sections.facts),
    formatSection('Decisions:', sanitized.sections.decisions),
    formatSection('Open tasks:', sanitized.sections.openTasks),
  ].filter(Boolean).join('\n\n')

  return [
    `<project-memory updated-at="${entry.updatedAt}">`,
    `Project: ${projectName}`,
    'Use the following persistent project memory as context for this conversation. Do not quote it unless it is directly useful.',
    'If project memory conflicts with newer user instructions in this chat, follow the newer user instruction. Otherwise, the latest manually saved project memory wins.',
    body,
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

  setMemory: (projectPath, summary, sections = {}, includeInContext = true) => {
    const key = normalizeProjectPath(projectPath)
    if (!key) return
    const sanitized = sanitizeProjectMemoryDraft(summary, sections)
    set((state) => {
      const memories = { ...state.memories }
      if (hasReusableMemory(sanitized.summary, sanitized.sections)) {
        memories[key] = getDefaultMemory(key, sanitized.summary, sanitized.sections, undefined, includeInContext)
      } else {
        delete memories[key]
      }
      writeMemories(memories)
      return { memories }
    })
  },

  setMemoryContextEnabled: (projectPath, includeInContext) => {
    const key = normalizeProjectPath(projectPath)
    if (!key) return
    set((state) => {
      const current = state.memories[key]
      if (!current) return state
      const memories = {
        ...state.memories,
        [key]: {
          ...current,
          includeInContext,
          updatedAt: new Date().toISOString(),
        },
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
