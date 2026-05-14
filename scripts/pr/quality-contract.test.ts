import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

describe('feature quality contract', () => {
  test('keeps the agent-facing implementation contract explicit', () => {
    const agents = readFileSync('AGENTS.md', 'utf8')

    expect(agents).toContain('## Feature Quality Contract')
    expect(agents).toContain('## Persistent Storage Compatibility')
    expect(agents).toContain('Any change to local JSON, `localStorage`, or app config persistence formats must ship with a forward migration')
    expect(agents).toContain('`~/.claude/settings.json` is user-owned shared state')
    expect(agents).toContain('persistence upgrade gate')
    expect(agents).toContain('Production code changes under `desktop/src`, `src/server`, `src/tools`, `src/utils`, or `adapters` must include a same-area test file')
    expect(agents).toContain('Coverage is part of the feature, not an afterthought.')
    expect(agents).toContain('changed executable production line must meet the changed-line coverage gate')
    expect(agents).toContain('E2E is required when the feature crosses process boundaries')
    expect(agents).toContain('AI agents must include this evidence')
    expect(agents).toContain('Unified local entrypoint: `bun run verify`')
    expect(agents).toContain('If `bun run verify` fails, do not stop at reporting the failure')
  })

  test('keeps PR authors accountable for tests, coverage, E2E, and risk', () => {
    const template = readFileSync('.github/pull_request_template.md', 'utf8')

    expect(template).toContain('## Feature Quality Contract')
    expect(template).toContain('Changed surface:')
    expect(template).toContain('Tests added or updated:')
    expect(template).toContain('Coverage evidence:')
    expect(template).toContain('changed-line coverage')
    expect(template).toContain('E2E / live-model evidence:')
    expect(template).toContain('Known risk / rollback:')
    expect(template).toContain('I added or updated same-area tests')
  })

  test('keeps the one-command verification entrypoint documented', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>
    }
    const contributing = readFileSync('docs/guide/contributing.md', 'utf8')
    const englishContributing = readFileSync('docs/en/guide/contributing.md', 'utf8')
    const rootContributing = readFileSync('CONTRIBUTING.md', 'utf8')

    expect(packageJson.scripts?.verify).toBe('bun run quality:pr')
    expect(packageJson.scripts?.['quality:verify']).toBe('bun run quality:pr')
    expect(packageJson.scripts?.['check:persistence-upgrade']).toBe('bun run scripts/quality-gate/persistence-upgrade.ts')
    expect(contributing).toContain('bun run verify')
    expect(contributing).toContain('AI Coding Agent 修复循环')
    expect(englishContributing).toContain('bun run verify')
    expect(englishContributing).toContain('AI Coding Agent Fix Loop')
    expect(rootContributing).toContain('bun run verify')
  })

  test('keeps general AI coding tools pointed at the same quality bar', () => {
    const instructions = readFileSync('.github/copilot-instructions.md', 'utf8')

    expect(instructions).toContain('Follow the repository contract in `AGENTS.md`')
    expect(instructions).toContain('Add same-area tests with the production change')
    expect(instructions).toContain('Preserve or improve the coverage ratchet')
    expect(instructions).toContain('changed-line coverage threshold')
    expect(instructions).toContain('E2E or agent-browser smoke')
    expect(instructions).toContain('include changed files, tests added, coverage report path')
  })

  test('keeps public issue templates pointed at cchahatui support paths', () => {
    const bugReport = readFileSync('.github/ISSUE_TEMPLATE/bug_report.md', 'utf8')
    const question = readFileSync('.github/ISSUE_TEMPLATE/question.md', 'utf8')
    const combined = `${bugReport}\n${question}`

    expect(combined).not.toContain('github.com/NanmiCoder/cc-haha')
    expect(combined).toContain('github.com/funnybomb/cchahatui/issues')
    expect(combined).toContain('github.com/funnybomb/cchahatui/blob/main/docs/guide/faq.md')
    expect(question).toContain('github.com/funnybomb/cchahatui/blob/main/docs/guide/third-party-models.md')
    expect(combined).toContain('DeepSeek 官方')
  })

  test('keeps README release guidance version-neutral', () => {
    const readme = readFileSync('README.md', 'utf8')
    const englishReadme = readFileSync('README.en.md', 'utf8')
    const combined = `${readme}\n${englishReadme}`

    expect(combined).toContain('github.com/funnybomb/cchahatui/releases')
    expect(combined).not.toContain('version-v0.3.9')
    expect(combined).not.toContain('releases/tag/v0.3.9')
    expect(readme).not.toContain('下载 `v0.3.9`')
  })
})
