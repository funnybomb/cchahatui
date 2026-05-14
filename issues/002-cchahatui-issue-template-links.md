# v0.3.20: cchahatui Issue Template Links

## Problem

The public GitHub issue templates still point reporters to upstream `NanmiCoder/cc-haha` README and issues. That can misroute bug reports, duplicate searches, and provider troubleshooting away from `funnybomb/cchahatui`.

## Evidence

- `.github/ISSUE_TEMPLATE/bug_report.md` links README FAQ and issue search to `NanmiCoder/cc-haha`.
- `.github/ISSUE_TEMPLATE/question.md` links README FAQ, third-party model docs, and issue search to `NanmiCoder/cc-haha`.
- The templates still use old version/provider examples that do not match the DeepSeek-first cchahatui public docs.

## Scope

Small governance/docs version:

- Update bug and question templates to cchahatui links and examples.
- Add a policy test that blocks upstream issue-template link regressions.

## Implementation Plan

1. Point template checklist links to `funnybomb/cchahatui`.
2. Refresh version/provider examples to cchahatui / DeepSeek-first wording.
3. Add a focused policy test under `scripts/pr`.
4. Run the policy/docs gates and full verify.

## Test Plan

- Case 1: happy path — bug reporters are sent to cchahatui FAQ and issues.
- Case 2: edge/boundary — question reporters using third-party providers are sent to cchahatui third-party model docs.
- Case 3: regression/failure — policy tests fail if the issue templates reintroduce upstream `NanmiCoder/cc-haha` links.

## Done Evidence

- Changed files:
  - `.github/ISSUE_TEMPLATE/bug_report.md`
  - `.github/ISSUE_TEMPLATE/question.md`
  - `scripts/pr/quality-contract.test.ts`
  - `issues/002-cchahatui-issue-template-links.md`
- Local verification:
  - `bun test scripts/pr/quality-contract.test.ts` passed (`5 pass`, `0 fail`).
  - `bun run check:policy` passed.
  - `bun run check:docs` passed.
  - `bun run verify` passed: `artifacts/quality-runs/2026-05-14T07-57-35-814Z/report.md` (`passed=6 failed=0 skipped=4`).
- Independent verification:
  - Case 1 passed: `bug_report.md` links FAQ/issues to `github.com/funnybomb/cchahatui` and no longer points to `NanmiCoder`.
  - Case 2 passed: `question.md` links third-party model docs to current cchahatui docs and uses `DeepSeek 官方 / OpenAI-compatible`.
  - Case 3 passed: the new policy test passed.

## Residual Risk

None known.
