import { mkdir, rename, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { getClaudeConfigHomeDir } from './envUtils.js'

export const CCHAHATUI_MANAGED_CONFIG_DIR = 'cchahatui'
export const LEGACY_CC_HAHA_MANAGED_CONFIG_DIR = 'cc-haha'
export const CCHAHATUI_APP_NAME = 'cchahatui'
export const CCHAHATUI_APP_CONFIG_DIR_NAME = 'config'

type ConfigDirOptions = {
  homeDir?: string
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
}

export function getDefaultCchahatuiConfigDir(
  options: ConfigDirOptions = {},
): string {
  const home = options.homeDir ?? homedir()
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env

  if (platform === 'darwin') {
    return join(
      home,
      'Library',
      'Application Support',
      CCHAHATUI_APP_NAME,
      CCHAHATUI_APP_CONFIG_DIR_NAME,
    )
  }

  if (platform === 'win32') {
    return join(
      env.APPDATA || join(home, 'AppData', 'Roaming'),
      CCHAHATUI_APP_NAME,
      CCHAHATUI_APP_CONFIG_DIR_NAME,
    )
  }

  return join(
    env.XDG_CONFIG_HOME || join(home, '.config'),
    CCHAHATUI_APP_NAME,
    CCHAHATUI_APP_CONFIG_DIR_NAME,
  )
}

export function getCchahatuiRuntimeConfigDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return env.CLAUDE_CONFIG_DIR || getDefaultCchahatuiConfigDir({ env })
}

export function ensureCchahatuiRuntimeConfigDirEnv(
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!env.CLAUDE_CONFIG_DIR) {
    env.CLAUDE_CONFIG_DIR = getDefaultCchahatuiConfigDir({ env })
  }
  return env.CLAUDE_CONFIG_DIR
}

export function getCchahatuiManagedConfigDir(
  configDir = getClaudeConfigHomeDir(),
): string {
  return join(configDir, CCHAHATUI_MANAGED_CONFIG_DIR)
}

export function getLegacyCcHahaManagedConfigDir(
  configDir = getClaudeConfigHomeDir(),
): string {
  return join(configDir, LEGACY_CC_HAHA_MANAGED_CONFIG_DIR)
}

export function getManagedConfigCandidateDirs(
  configDir = getClaudeConfigHomeDir(),
): string[] {
  return [
    getCchahatuiManagedConfigDir(configDir),
    getLegacyCcHahaManagedConfigDir(configDir),
  ]
}

export function getCchahatuiManagedConfigPath(
  ...segments: string[]
): string {
  return join(getCchahatuiManagedConfigDir(), ...segments)
}

export function getCchahatuiManagedConfigPathForDir(
  configDir: string,
  ...segments: string[]
): string {
  return join(getCchahatuiManagedConfigDir(configDir), ...segments)
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

export async function ensureCchahatuiManagedConfigDirMigrated(
  configDir = getClaudeConfigHomeDir(),
): Promise<boolean> {
  const targetDir = getCchahatuiManagedConfigDir(configDir)
  const legacyDir = getLegacyCcHahaManagedConfigDir(configDir)

  if (await pathExists(targetDir)) return false
  if (!(await pathExists(legacyDir))) return false

  await mkdir(dirname(targetDir), { recursive: true })
  await rename(legacyDir, targetDir)
  return true
}
