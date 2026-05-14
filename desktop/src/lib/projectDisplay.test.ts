import { describe, expect, it } from 'vitest'
import { getProjectDisplayName, getProjectDisplayPath } from './projectDisplay'

describe('project display names', () => {
  it('uses the basename for absolute POSIX, Windows, and worktree paths', () => {
    expect(getProjectDisplayName('/Users/person/work/projects/haha+tui')).toBe('haha+tui')
    expect(getProjectDisplayName('C:\\Users\\person\\work\\cc-haha')).toBe('cc-haha')
    expect(getProjectDisplayName('/repo/app/.codex/worktrees/detached/project')).toBe('app')
  })

  it('hides private path roots from sanitized project slugs', () => {
    expect(getProjectDisplayName('-Users-person-private-work-haha+tui')).toBe('haha+tui')
    expect(getProjectDisplayName('Users-person-workspace-myself_code-claude-code-haha')).toBe('haha')
  })

  it('keeps ordinary labels and URL-like labels readable', () => {
    expect(getProjectDisplayName('project-alpha')).toBe('project-alpha')
    expect(getProjectDisplayName('https://huggingface.co/org/model')).toBe('model')
  })

  it('redacts user home directories in display paths', () => {
    expect(getProjectDisplayPath('/Users/person/work/projects/haha+tui')).toBe('~/work/projects/haha+tui')
    expect(getProjectDisplayPath('/Users/person')).toBe('~')
    expect(getProjectDisplayPath('/home/person/work/project')).toBe('~/work/project')
    expect(getProjectDisplayPath('C:\\Users\\person\\work\\cc-haha')).toBe('~\\work\\cc-haha')
  })

  it('keeps shared paths readable and hides sanitized path slug roots', () => {
    expect(getProjectDisplayPath('/workspace/project-alpha')).toBe('/workspace/project-alpha')
    expect(getProjectDisplayPath('-Users-person-private-work-haha+tui')).toBe('haha+tui')
  })
})
