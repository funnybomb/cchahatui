import { beforeEach, describe, expect, it } from 'vitest'
import {
  PROJECT_MEMORY_STORAGE_KEY,
  formatProjectMemoryPrompt,
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
    })
    expect(normalized.projects['/workspace/empty']).toBeUndefined()
  })

  it('persists, reads, and clears project memory by project path', () => {
    useProjectMemoryStore.getState().setMemory('/workspace/app', 'Prefer desktop smoke tests.')

    expect(useProjectMemoryStore.getState().getMemory('/workspace/app')).toMatchObject({
      projectPath: '/workspace/app',
      summary: 'Prefer desktop smoke tests.',
    })
    expect(JSON.parse(window.localStorage.getItem(PROJECT_MEMORY_STORAGE_KEY) || '{}')).toMatchObject({
      version: 1,
      projects: {
        '/workspace/app': {
          projectPath: '/workspace/app',
          summary: 'Prefer desktop smoke tests.',
        },
      },
    })

    useProjectMemoryStore.getState().clearMemory('/workspace/app')

    expect(useProjectMemoryStore.getState().getMemory('/workspace/app')).toBeNull()
    expect(JSON.parse(window.localStorage.getItem(PROJECT_MEMORY_STORAGE_KEY) || '{}')).toEqual({
      version: 1,
      projects: {},
    })
  })

  it('formats memory as model-only project context', () => {
    expect(formatProjectMemoryPrompt('app', 'Prefer DeepSeek V4.')).toContain('<project-memory>')
    expect(formatProjectMemoryPrompt('app', 'Prefer DeepSeek V4.')).toContain('Prefer DeepSeek V4.')
    expect(formatProjectMemoryPrompt('app', '')).toBe('')
  })
})
