# v0.3.19: Web-First Local Workflow Docs

## Problem

The current user priority is to use the web app first and avoid Desktop packaging unless explicitly requested. The README development path still leads with Desktop/Tauri commands and a macOS build command, which can steer maintainers toward packaging work when the intended next path is the local web app.

## Evidence

- `README.md` has `桌面端开发` before any local web workflow.
- `README.md` has a standalone `构建 macOS` section.
- `README.en.md` has `Install the Desktop App` before local source workflows and only documents CLI source startup, not the server plus Vite web app.
- `AGENTS.md` says Desktop releases are manual-only and normal pushes must not package Desktop builds.

## Scope

Documentation-only small version:

- Add explicit web-first local workflow commands.
- Keep Desktop install/build information available but label packaging as release-only.
- Do not build Desktop, DMG, or tags.

## Implementation Plan

1. Update `README.md` development section so local web app startup is first.
2. Update `README.en.md` with the same web-first source workflow.
3. Keep Desktop packaging commands behind a maintainer/release note.
4. Run docs check.

## Test Plan

- Case 1: happy path — a developer can start server on `3456` and Vite web app from the README.
- Case 2: edge/boundary — Desktop packaging command remains discoverable for release maintainers but is clearly not part of normal web workflow.
- Case 3: regression/failure — docs build still succeeds after README changes.

## Done Evidence

- Changed files:
  - `README.md`
  - `README.en.md`
  - `issues/001-web-first-local-workflow.md`
- Local verification:
  - `bun run check:docs` passed.
  - Earlier patrol check `bun run check:desktop` passed.
  - Focused storage/server patrol tests passed: `bun test src/server/__tests__/projects.test.ts src/server/__tests__/sessions.test.ts src/server/__tests__/settings.test.ts src/server/__tests__/doctor-service.test.ts adapters/common/__tests__/session-store.test.ts`.
  - `bun run verify` passed: `artifacts/quality-runs/2026-05-14T07-51-51-587Z/report.md` (`passed=6 failed=0 skipped=4`).
- Independent verification:
  - Case 1 passed: both READMEs include server command, frontend command, and `http://127.0.0.1:1431/`.
  - Case 2 passed: Desktop packaging command remains discoverable and is labeled release-only / not normal web development.
  - Case 3 passed: independent `bun run check:docs` exited 0.

## Residual Risk

None known.
