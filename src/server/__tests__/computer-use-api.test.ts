import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import { handleComputerUseApi } from '../api/computer-use.js'

const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR
const originalProjectConfigDir = process.env.CCHAHATUI_PROJECT_CONFIG_DIR
let configDir: string | null = null

function makeRequest(method: string, body?: unknown): Request {
  return new Request('http://localhost/api/computer-use/authorized-apps', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function callAuthorizedApps(method: string, body?: unknown): Promise<Response> {
  return handleComputerUseApi(
    makeRequest(method, body),
    new URL('http://localhost/api/computer-use/authorized-apps'),
    ['api', 'computer-use', 'authorized-apps'],
  )
}

async function callComputerUse(action: string, method: string, body?: unknown): Promise<Response> {
  return handleComputerUseApi(
    makeRequest(method, body),
    new URL(`http://localhost/api/computer-use/${action}`),
    ['api', 'computer-use', action],
  )
}

beforeEach(async () => {
  configDir = await mkdtemp(join(tmpdir(), 'cc-haha-computer-use-api-'))
  delete process.env.CCHAHATUI_PROJECT_CONFIG_DIR
  process.env.CLAUDE_CONFIG_DIR = configDir
})

afterEach(async () => {
  if (originalProjectConfigDir === undefined) {
    delete process.env.CCHAHATUI_PROJECT_CONFIG_DIR
  } else {
    process.env.CCHAHATUI_PROJECT_CONFIG_DIR = originalProjectConfigDir
  }

  if (originalClaudeConfigDir === undefined) {
    delete process.env.CLAUDE_CONFIG_DIR
  } else {
    process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir
  }

  if (configDir) {
    await rm(configDir, { recursive: true, force: true })
    configDir = null
  }
})

describe('Computer Use API authorized app config', () => {
  it('defaults Computer Use enabled for existing users without config', async () => {
    const res = await callAuthorizedApps('GET')

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      enabled: true,
      authorizedApps: [],
    })
  })

  it('persists the Computer Use enabled flag independently', async () => {
    const putRes = await callAuthorizedApps('PUT', { enabled: false })
    expect(putRes.status).toBe(200)

    const getRes = await callAuthorizedApps('GET')
    expect(await getRes.json()).toMatchObject({ enabled: false })

    const raw = await readFile(
      join(configDir!, 'cchahatui', 'computer-use-config.json'),
      'utf8',
    )
    expect(JSON.parse(raw)).toMatchObject({ enabled: false })
  })

  it('resolves runtime status from the isolated project config at request time', async () => {
    process.env.CCHAHATUI_PROJECT_CONFIG_DIR = configDir!
    process.env.CLAUDE_CONFIG_DIR = join(homedir(), '.claude')

    const runtimeRoot = join(configDir!, '.runtime')
    const venvPython = join(runtimeRoot, 'venv', 'bin', 'python3')
    const requirements = await readFile(join(process.cwd(), 'runtime', 'requirements.txt'), 'utf8')
    const digest = createHash('sha256').update(requirements).digest('hex')

    await mkdir(join(runtimeRoot, 'venv', 'bin'), { recursive: true })
    await writeFile(venvPython, '#!/bin/sh\nprintf \'{"ok":true,"result":{"accessibility":true,"screenRecording":false}}\\n\'\n')
    await chmod(venvPython, 0o755)
    await writeFile(join(runtimeRoot, 'requirements.txt'), requirements, 'utf8')
    await writeFile(join(runtimeRoot, 'requirements.sha256'), `${digest}\n`, 'utf8')

    const res = await callComputerUse('status', 'GET')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      venv: {
        created: true,
        path: join(configDir!, '.runtime', 'venv'),
      },
      dependencies: {
        installed: true,
      },
      permissions: {
        accessibility: true,
        screenRecording: false,
      },
    })
  })

  it('persists and normalizes a custom Python interpreter path', async () => {
    const pythonPath = '  C:\\Users\\me\\miniconda3\\envs\\cu\\python.exe  '
    const putRes = await callAuthorizedApps('PUT', { pythonPath })
    expect(putRes.status).toBe(200)

    const getRes = await callAuthorizedApps('GET')
    expect(await getRes.json()).toMatchObject({
      pythonPath: 'C:\\Users\\me\\miniconda3\\envs\\cu\\python.exe',
    })

    const resetRes = await callAuthorizedApps('PUT', { pythonPath: '' })
    expect(resetRes.status).toBe(200)

    const resetGetRes = await callAuthorizedApps('GET')
    expect(await resetGetRes.json()).toMatchObject({ pythonPath: null })
  })
})
