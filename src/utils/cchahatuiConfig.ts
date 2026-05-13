import { mkdir, rename, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getClaudeConfigHomeDir } from './envUtils.js'

export const CCHAHATUI_MANAGED_CONFIG_DIR = 'cchahatui'
export const LEGACY_CC_HAHA_MANAGED_CONFIG_DIR = 'cc-haha'

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
