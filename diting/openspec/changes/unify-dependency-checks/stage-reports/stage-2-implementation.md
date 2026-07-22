# Stage 2 Implementation Report

## Summary

- change-id: `unify-dependency-checks`
- tech stack profile: `typescript` monorepo with npm workspaces
- implementation result: autonomous implementation tasks 1-6 completed
- manual tasks remaining: OpenSpec validation and VerifyAndReview

## Completed Tasks

- [x] 1. Add server dependency check types, registry, and sanitization.
- [x] 2. Add server providers and HTTP API for dependency checks.
- [x] 3. Connect required dependency checks to existing task preflight.
- [x] 4. Add web dependency check API helpers and modal component.
- [x] 5. Wire dependency check modal into the console.
- [x] 6. Add UI verification material for the quality agent.

Manual/external gates remain unchecked in `tasks.md`:

- [ ] 7. User or platform runs OpenSpec validation.
- [ ] 8. VerifyAndReview agent runs base validation, applicable UI automation, and code review after implementation.

## Implementation Files

Server:

- `apps/server/src/diting/dependency-checks/types.ts`
- `apps/server/src/diting/dependency-checks/registry.ts`
- `apps/server/src/diting/dependency-checks/providers.ts`
- `apps/server/src/diting/dependency-checks/service.ts`
- `apps/server/src/diting/dependency-checks/index.ts`
- `apps/server/src/diting/dependency-checks.spec.ts`
- `apps/server/src/diting/server.ts`
- `apps/server/src/diting/server-integration.ts`
- `apps/server/src/diting/plugins/task-preflight.ts`
- `apps/server/src/diting/server.spec.ts`
- `apps/server/src/diting/plugins.spec.ts`

Web:

- `apps/web/src/dependency-checks.ts`
- `apps/web/src/dependency-check-modal.tsx`
- `apps/web/src/dependency-check-modal.test.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/i18n/en.ts`
- `apps/web/src/i18n/zh.ts`
- `apps/web/src/styles.css`

Verification material:

- `TEST.md`
- `openspec/changes/unify-dependency-checks/tasks.md`

## RED / GREEN / REFACTOR

### Task 1

- RED: `npm run test -w apps/server -- dependency-checks.spec.ts` failed because `./dependency-checks/registry` and `./dependency-checks/types` did not exist.
- GREEN: added dependency check types, sanitization, registry, and index exports.
- REFACTOR: kept public metadata whitelisted and sanitized sensitive details.
- Verify: `npm run test -w apps/server -- dependency-checks.spec.ts` passed.

### Task 2

- RED: `npm run test -w apps/server -- dependency-checks.spec.ts` failed because `./dependency-checks/providers` did not exist.
- GREEN: added providers, service summary, index exports, and `/api/dependency-checks` / `/api/dependency-checks/recheck` routes.
- REFACTOR: kept dependency-check degraded separate from `/api/readiness`.
- Verify: `npm run test -w apps/server -- dependency-checks.spec.ts` and `npm run test -w apps/server -- server.spec.ts --runInBand` passed.

### Task 3

- RED: `npm run test -w apps/server -- plugins.spec.ts --runInBand` failed with `Expected 2 arguments, but got 3` for `runTaskPreflight`.
- GREEN: added optional dependency check lister to `runTaskPreflight`, inferred programming dependency requirements, and injected `DependencyCheckService` through `buildServerServiceHooks`.
- REFACTOR: preserved existing preflight result shape and wait reason behavior.
- Verify: `npm run test -w apps/server -- plugins.spec.ts --runInBand -t "adds required dependency check failures"` passed.

### Task 4

- RED: `npm run test -w apps/web -- dependency-check-modal.test.tsx` failed because `dependency-check-modal` did not exist.
- GREEN: added web dependency check API types/helpers and modal component.
- REFACTOR: fixed test cleanup isolation and kept modal props focused.
- Verify: `npm run test -w apps/web -- dependency-check-modal.test.tsx` passed.

### Task 5

- RED: extended modal behavior tests to protect skip semantics.
- GREEN: wired dependency checks into `App.tsx`, added top-level dependency check entry, recheck behavior, Meegle/GitLab action routing, i18n keys, and styles.
- REFACTOR: reused existing authorization functions and existing modal/card style primitives.
- Verify: `npm run test -w apps/web -- dependency-check-modal.test.tsx` and `npm run type-check:web` passed.

### Task 6

- RED: UI verification material was absent.
- GREEN: created `TEST.md` with H5 cases for open, re-check, skip, Meegle/GitLab authorization, and sensitive information boundaries.
- REFACTOR: kept cases browser-executable through the Diting web console.
- Verify: `npm run type-check` passed.

## Verification Commands

Passed:

- `npm run test -w apps/server -- dependency-checks.spec.ts`
- `npm run test -w apps/server -- server.spec.ts --runInBand`
- `npm run test -w apps/server -- plugins.spec.ts --runInBand -t "adds required dependency check failures"`
- `npm run test -w apps/web -- dependency-check-modal.test.tsx`
- `npm run type-check:web`
- `npm run type-check`
- Editor diagnostics via ReadLints: no linter errors found for edited files.

Known command limitations:

- Full `npm run test -w apps/server -- plugins.spec.ts --runInBand` hit sandbox `EPERM` failures in unrelated git/tmp tests; the new dependency preflight test passes when targeted.
- `npm run test -w packages/core -- services.spec.ts --runInBand -t "preflight"` cannot run because `packages/core` has no `test` script.

## Automation Material

- `TEST.md` prepared for VerifyAndReview UI automation.
- Implementation phase did not run or claim API/UI automation, Code Review, or Archive.

## Completion Gate

All autonomous coding tasks are complete and verified. Implementation can be handed off to VerifyAndReview for base validation, UI automation, and code review.
