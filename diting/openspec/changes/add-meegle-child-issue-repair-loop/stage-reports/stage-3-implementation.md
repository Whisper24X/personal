# Stage 3 Implementation Report

Change: `add-meegle-child-issue-repair-loop`
Profile: `typescript`

## Summary

Implemented the Meegle parent-child issue repair loop with task-integration child issue capabilities, core fail-closed orchestration, explicit child issue sync, HTTP/UI support, Meegle CLI adapter behavior, and repair-only execution prompts.

`tasks.md` status: 10/10 implementation tasks marked complete.

## Completed Tasks

1. Plugin API child repair issue contract
   - Tests: `packages/core/src/titing/services.spec.ts`
   - Implementation: `packages/plugin-api/src/titing/plugins.ts`
   - RED: `openHumanRepairIssue` / `pullHumanRepairIssues` missing from `TaskIntegrationPlugin`
   - GREEN: added `HumanRepairIssueRequest`, `HumanRepairIssueRef`, `HumanRepairIssueReply` and optional plugin methods

2. Child issue metadata and gate helpers
   - Tests: `packages/core/src/titing/services.spec.ts`
   - Implementation: `packages/core/src/titing/service-shared.ts`
   - RED: `readReadyChildRepairDescription` and `buildChildRepairIssueIdempotencyKey` missing
   - GREEN: added exact `【开发中】` prefix parsing and stable SHA-256 idempotency key generation

3. Meegle quality failure opens or reuses child issue
   - Tests: `packages/core/src/titing/services.spec.ts`
   - Implementation: `packages/core/src/titing/service-execution.ts`
   - RED: first low-risk quality failure continued into repair instead of child issue flow
   - GREEN: Meegle quality failures create child repair issue metadata, set repair goal to `needs_human`, and avoid `goal.iteration_started`

4. Meegle child issue fail-closed
   - Tests: `packages/core/src/titing/services.spec.ts`
   - Implementation: `packages/core/src/titing/service-execution.ts`
   - RED: child issue creation errors caused task failure/repair path instead of controlled human wait
   - GREEN: `goal.child_issue_open_failed` is recorded and Meegle parent remains in `needs_human`

5. Explicit child issue sync command
   - Tests: `packages/core/src/titing/services.spec.ts`
   - Implementation: `packages/core/src/titing/services.ts`, `packages/core/src/titing/task-command-service.ts`
   - RED: `syncHumanRepairIssue` service method missing
   - GREEN: ready `false` leaves task in `needs_human`; ready `true` injects guidance, marks repair goal `repairing`, and queues the parent task

6. HTTP API endpoint
   - Tests: `apps/server/src/titing/server.spec.ts`
   - Implementation: `apps/server/src/titing/server.ts`
   - RED: `POST /api/tasks/:id/sync-human-repair-issue` returned 404
   - GREEN: added endpoint and mapped `ConflictError` to HTTP 409

7. Meegle CLI child task adapter
   - Tests: `apps/server/src/titing/plugins.spec.ts`
   - Implementation: `apps/server/src/titing/plugins/meegle.ts`
   - RED: `MeegleTaskIntegrationPlugin` lacked child repair issue methods
   - GREEN: added `child-task list/create/get` adapter behavior, idempotency marker parsing, and description readiness gate

8. Repair-only execution prompt
   - Tests: `apps/server/src/titing/plugins.spec.ts`
   - Implementation: `apps/server/src/titing/plugins/execution.ts`
   - RED: repair-only prompt lacked explicit no-full-reimplementation guard
   - GREEN: `metadata.humanLoop.executionMode === "repair_only"` replaces task prompt/acceptance scope and adds focused repair-only instructions

9. Web console button
   - Tests: `apps/web/src/App.spec.tsx`
   - Implementation: `apps/web/src/App.tsx`
   - RED: `needs_human` tasks with child metadata did not show `检查子任务方案`
   - GREEN: task detail action calls sync API, refreshes task list/details, and shows ready/not-ready feedback

10. Full verification task
   - Tests: target server/core/plugin tests, web App tests, type-check, full `npm test`, IDE diagnostics
   - Implementation: no additional runtime implementation; validation task completed after fixes for legacy expectations

## Code Review Follow-up Fixes

Stage 5 review found two behavior risks and one UI affordance issue. They were fixed with RED-GREEN regression coverage:

- `packages/core/src/titing/services.ts`: `retryTask` and `recoverTask` now reject Meegle tasks that are waiting on `metadata.humanLoop.childIssue`, forcing the explicit child issue sync path instead of bypassing the `【开发中】` gate.
- `apps/server/src/titing/plugins/meegle.ts`: child-task parsing now unwraps common envelope shapes such as `{ data: ... }`, `{ data: { children: [...] } }`, `children`, `items`, `list`, and `records`.
- `apps/web/src/App.tsx`: tasks waiting on a child repair issue no longer show the generic `Retry` action in the detail action row.

## Implementation Files

- `packages/plugin-api/src/titing/plugins.ts`
- `packages/core/src/titing/service-shared.ts`
- `packages/core/src/titing/service-execution.ts`
- `packages/core/src/titing/services.ts`
- `packages/core/src/titing/task-command-service.ts`
- `apps/server/src/titing/server.ts`
- `apps/server/src/titing/plugins/meegle.ts`
- `apps/server/src/titing/plugins/execution.ts`
- `apps/web/src/App.tsx`

## Test Files

- `packages/core/src/titing/services.spec.ts`
- `apps/server/src/titing/server.spec.ts`
- `apps/server/src/titing/plugins.spec.ts`
- `apps/web/src/App.spec.tsx`

## Exceptions

No task required a manual-only testing exception. All implementation tasks had automated coverage.
