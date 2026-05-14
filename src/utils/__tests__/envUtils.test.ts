import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getClaudeConfigHomeDir, getTeamsDir } from '../envUtils.js'

describe('envUtils project content helpers', () => {
  let originalProjectConfigDir: string | undefined
  let originalConfigDir: string | undefined
  let originalAppData: string | undefined
  let originalXdgConfigHome: string | undefined
  const originalPlatform = process.platform

  beforeEach(() => {
    originalProjectConfigDir = process.env.CCHAHATUI_PROJECT_CONFIG_DIR
    originalConfigDir = process.env.CLAUDE_CONFIG_DIR
    originalAppData = process.env.APPDATA
    originalXdgConfigHome = process.env.XDG_CONFIG_HOME
    delete process.env.CCHAHATUI_PROJECT_CONFIG_DIR
    delete process.env.CLAUDE_CONFIG_DIR
    delete process.env.APPDATA
    delete process.env.XDG_CONFIG_HOME
    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  afterEach(() => {
    if (originalProjectConfigDir === undefined) delete process.env.CCHAHATUI_PROJECT_CONFIG_DIR
    else process.env.CCHAHATUI_PROJECT_CONFIG_DIR = originalProjectConfigDir

    if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = originalConfigDir

    if (originalAppData === undefined) delete process.env.APPDATA
    else process.env.APPDATA = originalAppData

    if (originalXdgConfigHome === undefined) delete process.env.XDG_CONFIG_HOME
    else process.env.XDG_CONFIG_HOME = originalXdgConfigHome

    Object.defineProperty(process, 'platform', { value: originalPlatform })
  })

  test('uses explicit project content config for teams', () => {
    process.env.CCHAHATUI_PROJECT_CONFIG_DIR = '/tmp/cchahatui-project-data'
    process.env.CLAUDE_CONFIG_DIR = join(homedir(), '.claude')

    expect(getTeamsDir()).toBe('/tmp/cchahatui-project-data/teams')
  })

  test('uses explicit project content config for Claude-compatible user config', () => {
    process.env.CCHAHATUI_PROJECT_CONFIG_DIR = '/tmp/cchahatui-project-data'
    process.env.CLAUDE_CONFIG_DIR = join(homedir(), '.claude')

    expect(getClaudeConfigHomeDir()).toBe('/tmp/cchahatui-project-data')
  })

  test('keeps tests and custom runs with explicit non-shared CLAUDE_CONFIG_DIR', () => {
    process.env.CLAUDE_CONFIG_DIR = '/tmp/custom-config'

    expect(getTeamsDir()).toBe('/tmp/custom-config/teams')
    expect(getClaudeConfigHomeDir()).toBe('/tmp/custom-config')
  })

  test('does not put teams in shared ~/.claude by default', () => {
    process.env.CLAUDE_CONFIG_DIR = join(homedir(), '.claude')

    expect(getTeamsDir()).toContain(join('cchahatui', 'config', 'teams'))
    expect(getClaudeConfigHomeDir()).toContain(join('cchahatui', 'config'))
    expect(getClaudeConfigHomeDir()).not.toBe(join(homedir(), '.claude'))
  })

  test('uses APPDATA for default Windows team storage', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    process.env.APPDATA = 'D:\\AppData\\Roaming'

    expect(getTeamsDir()).toBe(join('D:\\AppData\\Roaming', 'cchahatui', 'config', 'teams'))
  })

  test('uses APPDATA for default Windows Claude-compatible user config', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    process.env.APPDATA = 'D:\\AppData\\Roaming'

    expect(getClaudeConfigHomeDir()).toBe(join('D:\\AppData\\Roaming', 'cchahatui', 'config'))
  })

  test('uses XDG_CONFIG_HOME for default Linux team storage', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    process.env.XDG_CONFIG_HOME = '/tmp/xdg'

    expect(getTeamsDir()).toBe(join('/tmp/xdg', 'cchahatui', 'config', 'teams'))
  })

  test('uses XDG_CONFIG_HOME for default Linux Claude-compatible user config', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    process.env.XDG_CONFIG_HOME = '/tmp/xdg'

    expect(getClaudeConfigHomeDir()).toBe(join('/tmp/xdg', 'cchahatui', 'config'))
  })
})
