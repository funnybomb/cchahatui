import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

describe('release desktop workflow', () => {
  test('does not package desktop builds automatically on version tags', () => {
    const workflow = readFileSync('.github/workflows/release-desktop.yml', 'utf8')

    expect(workflow).toContain('workflow_dispatch:')
    expect(workflow).not.toMatch(/\n\s+push:\n/)
    expect(workflow).not.toContain("tags: ['v*.*.*']")
  })

  test('build job runs directly without quality preflight dependency', () => {
    const workflow = readFileSync('.github/workflows/release-desktop.yml', 'utf8')

    expect(workflow).not.toContain('quality-preflight:')
    expect(workflow).not.toContain('run: bun run quality:gate --mode pr')
    expect(workflow).not.toContain('needs: quality-preflight')
    expect(workflow).toContain('name: Build (${{ matrix.label }})')
  })
})
