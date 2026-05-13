import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { homedir } from 'node:os'
import {
  ensureCchahatuiRuntimeConfigDirEnv,
  getDefaultCchahatuiConfigDir,
  getCchahatuiRuntimeConfigDir,
  isDefaultClaudeConfigDir,
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

  test('preserves explicit CLAUDE_CONFIG_DIR', () => {
    const env = { CLAUDE_CONFIG_DIR: '/tmp/explicit' }

    expect(getCchahatuiRuntimeConfigDir(env)).toBe('/tmp/explicit')
    expect(ensureCchahatuiRuntimeConfigDirEnv(env)).toBe('/tmp/explicit')
  })

  test('does not preserve the shared default ~/.claude path', () => {
    const env = { CLAUDE_CONFIG_DIR: join(homedir(), '.claude') }

    expect(isDefaultClaudeConfigDir(env.CLAUDE_CONFIG_DIR)).toBe(true)
    expect(getCchahatuiRuntimeConfigDir(env)).toContain(join('cchahatui', 'config'))
    expect(ensureCchahatuiRuntimeConfigDirEnv(env)).toContain(join('cchahatui', 'config'))
  })

  test('sets isolated default when CLAUDE_CONFIG_DIR is absent', () => {
    const env: NodeJS.ProcessEnv = {}
    const resolved = ensureCchahatuiRuntimeConfigDirEnv(env)

    expect(resolved).toContain(join('cchahatui', 'config'))
    expect(env.CLAUDE_CONFIG_DIR).toBe(resolved)
  })
})
