# Stage 3 Implementation Report

## Completed Tasks

- 1.1-1.3: Updated `OpenSpecReviewIssueRequest` with `openspecPath` and removed generated OpenSpec archive upload types from `packages/plugin-api/src/diting/plugins.ts`.
- 2.1-2.6: Added product workflow tests and implementation in `packages/core/src/diting/services.spec.ts`, `packages/core/src/diting/service-execution.ts`, and `packages/core/src/diting/service-scheduler.ts`.
- 3.1-3.4: Added Meegle adapter test and local path review description implementation in `apps/server/src/diting/plugins.spec.ts` and `apps/server/src/diting/plugins/meegle.ts`.
- 4.1-4.3: Added review/diagnostic visibility and docs in `apps/server/src/diting/diagnose-task.spec.ts`, `apps/server/src/diting/diagnose-task.ts`, and `docs/architecture/diting-product-agent-usage.md`.

## TDD Evidence

- RED: `npm run test -w apps/server -- services.spec.ts -t "generated OpenSpec|OpenSpec handoff"` failed because core did not pass or require `openspecPath`.
- RED: `npm run test -w apps/server -- plugins.spec.ts -t "OpenSpec review"` failed because `OpenSpecReviewIssueRequest` did not expose `openspecPath`.
- RED: `npm run test -w apps/server -- diagnose-task.spec.ts -t "OpenSpec local path"` failed because diagnosis did not expose `openspecPath`.
- GREEN: The focused services, plugins, and diagnosis tests now pass.

## Implementation Summary

- Core computes `workspaceId/openspec/changes/<changeId>`, passes it as `openspecPath`, and records it in review metadata and diagnostics.
- Legacy `spec文档` attachments keep the existing path and do not trigger generated replacement uploads.
- Upload interface, zip packaging helpers, and generated attachment metadata writes were removed.
- Approved generated specs require `openspecPath` metadata before switching the task to programming.
- Meegle adapter writes the OpenSpec absolute path into the review child task description.

## Remaining

- Build verification is still pending under task 5.3 and phase 4.
