import { beforeEach, describe, expect, it } from 'vitest'
import {
  PROJECT_MEMORY_STORAGE_KEY,
  formatProjectMemoryPrompt,
  hasProjectMemory,
  normalizeProjectMemoryPersistence,
  useProjectMemoryStore,
} from './projectMemoryStore'

describe('projectMemoryStore', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useProjectMemoryStore.setState({ memories: {} })
  })

  it('normalizes legacy string memory records into versioned project entries', () => {
    const normalized = normalizeProjectMemoryPersistence({
      '/workspace/app': 'Use pnpm for this project.',
      '/workspace/empty': '',
    })

    expect(normalized.projects['/workspace/app']).toMatchObject({
      projectPath: '/workspace/app',
      summary: 'Use pnpm for this project.',
      sections: {
        facts: [],
        decisions: [],
        openTasks: [],
      },
      includeInContext: true,
    })
    expect(normalized.projects['/workspace/empty']).toBeUndefined()
  })

  it('persists, reads, and clears structured project memory by project path', () => {
    useProjectMemoryStore.getState().setMemory('/workspace/app', 'Prefer desktop smoke tests.', {
      facts: ['Use Bun.', 'Use Bun.', ''],
      decisions: ['Ship narrow slices.'],
      openTasks: ['Run desktop smoke.'],
    })

    expect(useProjectMemoryStore.getState().getMemory('/workspace/app')).toMatchObject({
      projectPath: '/workspace/app',
      summary: 'Prefer desktop smoke tests.',
      sections: {
        facts: ['Use Bun.'],
        decisions: ['Ship narrow slices.'],
        openTasks: ['Run desktop smoke.'],
      },
      includeInContext: true,
    })
    expect(JSON.parse(window.localStorage.getItem(PROJECT_MEMORY_STORAGE_KEY) || '{}')).toMatchObject({
      version: 3,
      projects: {
        '/workspace/app': {
          projectPath: '/workspace/app',
          summary: 'Prefer desktop smoke tests.',
          sections: {
            facts: ['Use Bun.'],
            decisions: ['Ship narrow slices.'],
            openTasks: ['Run desktop smoke.'],
          },
          includeInContext: true,
          source: 'manual',
        },
      },
    })

    useProjectMemoryStore.getState().clearMemory('/workspace/app')

    expect(useProjectMemoryStore.getState().getMemory('/workspace/app')).toBeNull()
    expect(JSON.parse(window.localStorage.getItem(PROJECT_MEMORY_STORAGE_KEY) || '{}')).toEqual({
      version: 3,
      projects: {},
    })
  })

  it('formats structured memory as model-only project context', () => {
    useProjectMemoryStore.getState().setMemory('/workspace/app', 'Prefer DeepSeek V4.', {
      facts: ['Use Bun.'],
      decisions: ['Keep UI quiet.'],
      openTasks: ['Run verify.'],
    })
    const memory = useProjectMemoryStore.getState().getMemory('/workspace/app')

    expect(hasProjectMemory(memory)).toBe(true)
    expect(formatProjectMemoryPrompt('app', memory!)).toContain('<project-memory')
    expect(formatProjectMemoryPrompt('app', memory!)).toContain('Prefer DeepSeek V4.')
    expect(formatProjectMemoryPrompt('app', memory!)).toContain('Facts:')
    expect(formatProjectMemoryPrompt('app', memory!)).toContain('- Use Bun.')
    expect(formatProjectMemoryPrompt('app', memory!)).toContain('Decisions:')
    expect(formatProjectMemoryPrompt('app', memory!)).toContain('Open tasks:')
    expect(formatProjectMemoryPrompt('app', memory!)).toContain('latest manually saved project memory wins')
    expect(formatProjectMemoryPrompt('app', 'Prefer DeepSeek V4.')).toContain('<project-memory')
    expect(formatProjectMemoryPrompt('app', 'Prefer DeepSeek V4.')).toContain('Prefer DeepSeek V4.')
    expect(formatProjectMemoryPrompt('app', '')).toBe('')
  })

  it('can exclude memory from model context without clearing the saved project memory', () => {
    useProjectMemoryStore.getState().setMemory('/workspace/app', '', {
      facts: ['Use pnpm.'],
    })
    useProjectMemoryStore.getState().setMemoryContextEnabled('/workspace/app', false)

    const memory = useProjectMemoryStore.getState().getMemory('/workspace/app')
    expect(hasProjectMemory(memory)).toBe(true)
    expect(memory?.includeInContext).toBe(false)
    expect(formatProjectMemoryPrompt('app', memory!)).toBe('')
  })
})
