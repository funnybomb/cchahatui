# v0.3.21: Version-Neutral README Release Guidance

## Problem

The README files still hardcode `v0.3.9` in the badge and Chinese install instructions even though local tags have advanced through `v0.3.18`. Hardcoded public install versions can become stale quickly and can send users to old Desktop artifacts.

## Evidence

- `README.md` has a static `version-v0.3.9` badge and links it to `/releases/tag/v0.3.9`.
- `README.md` tells users to download the `v0.3.9` macOS / Windows package.
- `README.en.md` has the same static `version-v0.3.9` badge.
- Local tags include newer tags through `v0.3.18`.

## Scope

Documentation/governance-only small version:

- Remove static README version badges.
- Make Desktop installer steps point to the latest available packaged release without naming a stale version.
- Add a policy test to keep README release guidance version-neutral.

## Implementation Plan

1. Remove the duplicate static `Version` badge from both READMEs.
2. Replace the Chinese hardcoded install version with latest-release wording.
3. Add a focused policy assertion under `scripts/pr/quality-contract.test.ts`.
4. Run policy/docs/full verification.

## Test Plan

- Case 1: happy path — both READMEs still link to GitHub Releases.
- Case 2: edge/boundary — no README text or badge references `v0.3.9`.
- Case 3: regression/failure — policy tests fail if `v0.3.9` or `releases/tag/v0.3.9` returns to README release guidance.

## Done Evidence

- Changed files:
  - `README.md`
  - `README.en.md`
  - `scripts/pr/quality-contract.test.ts`
  - `issues/003-version-neutral-readme-release-guidance.md`
- Local verification:
  - `bun test scripts/pr/quality-contract.test.ts` passed (`6 pass`, `0 fail`).
  - `bun run check:docs` passed.
  - `bun run check:policy` passed.
  - `bun run verify` passed: `artifacts/quality-runs/2026-05-14T08-03-58-737Z/report.md` (`passed=6 failed=0 skipped=4`).
- Independent verification:
  - Case 1 passed: both READMEs still link to `https://github.com/funnybomb/cchahatui/releases`.
  - Case 2 passed: both READMEs no longer contain `version-v0.3.9`, `releases/tag/v0.3.9`, or `下载 `v0.3.9``.
  - Case 3 passed: the README release-guidance policy test passed.

## Residual Risk

None known.
