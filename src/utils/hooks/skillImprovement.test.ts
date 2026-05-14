import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { getCwdState, setCwdState } from '../../bootstrap/state.js'
import {
  applySkillImprovement,
  getProjectSkillImprovementPath,
} from './skillImprovement.js'

let tmpDir: string
let originalCwd: string

describe('applySkillImprovement', () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cchahatui-skill-improve-'))
    originalCwd = getCwdState()
    setCwdState(tmpDir)
  })

  afterEach(async () => {
    setCwdState(originalCwd)
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('looks for project skills in .cchahatui/skills', async () => {
    expect(getProjectSkillImprovementPath('missing-skill')).toBe(
      path.join(tmpDir, '.cchahatui', 'skills', 'missing-skill', 'SKILL.md'),
    )

    await applySkillImprovement('missing-skill', [
      { section: 'steps', change: 'Prefer cchahatui paths', reason: 'test' },
    ])

    await expect(
      fs.stat(path.join(tmpDir, '.cchahatui', 'skills', 'missing-skill')),
    ).rejects.toThrow()
  })
})
