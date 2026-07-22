# Stage 4 Verification Report

## Commands

- `npm run test -w apps/server -- services.spec.ts -t "generated OpenSpec|OpenSpec handoff"`: PASS, focused product workflow and handoff tests passed.
- `npm run test -w apps/server -- plugins.spec.ts -t "OpenSpec review"`: PASS, focused Meegle review tests passed.
- `npm run test -w apps/server -- diagnose-task.spec.ts -t "OpenSpec local path"`: PASS, focused diagnosis test passed.
- `npm run type-check -w apps/server`: PASS.
- `npm run type-check`: PASS.
- `openspec validate add-generated-spec-attachment-return --strict`: PASS.
- `npm test`: FAIL, unrelated `LocalWorktreeEnvironmentPlugin › fetches an existing mirror cache when the task branch is checked out in another workspace` still fails when run alone because Git reports branch `feature/retry-fetch` is already checked out in the prepared temporary worktree.

## Coverage Check

- Product workflow `openspecPath` propagation, legacy skip, and approval metadata gate are covered in `packages/core/src/diting/services.spec.ts`.
- Meegle review child task path display is covered in `apps/server/src/diting/plugins.spec.ts`.
- Diagnostic visibility is covered in `apps/server/src/diting/diagnose-task.spec.ts`.

## Conclusion

Focused tests, OpenSpec validation, server type-check, and root type-check passed. Full `npm test` is blocked by an existing worktree checkout test failure outside this change path.
