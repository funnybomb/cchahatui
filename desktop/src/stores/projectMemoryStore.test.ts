import { beforeEach, describe, expect, it } from 'vitest'
import {
  PROJECT_MEMORY_STORAGE_KEY,
  formatProjectMemoryPrompt,
  hasProjectMemory,
  normalizeProjectMemoryPersistence,
  sanitizeProjectMemoryDraft,
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

  it('skips API keys, OAuth material, and private paths before persistence', () => {
    useProjectMemoryStore.getState().setMemory('/workspace/app', [
      'Use Bun for desktop work.',
      'API key: sk-testsecretvalue12345',
      'OAuth refresh token lives in provider settings.',
      'Private path: /Users/person/private/project',
    ].join('\n'))

    const memory = useProjectMemoryStore.getState().getMemory('/workspace/app')
    expect(memory?.summary).toBe('Use Bun for desktop work.')
    expect(memory?.summary).not.toContain('sk-test')
    expect(memory?.summary).not.toContain('OAuth')
    expect(memory?.summary).not.toContain('/Users/person')
  })

  it('skips temporary thoughts, failed attempts, and raw chat transcript lines', () => {
    const sanitized = sanitizeProjectMemoryDraft('Keep release notes aligned.', {
      facts: [
        'Use Bun.',
        '临时思路: maybe rewrite this later',
        'failed attempt: bad endpoint',
        '{"role":"user","content":"raw chat"}',
      ],
    })

    expect(sanitized.blockedCount).toBe(3)
    expect(sanitized.sections.facts).toEqual(['Use Bun.'])
    expect(sanitized.blockedReasons).toEqual(expect.arrayContaining(['temporary', 'chat-raw']))
  })

  it('preserves allowed project facts while removing restricted section lines', () => {
    useProjectMemoryStore.getState().setMemory('/workspace/app', 'Prefer stable patch releases.', {
      facts: ['Use Bun.', 'client_secret=do-not-store'],
      decisions: ['Keep project records isolated.'],
      openTasks: ['Run verify.', 'chat transcript pasted below'],
    })

    const memory = useProjectMemoryStore.getState().getMemory('/workspace/app')
    expect(memory?.summary).toBe('Prefer stable patch releases.')
    expect(memory?.sections.facts).toEqual(['Use Bun.'])
    expect(memory?.sections.decisions).toEqual(['Keep project records isolated.'])
    expect(memory?.sections.openTasks).toEqual(['Run verify.'])
  })

  it('sanitizes restricted content from legacy persisted memory during normalization', () => {
    const normalized = normalizeProjectMemoryPersistence({
      projects: {
        '/workspace/app': {
          projectPath: '/workspace/app',
          summary: [
            'Keep project memory concise.',
            'API key: sk-legacysecretvalue12345',
            'Private path: /Users/person/secret-project',
          ].join('\n'),
          sections: {
            facts: ['Use Bun.', 'OAuth access token lives nearby.'],
            decisions: ['Keep memory scoped.', '{"role":"user","content":"raw"}'],
            openTasks: ['Run verify.', '失败尝试: copied transcript'],
          },
          includeInContext: true,
          updatedAt: '2026-05-14T00:00:00.000Z',
        },
      },
    })

    expect(normalized.projects['/workspace/app']).toMatchObject({
      summary: 'Keep project memory concise.',
      sections: {
        facts: ['Use Bun.'],
        decisions: ['Keep memory scoped.'],
        openTasks: ['Run verify.'],
      },
    })
  })

  it('sanitizes restricted loaded memory before formatting model context', () => {
    const prompt = formatProjectMemoryPrompt('app', {
      projectPath: '/workspace/app',
      summary: [
        'Use project-scoped memory only.',
        'API key: sk-loadedsecretvalue12345',
        'Private path: /Users/person/private',
      ].join('\n'),
      sections: {
        facts: ['Use Bun.', 'OAuth refresh token exists.'],
        decisions: ['Keep UI quiet.', 'chat transcript pasted below'],
        openTasks: ['Run verify.', '{"role":"assistant","content":"raw"}'],
      },
      includeInContext: true,
      updatedAt: '2026-05-14T00:00:00.000Z',
      source: 'manual',
    })

    expect(prompt).toContain('Use project-scoped memory only.')
    expect(prompt).toContain('- Use Bun.')
    expect(prompt).toContain('- Keep UI quiet.')
    expect(prompt).toContain('- Run verify.')
    expect(prompt).not.toContain('sk-loaded')
    expect(prompt).not.toContain('OAuth')
    expect(prompt).not.toContain('/Users/person')
    expect(prompt).not.toContain('"role"')
    expect(prompt).not.toContain('chat transcript')
  })
})
