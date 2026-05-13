import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { homedir } from 'node:os'
import {
  CCHAHATUI_PROJECT_CONFIG_DIR_ENV,
  ensureCchahatuiProjectConfigDirEnv,
  getDefaultCchahatuiConfigDir,
  getCchahatuiProjectConfigDir,
  isSharedClaudeConfigDir,
} from '../cchahatuiConfig.js'

describe('cchahatui runtime config', () => {
  test('uses macOS Application Support by default', () => {
    expect(getDefaultCchahatuiConfigDir({
      homeDir: '/Users/alice',
      platform: 'darwin',
      env: {},
    })).toBe(join('/Users/alice', 'Library', 'Application Support', 'cchahatui', 'config'))
  })

  test('uses APPDATA on Windows', () => {
    expect(getDefaultCchahatuiConfigDir({
      homeDir: 'C:\\Users\\alice',
      platform: 'win32',
      env: { APPDATA: 'D:\\AppData\\Roaming' },
    })).toBe(join('D:\\AppData\\Roaming', 'cchahatui', 'config'))
  })

  test('uses XDG_CONFIG_HOME on Linux', () => {
    expect(getDefaultCchahatuiConfigDir({
      homeDir: '/home/alice',
      platform: 'linux',
      env: { XDG_CONFIG_HOME: '/tmp/xdg' },
    })).toBe(join('/tmp/xdg', 'cchahatui', 'config'))
  })

  test('preserves explicit project config dir', () => {
    const env: NodeJS.ProcessEnv = { [CCHAHATUI_PROJECT_CONFIG_DIR_ENV]: '/tmp/project-content' }

    expect(getCchahatuiProjectConfigDir(env)).toBe('/tmp/project-content')
    expect(ensureCchahatuiProjectConfigDirEnv(env)).toBe('/tmp/project-content')
    expect(env.CLAUDE_CONFIG_DIR).toBeUndefined()
  })

  test('preserves explicit non-shared CLAUDE_CONFIG_DIR for tests and custom runs', () => {
    const env: NodeJS.ProcessEnv = { CLAUDE_CONFIG_DIR: '/tmp/explicit' }

    expect(getCchahatuiProjectConfigDir(env)).toBe('/tmp/explicit')
    expect(ensureCchahatuiProjectConfigDirEnv(env)).toBe('/tmp/explicit')
    expect(env.CLAUDE_CONFIG_DIR).toBe('/tmp/explicit')
  })

  test('keeps cchahatui isolated from shared ~/.claude', () => {
    const env: NodeJS.ProcessEnv = { CLAUDE_CONFIG_DIR: join(homedir(), '.claude') }

    expect(isSharedClaudeConfigDir(env.CLAUDE_CONFIG_DIR)).toBe(true)
    expect(getCchahatuiProjectConfigDir(env)).toContain(join('cchahatui', 'config'))
    expect(ensureCchahatuiProjectConfigDirEnv(env)).toContain(join('cchahatui', 'config'))
    expect(env.CLAUDE_CONFIG_DIR).toBe(join(homedir(), '.claude'))
  })

  test('sets isolated default when CLAUDE_CONFIG_DIR is absent', () => {
    const env: NodeJS.ProcessEnv = {}
    const resolved = ensureCchahatuiProjectConfigDirEnv(env)

    expect(resolved).toContain(join('cchahatui', 'config'))
    expect(env[CCHAHATUI_PROJECT_CONFIG_DIR_ENV]).toBe(resolved)
    expect(env.CLAUDE_CONFIG_DIR).toBeUndefined()
  })
})
