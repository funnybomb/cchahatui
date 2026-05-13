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
    const createBody = await createRes.json() as { project: { realPath: string; projectName: string } }
    expect(createBody.project.realPath).toBe(realProjectDir)
    expect(createBody.project.projectName).toBe('api-project')

    const list = makeRequest('GET', '/api/projects')
    const listRes = await handleProjectsApi(list.req, list.url, list.segments)
    const listBody = await listRes.json() as { projects: Array<{ realPath: string }> }
    expect(listBody.projects.map((project) => project.realPath)).toEqual([realProjectDir])

    const recent = makeRequest('GET', '/api/sessions/recent-projects?limit=20')
    const recentRes = await handleSessionsApi(recent.req, recent.url, recent.segments)
    const recentBody = await recentRes.json() as { projects: Array<{ realPath: string; sessionCount: number; saved?: boolean }> }
    expect(recentBody.projects).toContainEqual(expect.objectContaining({
      realPath: realProjectDir,
      sessionCount: 0,
      saved: true,
    }))
  })
})
