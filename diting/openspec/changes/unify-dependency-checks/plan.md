# unify-dependency-checks Plan

## Source

Migrated from approved Superpowers plan: `docs/superpowers/plans/2026-07-08-unify-dependency-checks-plan.md`.

## Goal

Build a unified dependency check center for Diting that supports startup status display, task-required dependency preflight, and a modal console workflow for checking and authorizing dependencies.

## Architecture

Implementation proceeds in six autonomous TDD tasks:

1. Server dependency check types, registry, and sanitization.
2. Server providers and HTTP routes.
3. Required dependency preflight integration.
4. Web dependency check API helpers and modal component.
5. Console wiring, i18n, and styles.
6. UI verification material for VerifyAndReview.

Manual OpenSpec validation and VerifyAndReview are separate gates and must not be marked complete by the coding agent.

## Task Plan

### Task 1: Server Registry

Files:

- `apps/server/src/diting/dependency-checks/types.ts`
- `apps/server/src/diting/dependency-checks/registry.ts`
- `apps/server/src/diting/dependency-checks/index.ts`
- `apps/server/src/diting/dependency-checks.spec.ts`

Steps:

1. RED: add Jest tests for registry filtering and sensitive field redaction.
2. GREEN: implement `DependencyCheckStatus`, `DependencyCheckResult`, `DependencyCheckProvider`, `DependencyCheckRegistry`, and `sanitizeDependencyCheck`.
3. REFACTOR: keep public output fields whitelisted and avoid raw CLI output in `detail`.
4. Verify: `npm run test -w apps/server -- dependency-checks.spec.ts`.

### Task 2: Server Providers And API

Files:

- `apps/server/src/diting/dependency-checks/providers.ts`
- `apps/server/src/diting/dependency-checks/service.ts`
- `apps/server/src/diting/server.ts`
- `apps/server/src/diting/dependency-checks.spec.ts`
- `apps/server/src/diting/plugins.spec.ts`

Steps:

1. RED: add tests for Meegle, GitLab, coding runtime provider mapping and `GET /api/dependency-checks` / `POST /api/dependency-checks/recheck`.
2. GREEN: implement provider mapping from existing runtime plugins, create `DependencyCheckService`, and mount the routes.
3. REFACTOR: keep dependency degraded separate from `/api/readiness`.
4. Verify: `npm run test -w apps/server -- dependency-checks.spec.ts` and `npm run test -w apps/server -- plugins.spec.ts --runInBand`.

### Task 3: Required Dependency Preflight

Files:

- `apps/server/src/diting/server-integration.ts`
- `apps/server/src/diting/plugins/task-preflight.ts`
- `apps/server/src/diting/plugins.spec.ts`
- `packages/core/src/diting/services.spec.ts`

Steps:

1. RED: add tests for required dependency failure entering `waiting/environment_blocked` and non-required GitLab failure not blocking unrelated tasks.
2. GREEN: pass dependency check service into `runTaskPreflight` and append dependency check results to existing preflight checks.
3. REFACTOR: preserve submit, execution-before-environment, and product-to-programming handoff behavior.
4. Verify: `npm run test -w apps/server -- plugins.spec.ts --runInBand` and `npm run test -w packages/core -- services.spec.ts --runInBand`.

### Task 4: Web API Helpers And Modal

Files:

- `apps/web/src/dependency-checks.ts`
- `apps/web/src/dependency-check-modal.tsx`
- `apps/web/src/dependency-check-modal.test.tsx`

Steps:

1. RED: add Vitest/Testing Library tests for ready progress, grouped cards, Required / Optional badges, action callbacks, `Re-check`, and `Skip for now`.
2. GREEN: implement dependency check frontend types, API helpers, and modal component.
3. REFACTOR: keep modal props focused and testable.
4. Verify: `npm run test -w apps/web -- dependency-check-modal.test.tsx`.

### Task 5: Console Wiring

Files:

- `apps/web/src/App.tsx`
- `apps/web/src/i18n/en.ts`
- `apps/web/src/i18n/zh.ts`
- `apps/web/src/styles.css`

Steps:

1. RED: add or extend tests for modal entry and skip behavior.
2. GREEN: fetch dependency checks, show the dependency check entry, route Meegle/GitLab actions to existing authorization functions, and add recheck behavior.
3. REFACTOR: add bilingual strings and CSS without introducing a UI library.
4. Verify: `npm run test -w apps/web` and `npm run type-check:web`.

### Task 6: UI Verification Input

Files:

- `TEST.md`

Steps:

1. RED: document H5 UI cases before claiming UI coverage.
2. GREEN: write cases for opening the dependency modal, re-checking, skipping, authorization actions, and verifying that dependency check aggregation does not expose short-lived user/device codes.
3. REFACTOR: keep cases browser-executable through the Diting web console.
4. Verify: `npm run type-check`.

## Validation Commands

- `npm run test -w apps/server -- dependency-checks.spec.ts`
- `npm run test -w apps/server -- plugins.spec.ts --runInBand`
- `npm run test -w packages/core -- services.spec.ts --runInBand`
- `npm run test -w apps/web -- dependency-check-modal.test.tsx`
- `npm run test -w apps/web`
- `npm run type-check`

## Manual Gates

- `openspec validate "unify-dependency-checks" --strict` must be executed by user terminal or platform.
- VerifyAndReview agent must run base validation, applicable UI automation, and code review after implementation.
