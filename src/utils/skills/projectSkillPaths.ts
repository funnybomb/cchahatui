import { statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { getProjectRoot } from '../../bootstrap/state.js'
import { isFsInaccessible } from '../errors.js'
import { normalizePathForComparison } from '../file.js'
import { findCanonicalGitRoot, findGitRoot } from '../git.js'

export const CCHAHATUI_PROJECT_CONFIG_DIR = '.cchahatui'
export const LEGACY_PROJECT_CONFIG_DIR = '.claude'
export const PROJECT_SKILL_CONFIG_DIRS = [
  CCHAHATUI_PROJECT_CONFIG_DIR,
  LEGACY_PROJECT_CONFIG_DIR,
] as const

export function getProjectSkillRootsForDirectory(dir: string): string[] {
  return PROJECT_SKILL_CONFIG_DIRS.map(configDir =>
    join(dir, configDir, 'skills'),
  )
}

function resolveStopBoundary(cwd: string): string | null {
  const cwdGitRoot = findGitRoot(cwd)
  const sessionGitRoot = findGitRoot(getProjectRoot())
  if (!cwdGitRoot || !sessionGitRoot) {
    return cwdGitRoot
  }

  const cwdCanonical = findCanonicalGitRoot(cwd)
  if (
    cwdCanonical &&
    normalizePathForComparison(cwdCanonical) ===
      normalizePathForComparison(sessionGitRoot)
  ) {
    return cwdGitRoot
  }

  const normalizedCwdGitRoot = normalizePathForComparison(cwdGitRoot)
  const normalizedSessionRoot = normalizePathForComparison(sessionGitRoot)
  if (
    normalizedCwdGitRoot !== normalizedSessionRoot &&
    normalizedCwdGitRoot.startsWith(normalizedSessionRoot + sep)
  ) {
    return sessionGitRoot
  }

  return cwdGitRoot
}

export function getProjectSkillDirsUpToHome(cwd: string): string[] {
  const home = resolve(homedir()).normalize('NFC')
  const gitRoot = resolveStopBoundary(cwd)
  let current = resolve(cwd)
  const dirs: string[] = []

  while (true) {
    if (
      normalizePathForComparison(current) === normalizePathForComparison(home)
    ) {
      break
    }

    for (const skillDir of getProjectSkillRootsForDirectory(current)) {
      try {
        statSync(skillDir)
        dirs.push(skillDir)
      } catch (error: unknown) {
        if (!isFsInaccessible(error)) throw error
      }
    }

    if (
      gitRoot &&
      normalizePathForComparison(current) ===
        normalizePathForComparison(gitRoot)
    ) {
      break
    }

    const parent = dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }

  return dirs
}
