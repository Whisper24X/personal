# Tasks: unify-dependency-checks

## Autonomous Implementation Tasks

- [x] 1. Add server dependency check types, registry, and sanitization.
  - RED: add `apps/server/src/diting/dependency-checks.spec.ts` tests for registry filtering and sensitive field redaction.
  - GREEN: create `apps/server/src/diting/dependency-checks/types.ts`, `registry.ts`, and `index.ts`.
  - REFACTOR: keep public output fields whitelisted and avoid raw CLI output in `detail`.
  - Verify: `npm run test -w apps/server -- dependency-checks.spec.ts`.

- [x] 2. Add server providers and HTTP API for dependency checks.
  - RED: add server tests for Meegle, GitLab, coding runtime provider mapping and `GET /api/dependency-checks` / `POST /api/dependency-checks/recheck`.
  - GREEN: create `providers.ts` and `service.ts`; mount routes in `apps/server/src/diting/server.ts`.
  - REFACTOR: isolate dependency check degraded state from `/api/readiness`.
  - Verify: `npm run test -w apps/server -- dependency-checks.spec.ts` and `npm run test -w apps/server -- plugins.spec.ts --runInBand`.

- [x] 3. Connect required dependency checks to existing task preflight.
  - RED: add tests showing required dependency failure enters `waiting` with `environment_blocked` and non-required GitLab failure does not block unrelated tasks.
  - GREEN: update `apps/server/src/diting/server-integration.ts` and `apps/server/src/diting/plugins/task-preflight.ts` to evaluate required dependency checks through existing `runPreflight`.
  - REFACTOR: ensure submit, execution-before-environment, and product-to-programming handoff all use the same preflight result shape.
  - Verify: `npm run test -w apps/server -- plugins.spec.ts --runInBand` and `npm run test -w packages/core -- services.spec.ts --runInBand`.

- [x] 4. Add web dependency check API helpers and modal component.
  - RED: add `apps/web/src/dependency-check-modal.test.tsx` tests for ready progress, grouped cards, Required / Optional badges, action callbacks, `Re-check`, and `Skip for now`.
  - GREEN: create `apps/web/src/dependency-checks.ts` and `apps/web/src/dependency-check-modal.tsx`.
  - REFACTOR: keep modal props focused on summary, checking state, authorize callback, recheck callback, and close callback.
  - Verify: `npm run test -w apps/web -- dependency-check-modal.test.tsx`.

- [x] 5. Wire dependency check modal into the console.
  - RED: add or extend web tests for skip behavior and modal entry behavior.
  - GREEN: update `apps/web/src/App.tsx` to fetch dependency checks, show the modal entry, recheck dependencies, and route Meegle/GitLab actions to existing authorization functions.
  - REFACTOR: synchronize `apps/web/src/i18n/en.ts`, `apps/web/src/i18n/zh.ts`, and `apps/web/src/styles.css` without introducing a new UI library.
  - Verify: `npm run test -w apps/web` and `npm run type-check:web`.

- [x] 6. Add UI verification material for the quality agent.
  - RED: document H5 UI cases before claiming UI coverage.
  - GREEN: create or update `TEST.md` with dependency check modal cases for open, re-check, skip, Meegle/GitLab authorization actions, and no sensitive code in dependency check aggregation.
  - REFACTOR: keep cases browser-executable through the existing H5 console, not native-only.
  - Verify: `npm run type-check` and hand off `TEST.md` for VerifyAndReview Playwright execution.

## Manual / External Gates

- [ ] 7. User or platform runs OpenSpec validation.
  - Required command: `openspec validate "unify-dependency-checks" --strict`.
  - This is a manual/platform step because Agent shell must not rely on non-interactive OpenSpec CLI behavior.

- [ ] 8. VerifyAndReview agent runs base validation, applicable UI automation, and code review after implementation.
  - Required evidence: server tests, web tests, `npm run type-check`, H5 UI evidence from `TEST.md`, and code review report.

## Completion Gate

Implementation phase may mark tasks 1-6 complete only after corresponding RED/GREEN/REFACTOR and verification evidence exists. Manual tasks 7-8 stay unchecked during coding implementation.
