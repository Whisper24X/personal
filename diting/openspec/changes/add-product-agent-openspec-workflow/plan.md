# Product Agent OpenSpec Workflow Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a product agent lane that can generate or import OpenSpec changes, send them through a Meegle review gate, and hand approved work to programming agents without making `spec.zip` a universal prerequisite.

**Architecture:** Keep the existing agent layering: task `agentKind` selects capacity, `driverId` selects the capability boundary, and Codex/Cursor are runtime providers below the driver. Implement a narrow vertical slice across plugin-api contracts, core worker/plugin selection, server preflight/workspace/bootstrap, and Meegle review parsing while preserving current programming-agent behavior.

**Tech Stack:** TypeScript monorepo, Jest for `apps/server` and `packages/core`, OpenSpec artifacts under this change directory.

---

### Task 1: Product agent contracts and worker dispatch

**Files:**
- Modify: `packages/plugin-api/src/diting/models.ts`
- Modify: `packages/plugin-api/src/diting/plugins.ts`
- Modify: `packages/core/src/diting/service-shared.ts`
- Modify: `packages/core/src/diting/plugin-runtime.ts`
- Modify: `packages/core/src/diting/agent-worker-pool.ts`
- Modify: `packages/core/src/diting/services.spec.ts`
- Modify: `packages/core/src/diting/plugin-runtime.spec.ts`

**TDD:** Add failing tests for product task normalization, product worker/task kind matching, and `openspec-product` plugin selection with Codex default / Cursor fallback. Implement only enough selection and worker matching to pass.

### Task 2: Workspace-first preflight and environment bootstrap

**Files:**
- Modify: `apps/server/src/diting/plugins/task-preflight.ts`
- Modify: `apps/server/src/diting/plugins/environment.ts`
- Modify: `apps/server/src/diting/plugins/workspace-tooling.ts`
- Modify: `apps/server/src/diting/plugins.spec.ts`

**TDD:** Add failing tests that product tasks without spec attachments pass preflight and get `task.md` plus `openspec/`, while legacy attachment imports still validate archives and product-handoff programming tasks fail closed without approved metadata.

### Task 3: Product runtime provider and review stop

**Files:**
- Modify: `apps/server/src/diting/plugins/execution.ts`
- Modify: `apps/server/src/diting/plugins/index.ts`
- Modify: `packages/core/src/diting/service-execution.ts`
- Modify: `packages/core/src/diting/state-machine.ts`
- Modify: `packages/core/src/diting/services.spec.ts`

**TDD:** Add failing tests that product execution records `agentKind=product`, `driverId=openspec-product`, and runtime provider metadata, then stops at `needs_human` without completion gate, quality, or PR.

### Task 4: Meegle OpenSpec review gate and handoff

**Files:**
- Modify: `packages/plugin-api/src/diting/plugins.ts`
- Modify: `packages/core/src/diting/services.ts`
- Modify: `packages/core/src/diting/service-scheduler.ts`
- Modify: `apps/server/src/diting/plugins/meegle.ts`
- Modify: `packages/core/src/diting/services.spec.ts`

**TDD:** Add failing tests for exact `【评审通过】`, `【需要修改】`, `【废弃】`, and unprefixed replies. Implement fail-closed handling and create/recover programming tasks only after approved handoff metadata is present.

### Task 5: Configuration, seed agents, and docs

**Files:**
- Modify: `apps/server/src/diting/config.ts`
- Modify: `apps/server/src/diting/config.spec.ts`
- Modify: `apps/server/src/diting/server.ts`
- Modify: `apps/server/src/diting/server.spec.ts`
- Modify: `README.md`
- Modify: `docs/architecture/diting-agent-architecture.md`
- Modify: `docs/architecture/diting-multi-repo-spec-workflow.md`

**TDD:** Add failing tests for `DITING_SCHEDULER_PRODUCT_AGENT_COUNT`, review prefix defaults, separate programming/product seed counts, and idle legacy preservation. Update focused docs after behavior is implemented.

### Task 6: Verification and artifacts

**Files:**
- Modify: `changes/add-product-agent-openspec-workflow/tasks.md`
- Create: `changes/add-product-agent-openspec-workflow/stage-reports/stage-3-implementation.md`
- Create: `changes/add-product-agent-openspec-workflow/stage-reports/stage-3.5-completion-gate.md`
- Create: `changes/add-product-agent-openspec-workflow/stage-reports/stage-4-verification.md`
- Create: `changes/add-product-agent-openspec-workflow/stage-reports/stage-5-code-review.md`
- Create: `changes/add-product-agent-openspec-workflow/stage-reports/stage-6-closeout.md`

**Verification:** Run focused Jest tests first, then `npm test -- --runInBand`, `npm run type-check`, and `npm run build`. OpenSpec CLI validation is documented as user-run/manual because this workspace stores active artifacts under `changes/` rather than `openspec/changes/`.

## Assumptions and Risks

- The prepared change is maintained at `changes/add-product-agent-openspec-workflow` and mirrored to the canonical workflow path `openspec/changes/add-product-agent-openspec-workflow`; reports and task state are kept identical across both copies.
- To avoid breaking ordinary manual programming tasks, the new approved-OpenSpec preflight requirement applies to programming tasks that explicitly declare `sourceProductTaskId` or `metadata.workflowRole=programming_from_product`.
- Product workspace bootstrap is implemented as an allowlist-style workspace mode that creates OpenSpec artifacts and review context; the product driver is constrained to OpenSpec/review artifacts and does not create code PRs.
