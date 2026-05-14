import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { handleProjectsApi } from '../api/projects.js'
import { handleSessionsApi } from '../api/sessions.js'
import { ProjectService } from '../services/projectService.js'

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
