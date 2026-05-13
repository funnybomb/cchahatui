import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { access, mkdir, mkdtemp, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  _resetRecordingStateForTesting,
  getRecordFilePath,
  getSessionRecordingPaths,
  renameRecordingForSession,
} from '../asciicast.js'
import {
  cleanupOldDebugLogs,
  cleanupOldFileHistoryBackups,
  cleanupOldPlanFiles,
  cleanupOldSessionEnvDirs,
} from '../cleanup.js'
import { clearStoredImagePaths, cleanupOldImageCaches, storeImage } from '../imageStore.js'
import { getPlansDirectory } from '../plans.js'
import { checkReadableInternalPath } from '../permissions/filesystem.js'
import { getAgentStatuses, getTasksDir } from '../tasks.js'

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function markOld(path: string): Promise<void> {
  const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
  await utimes(path, old, old)
}

describe('project content storage paths', () => {
  let tmpDir: string
  let originalProjectConfigDir: string | undefined
  let originalConfigDir: string | undefined
  let originalUserType: string | undefined
  let originalTerminalRecording: string | undefined

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'cchahatui-project-content-'))
    originalProjectConfigDir = process.env.CCHAHATUI_PROJECT_CONFIG_DIR
    originalConfigDir = process.env.CLAUDE_CONFIG_DIR
    originalUserType = process.env.USER_TYPE
    originalTerminalRecording = process.env.CLAUDE_CODE_TERMINAL_RECORDING

    process.env.CCHAHATUI_PROJECT_CONFIG_DIR = tmpDir
    process.env.CLAUDE_CONFIG_DIR = join(tmpDir, 'shared-claude')
    _resetRecordingStateForTesting()
    clearStoredImagePaths()
    getPlansDirectory.cache.clear?.()
  })

  afterEach(async () => {
    _resetRecordingStateForTesting()
    clearStoredImagePaths()
    getPlansDirectory.cache.clear?.()

    if (originalProjectConfigDir === undefined) delete process.env.CCHAHATUI_PROJECT_CONFIG_DIR
    else process.env.CCHAHATUI_PROJECT_CONFIG_DIR = originalProjectConfigDir

    if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = originalConfigDir

    if (originalUserType === undefined) delete process.env.USER_TYPE
    else process.env.USER_TYPE = originalUserType

    if (originalTerminalRecording === undefined) delete process.env.CLAUDE_CODE_TERMINAL_RECORDING
    else process.env.CLAUDE_CODE_TERMINAL_RECORDING = originalTerminalRecording

    await rm(tmpDir, { recursive: true, force: true })
  })

  test('initializes the project config env without forcing shared CLAUDE_CONFIG_DIR', async () => {
    delete process.env.CCHAHATUI_PROJECT_CONFIG_DIR
    const sharedConfigDir = process.env.CLAUDE_CONFIG_DIR

    await import('../initCchahatuiRuntimeConfig.js')

    expect(process.env.CCHAHATUI_PROJECT_CONFIG_DIR).toBe(sharedConfigDir)
    expect(process.env.CLAUDE_CONFIG_DIR).toBe(sharedConfigDir)
  })

  test('stores asciicast recordings under project content data', async () => {
    process.env.USER_TYPE = 'ant'
    process.env.CLAUDE_CODE_TERMINAL_RECORDING = '1'

    const recordPath = getRecordFilePath()
    expect(recordPath).toContain(join(tmpDir, 'projects'))
    expect(recordPath).not.toContain('shared-claude')

    await mkdir(dirname(recordPath!), { recursive: true })
    await writeFile(recordPath!, 'recording')

    expect(getSessionRecordingPaths()).toEqual([recordPath])
    await renameRecordingForSession()
    expect(await exists(recordPath!)).toBe(true)
  })

  test('cleans project content directories instead of shared config', async () => {
    const oldPlan = join(tmpDir, 'plans', 'old.md')
    await mkdir(dirname(oldPlan), { recursive: true })
    await writeFile(oldPlan, 'plan')
    await markOld(oldPlan)

    const fileHistoryDir = join(tmpDir, 'file-history', 'old-session')
    await mkdir(fileHistoryDir, { recursive: true })
    await markOld(fileHistoryDir)

    const sessionEnvDir = join(tmpDir, 'session-env', 'old-session')
    await mkdir(sessionEnvDir, { recursive: true })
    await markOld(sessionEnvDir)

    const debugLog = join(tmpDir, 'debug', 'old.txt')
    await mkdir(dirname(debugLog), { recursive: true })
    await writeFile(debugLog, 'debug')
    await markOld(debugLog)

    expect((await cleanupOldPlanFiles()).messages).toBe(1)
    expect((await cleanupOldFileHistoryBackups()).messages).toBe(1)
    expect((await cleanupOldSessionEnvDirs()).messages).toBe(1)
    expect((await cleanupOldDebugLogs()).messages).toBe(1)

    expect(await exists(oldPlan)).toBe(false)
    expect(await exists(fileHistoryDir)).toBe(false)
    expect(await exists(sessionEnvDir)).toBe(false)
    expect(await exists(debugLog)).toBe(false)
  })

  test('stores pasted image cache under project content data', async () => {
    const storedPath = await storeImage({
      id: 7,
      type: 'image',
      mediaType: 'image/png',
      content: Buffer.from('png').toString('base64'),
    } as any)

    expect(storedPath).toContain(join(tmpDir, 'image-cache'))
    expect(await stat(storedPath!)).toBeTruthy()

    const staleDir = join(tmpDir, 'image-cache', 'stale-session')
    await mkdir(staleDir, { recursive: true })
    await cleanupOldImageCaches()

    expect(await exists(staleDir)).toBe(false)
  })

  test('uses project content data for plans, tasks, teams, and read allowlists', async () => {
    expect(getPlansDirectory()).toBe(join(tmpDir, 'plans'))
    expect(getTasksDir('team/main')).toBe(join(tmpDir, 'tasks', 'team-main'))

    const teamConfig = join(tmpDir, 'teams', 'alpha-team', 'config.json')
    await mkdir(dirname(teamConfig), { recursive: true })
    await writeFile(
      teamConfig,
      JSON.stringify({
        leadAgentId: 'agent-lead',
        members: [{ agentId: 'agent-lead', name: 'Lead', agentType: 'lead' }],
      }),
    )

    expect(await getAgentStatuses('Alpha Team')).toEqual([
      {
        agentId: 'agent-lead',
        name: 'Lead',
        agentType: 'lead',
        status: 'idle',
        currentTasks: [],
      },
    ])

    expect(
      checkReadableInternalPath(join(tmpDir, 'tasks', 'team-main', 'task.json'), {}).behavior,
    ).toBe('allow')
    expect(
      checkReadableInternalPath(join(tmpDir, 'teams', 'alpha-team', 'config.json'), {}).behavior,
    ).toBe('allow')
  })
})
