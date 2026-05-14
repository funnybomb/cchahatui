import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  getAdditionalDirectoriesForClaudeMd,
  getCwdState,
  setAdditionalDirectoriesForClaudeMd,
  setCwdState,
} from '../../bootstrap/state.js'
import { getWatchablePathsForTesting, resetForTesting } from './skillChangeDetector.js'

let tmpDir: string
let originalClaudeConfigDir: string | undefined
let originalCwd: string
let originalAdditionalDirs: string[]

describe('skillChangeDetector watch paths', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cchahatui-skill-watch-'))
    originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR
    originalCwd = getCwdState()
    originalAdditionalDirs = getAdditionalDirectoriesForClaudeMd()
    await resetForTesting()
  })

  afterEach(async () => {
    if (originalClaudeConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir
    }
    setCwdState(originalCwd)
    setAdditionalDirectoriesForClaudeMd(originalAdditionalDirs)
    await resetForTesting()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('watches isolated user skills and cchahatui project skills with legacy fallback', async () => {
    const configDir = path.join(tmpDir, 'config')
    const projectDir = path.join(tmpDir, 'project')
    const additionalDir = path.join(tmpDir, 'extra')

    process.env.CLAUDE_CONFIG_DIR = configDir
    setCwdState(projectDir)
    setAdditionalDirectoriesForClaudeMd([additionalDir])

    const expectedDirs = [
      path.join(configDir, 'skills'),
      path.join(configDir, 'commands'),
      path.join(projectDir, '.cchahatui', 'skills'),
      path.join(projectDir, '.claude', 'skills'),
      path.join(projectDir, '.claude', 'commands'),
      path.join(additionalDir, '.cchahatui', 'skills'),
      path.join(additionalDir, '.claude', 'skills'),
    ]

    await Promise.all(
      expectedDirs.map(dir => fs.mkdir(dir, { recursive: true })),
    )

    const paths = await getWatchablePathsForTesting()

    for (const expectedDir of expectedDirs) {
      expect(paths).toContain(expectedDir)
    }
  })
})
