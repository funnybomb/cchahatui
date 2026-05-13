import { mkdir, rename, stat } from 'node:fs/promises'
import { dirname, join, normalize } from 'node:path'
import { homedir } from 'node:os'
import { getClaudeConfigHomeDir } from './envUtils.js'

export const CCHAHATUI_MANAGED_CONFIG_DIR = 'cchahatui'
export const LEGACY_CC_HAHA_MANAGED_CONFIG_DIR = 'cc-haha'
export const CCHAHATUI_APP_NAME = 'cchahatui'
export const CCHAHATUI_APP_CONFIG_DIR_NAME = 'config'
export const CCHAHATUI_PROJECT_CONFIG_DIR_ENV = 'CCHAHATUI_PROJECT_CONFIG_DIR'

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

export function getCchahatuiProjectConfigDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env[CCHAHATUI_PROJECT_CONFIG_DIR_ENV] || env.CLAUDE_CONFIG_DIR
  if (configured && !isSharedClaudeConfigDir(configured)) {
    return configured
  }
  return getDefaultCchahatuiConfigDir({ env })
}

export function ensureCchahatuiProjectConfigDirEnv(
  env: NodeJS.ProcessEnv = process.env,
): string {
  env[CCHAHATUI_PROJECT_CONFIG_DIR_ENV] = getCchahatuiProjectConfigDir(env)
  return env[CCHAHATUI_PROJECT_CONFIG_DIR_ENV]
}

export function isSharedClaudeConfigDir(configDir: string): boolean {
  return normalize(configDir) === normalize(join(homedir(), '.claude'))
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
