# Stage 5 Code Review Report

Change: `add-meegle-child-issue-repair-loop`
Reviewer: `code-reviewer` subagent

## Initial Review Findings

### CRITICAL: Old recover/retry paths bypassed child issue gate

`TitingServices.retryTask` and `TitingServices.recoverTask` allowed `needs_human` tasks to move back to `queued`. For Meegle parents waiting on `metadata.humanLoop.childIssue`, that bypassed the explicit `sync-human-repair-issue` path and the `【开发中】` description gate.

Fix:

- Added a core guard in `packages/core/src/titing/services.ts` that rejects Meegle `needs_human` / `blocked` tasks with child issue metadata.
- Added regression tests in `packages/core/src/titing/services.spec.ts` for retry and recover bypass attempts.
- Added a UI guard in `apps/web/src/App.tsx` so child-issue-waiting tasks no longer show the generic `Retry` action.
- Added regression coverage in `apps/web/src/App.spec.tsx`.

### IMPORTANT: Meegle child-task envelope parsing was incomplete

`extractChildRepairIssues` handled flat child-task responses, but real Meegle CLI `--envelope` output may wrap payloads under `{ data: ... }`, including `{ data: { children: [...] } }`. This could cause create/get/list parsing failures or idempotency reuse misses.

Fix:

- Added recursive envelope unwrapping in `apps/server/src/titing/plugins/meegle.ts`.
- Updated fake child-task `list/create/get` output in `apps/server/src/titing/plugins.spec.ts` to use `{ data: ... }` envelopes.

## Re-review Result

The reviewer rechecked the updated diff after fixes and reported:

- No remaining CRITICAL findings.
- No remaining IMPORTANT findings.
- The original gate-bypass and envelope parsing findings are resolved.
- The change can proceed to closeout.

## Verification After Review Fixes

- `npm run type-check`: PASS
- `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts apps/server/src/titing/server.spec.ts apps/server/src/titing/plugins.spec.ts`: PASS, 3 suites / 151 tests
- `npm run test -w apps/web -- src/App.spec.tsx`: PASS, 1 file / 17 tests
- `npm test`: PASS, server 14 suites / 192 tests, web 1 file / 17 tests
- `ReadLints`: PASS, no linter errors

## Residual Risk

- Documentation outside this OpenSpec change still describes generic recover/retry behavior and should mention the Meegle child repair issue exception during archive/docs sync.
- Meegle CLI field names may still vary beyond the compatibility list currently covered by the adapter; future real CLI samples should be added as fixtures if they diverge.
