import { describe, expect, it } from 'vitest'
import type { RecentProject } from './sessions'

describe('RecentProject API type', () => {
  it('carries additive project identity metadata from the server', () => {
    const project: RecentProject = {
      projectPath: '-workspace-project',
      realPath: '/workspace/project',
      projectName: 'project',
      isGit: true,
      repoName: 'acme/project',
      branch: 'main',
      identity: {
        schemaVersion: 1,
        id: 'prj_0123456789abcdef',
        key: '{"canonicalPath":"/workspace/project"}',
        canonicalPath: '/workspace/project',
        git: {
          isGit: true,
          repoRoot: '/workspace/project',
          remoteUrl: 'https://example.com/acme/project.git',
          repoName: 'acme/project',
          branch: 'main',
        },
      },
      modifiedAt: '2026-05-14T00:00:00.000Z',
      sessionCount: 1,
      saved: true,
    }

    expect(project.identity?.canonicalPath).toBe('/workspace/project')
    expect(project.identity?.git.remoteUrl).toBe('https://example.com/acme/project.git')
  })
})
