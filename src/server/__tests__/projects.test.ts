import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { handleProjectsApi } from '../api/projects.js'
import { handleSessionsApi } from '../api/sessions.js'
import { ProjectService } from '../services/projectService.js'
import { sanitizePath } from '../../utils/sessionStoragePortable.js'

let tmpDir: string
let originalConfigDir: string | undefined

async function setup() {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'projects-test-'))
  originalConfigDir = process.env.CLAUDE_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = tmpDir
}

async function teardown() {
  if (originalConfigDir !== undefined) {
    process.env.CLAUDE_CONFIG_DIR = originalConfigDir
  } else {
    delete process.env.CLAUDE_CONFIG_DIR
  }
  await fs.rm(tmpDir, { recursive: true, force: true })
}

function makeRequest(method: string, urlStr: string, body?: Record<string, unknown>) {
  const url = new URL(urlStr, 'http://localhost:3456')
  const init: RequestInit = { method }
  if (body) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const req = new Request(url.toString(), init)
  return { req, url, segments: url.pathname.split('/').filter(Boolean) }
}

async function run(command: string[], cwd: string): Promise<void> {
  const proc = Bun.spawn(command, {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(`Command failed: ${command.join(' ')}\n${stderr || stdout}`)
  }
}

async function writeSessionFile(workDir: string, sessionId: string) {
  const projectDir = sanitizePath(workDir)
  const sessionFile = path.join(tmpDir, 'projects', projectDir, `${sessionId}.jsonl`)
  await fs.mkdir(path.dirname(sessionFile), { recursive: true })
  await fs.writeFile(
    sessionFile,
    [
      JSON.stringify({
        type: 'session-meta',
        isMeta: true,
        workDir,
        timestamp: '2026-05-01T00:00:00.000Z',
      }),
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: 'Draft project plan' },
        timestamp: '2026-05-01T00:00:01.000Z',
      }),
      '',
    ].join('\n'),
    'utf-8',
  )
  return { projectDir, sessionFile }
}

describe('ProjectService', () => {
  beforeEach(setup)
  afterEach(teardown)

  test('adds and lists saved projects', async () => {
    const projectDir = path.join(tmpDir, 'workspace', 'alpha')
    await fs.mkdir(projectDir, { recursive: true })
    const realProjectDir = await fs.realpath(projectDir)

    const service = new ProjectService()
    const added = await service.addProject(projectDir)
    await service.addProject(projectDir)
    const projects = await service.listProjects()

    expect(added.realPath).toBe(realProjectDir)
    expect(added.projectName).toBe('alpha')
    expect(added.saved).toBe(true)
    expect(projects).toHaveLength(1)
    expect(projects[0].realPath).toBe(realProjectDir)
  })

  test('deduplicates symlinked paths by canonical real path and emits stable identity', async () => {
    const projectDir = path.join(tmpDir, 'workspace', 'identity-alpha')
    const linkDir = path.join(tmpDir, 'workspace', 'identity-alpha-link')
    await fs.mkdir(projectDir, { recursive: true })
    await fs.symlink(projectDir, linkDir, 'dir')
    const realProjectDir = await fs.realpath(projectDir)

    const service = new ProjectService()
    const linked = await service.addProject(linkDir)
    const direct = await service.addProject(projectDir)
    const projects = await service.listProjects()

    expect(projects).toHaveLength(1)
    expect(linked.realPath).toBe(realProjectDir)
    expect(direct.realPath).toBe(realProjectDir)
    expect(linked.identity).toEqual(direct.identity)
    expect(linked.identity.id).toMatch(/^prj_[a-f0-9]{16}$/)
    expect(linked.identity.canonicalPath).toBe(realProjectDir)
    expect(linked.identity.git.isGit).toBe(false)

    const otherProjectDir = path.join(tmpDir, 'workspace', 'identity-beta')
    await fs.mkdir(otherProjectDir, { recursive: true })
    await service.addProject(otherProjectDir)
    await new ProjectService().removeProject(otherProjectDir)
    const indexPath = path.join(tmpDir, 'cchahatui', 'projects.json')
    const persisted = JSON.parse(await fs.readFile(indexPath, 'utf-8')) as {
      projects: Array<{ path: string; identity?: unknown }>
    }
    expect(persisted.projects).toHaveLength(1)
    expect(persisted.projects[0].path).toBe(realProjectDir)
    expect(persisted.projects[0].identity).toEqual(direct.identity)
  })

  test('describes git projects with redacted remote identity', async () => {
    const projectDir = path.join(tmpDir, 'workspace', 'git-alpha')
    await fs.mkdir(projectDir, { recursive: true })
    await run(['git', 'init', '-b', 'main'], projectDir)
    await run(['git', 'remote', 'add', 'origin', 'https://token@example.com/acme/repo.git'], projectDir)
    await fs.writeFile(path.join(projectDir, 'README.md'), '# git-alpha\n')
    await run(['git', 'add', 'README.md'], projectDir)
    await run(['git', '-c', 'user.email=test@example.com', '-c', 'user.name=Test User', 'commit', '-m', 'init'], projectDir)
    const realProjectDir = await fs.realpath(projectDir)

    const service = new ProjectService()
    const added = await service.addProject(projectDir)

    expect(added.isGit).toBe(true)
    expect(added.repoName).toBe('acme/repo')
    expect(added.branch).toBe('main')
    expect(added.identity.git).toEqual({
      isGit: true,
      repoRoot: realProjectDir,
      remoteUrl: 'https://example.com/acme/repo.git',
      repoName: 'acme/repo',
      branch: 'main',
    })
    expect(added.identity.key).toContain(realProjectDir)
    expect(added.identity.key).not.toContain('token')
  })

  test('removes saved projects by real path and records a hidden project key', async () => {
    const projectDir = path.join(tmpDir, 'workspace', 'saved-hidden')
    await fs.mkdir(projectDir, { recursive: true })
    const realProjectDir = await fs.realpath(projectDir)

    const service = new ProjectService()
    await service.addProject(projectDir)
    const result = await service.removeProject(projectDir)
    const projects = await service.listProjects()
    const indexPath = path.join(tmpDir, 'cchahatui', 'projects.json')
    const persisted = JSON.parse(await fs.readFile(indexPath, 'utf-8')) as {
      hiddenProjectPaths?: string[]
    }

    expect(result).toEqual({ removed: true, hidden: true })
    expect(projects).toEqual([])
    expect(persisted.hiddenProjectPaths).toContain(sanitizePath(realProjectDir))
  })

  test('hides a session-derived project without deleting its JSONL file', async () => {
    const projectDir = path.join(tmpDir, 'workspace', 'old-shared-project')
    await fs.mkdir(projectDir, { recursive: true })
    const { projectDir: projectKey, sessionFile } = await writeSessionFile(projectDir, 'session-hidden-1')

    const before = makeRequest('GET', '/api/sessions?limit=20')
    const beforeRes = await handleSessionsApi(before.req, before.url, before.segments)
    const beforeBody = await beforeRes.json() as { sessions: Array<{ id: string; projectPath: string }> }
    expect(beforeBody.sessions).toContainEqual(expect.objectContaining({
      id: 'session-hidden-1',
      projectPath: projectKey,
    }))

    const remove = makeRequest('DELETE', `/api/projects?path=${encodeURIComponent(projectKey)}`)
    const removeRes = await handleProjectsApi(remove.req, remove.url, remove.segments)
    const removeBody = await removeRes.json() as { removed: boolean; hidden?: boolean }
    expect(removeBody).toMatchObject({ removed: true, hidden: true })
    expect((await fs.stat(sessionFile)).isFile()).toBe(true)

    const after = makeRequest('GET', '/api/sessions?limit=20')
    const afterRes = await handleSessionsApi(after.req, after.url, after.segments)
    const afterBody = await afterRes.json() as { sessions: Array<{ id: string }> }
    expect(afterBody.sessions.map((session) => session.id)).not.toContain('session-hidden-1')

    const filtered = makeRequest('GET', `/api/sessions?project=${encodeURIComponent(projectKey)}&limit=20`)
    const filteredRes = await handleSessionsApi(filtered.req, filtered.url, filtered.segments)
    const filteredBody = await filteredRes.json() as { sessions: Array<{ id: string }> }
    expect(filteredBody.sessions).toEqual([])
  })

  test('adding a hidden project restores its session-derived project listing', async () => {
    const projectDir = path.join(tmpDir, 'workspace', 'restore-hidden')
    await fs.mkdir(projectDir, { recursive: true })
    const { projectDir: projectKey } = await writeSessionFile(projectDir, 'session-restore-1')

    const service = new ProjectService()
    await service.removeProject(projectKey)
    const hidden = makeRequest('GET', '/api/sessions?limit=20')
    const hiddenRes = await handleSessionsApi(hidden.req, hidden.url, hidden.segments)
    const hiddenBody = await hiddenRes.json() as { sessions: Array<{ id: string }> }
    expect(hiddenBody.sessions.map((session) => session.id)).not.toContain('session-restore-1')

    await service.addProject(projectDir)
    const restored = makeRequest('GET', '/api/sessions?limit=20')
    const restoredRes = await handleSessionsApi(restored.req, restored.url, restored.segments)
    const restoredBody = await restoredRes.json() as { sessions: Array<{ id: string; projectPath: string }> }
    expect(restoredBody.sessions).toContainEqual(expect.objectContaining({
      id: 'session-restore-1',
      projectPath: projectKey,
    }))
  })
})

describe('Projects API', () => {
  beforeEach(setup)
  afterEach(teardown)

  test('creates saved projects and exposes them in recent projects', async () => {
    const projectDir = path.join(tmpDir, 'workspace', 'api-project')
    await fs.mkdir(projectDir, { recursive: true })
    const realProjectDir = await fs.realpath(projectDir)

    const create = makeRequest('POST', '/api/projects', { path: projectDir })
    const createRes = await handleProjectsApi(create.req, create.url, create.segments)
    expect(createRes.status).toBe(200)
    const createBody = await createRes.json() as { project: { realPath: string; projectName: string; identity: { canonicalPath: string } } }
    expect(createBody.project.realPath).toBe(realProjectDir)
    expect(createBody.project.projectName).toBe('api-project')
    expect(createBody.project.identity.canonicalPath).toBe(realProjectDir)

    const list = makeRequest('GET', '/api/projects')
    const listRes = await handleProjectsApi(list.req, list.url, list.segments)
    const listBody = await listRes.json() as { projects: Array<{ realPath: string }> }
    expect(listBody.projects.map((project) => project.realPath)).toEqual([realProjectDir])

    const recent = makeRequest('GET', '/api/sessions/recent-projects?limit=20')
    const recentRes = await handleSessionsApi(recent.req, recent.url, recent.segments)
    const recentBody = await recentRes.json() as { projects: Array<{ realPath: string; sessionCount: number; saved?: boolean; identity?: { canonicalPath: string } }> }
    expect(recentBody.projects).toContainEqual(expect.objectContaining({
      realPath: realProjectDir,
      sessionCount: 0,
      saved: true,
      identity: expect.objectContaining({
        canonicalPath: realProjectDir,
      }),
    }))
  })
})
