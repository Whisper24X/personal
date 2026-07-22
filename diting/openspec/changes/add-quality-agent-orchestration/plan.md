# Quality Agent Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增独立的 `quality` Agent 阶段，让编码 Agent 完成实现后交由质检 Agent 编排 completion gate、质量检查、自动化证据检查、code review 和修复回流。

**Architecture:** 首版采用当前 task 在 `programming -> quality -> programming repair -> quality` 间切换的模型，不创建 quality 子 task。`QualityPlugin` 继续作为底层检查执行器，新增 quality orchestration 逻辑负责 handoff 校验、completion gate、quality evaluate、code review report、PR/MR 放行和 repair handoff。失败修复仍走现有 FailureRepairService / `repair_goals`，避免第二套修复协议。

**Tech Stack:** TypeScript, Jest, npm workspaces, `@diting/core`, `@diting/plugin-api`, `@diting/server`。

---

## Task 1: Agent kind 与调度基础

**Files:**

- Modify: `packages/core/src/diting/service-shared.ts`
- Modify: `packages/core/src/diting/agent-worker-pool.ts`
- Modify: `packages/core/src/diting/services.spec.ts`

- [ ] **Step 1: Write failing tests**

新增测试覆盖：

- 创建 `agentKind=quality` task 时默认 `driverId=quality-orchestrator`、`runtimeProviderId=codex`。
- `quality-agent-*` 只 claim `agentKind=quality` 的 ready task。

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts --runInBand`

Expected: FAIL，当前 quality 默认 driver/runtime 和 worker pool 支持尚未实现。

- [ ] **Step 2: Implement dispatch defaults**

在 `normalizeAgentRequest` 相关推断中为 `quality` 返回：

```ts
preferredDriver = "quality-orchestrator"
preferredRuntime = "codex" // executor=cursor 时为 cursor
```

在 `ServiceAgentWorkerPool` 的 supported set 中加入 `quality`。

- [ ] **Step 3: Run focused tests**

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts --runInBand`

Expected: PASS。

## Task 2: Quality handoff schema and artifact persistence

**Files:**

- Create: `packages/core/src/diting/quality-handoff.ts`
- Create: `packages/core/src/diting/quality-handoff.spec.ts`
- Create: `packages/core/src/diting/quality-artifacts.ts`
- Create: `packages/core/src/diting/quality-artifacts.spec.ts`

- [ ] **Step 1: Write failing schema tests**

测试 `ImplementationHandoff` 必填字段、缺 `baseSha` 失败、repo anchors 必须包含 `key/url/path/baseSha/headSha`、`QualityRepairHandoff` 结构。

Run: `npm run test -w apps/server -- packages/core/src/diting/quality-handoff.spec.ts --runInBand`

Expected: FAIL with missing module。

- [ ] **Step 2: Implement schemas and anchor validation**

实现：

- `QUALITY_HANDOFF_SCHEMA_VERSION = "2026-07-03"`
- `buildImplementationHandoff`
- `parseImplementationHandoff`
- `buildQualityRepairHandoff`
- `validateHandoffAnchors`

`validateHandoffAnchors` 必须按 repo `key/url/path/baseSha/headSha` 精确校验，`repos` 为空、repo 缺失、commit 缺失或 sha 不一致都返回 fail closed reason。

- [ ] **Step 3: Write failing artifact tests**

测试 `writeQualityJsonArtifact` 能写入：

- `implementation-handoff.json`
- `quality-report.json`
- `quality-repair-handoff.json`
- `code-review-report.json`

并返回 path。

Run: `npm run test -w apps/server -- packages/core/src/diting/quality-artifacts.spec.ts --runInBand`

Expected: FAIL with missing module。

- [ ] **Step 4: Implement artifact writer**

实现 `writeQualityJsonArtifact({ artifactsPath, filename, value })`，写 JSON 并返回 `{ path }`。调用方负责在写入失败时 fail closed 到 `waiting`。

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test -w apps/server -- packages/core/src/diting/quality-handoff.spec.ts packages/core/src/diting/quality-artifacts.spec.ts --runInBand
```

Expected: PASS。

## Task 3: Programming -> Quality handoff

**Files:**

- Modify: `packages/core/src/diting/service-execution.ts`
- Modify: `packages/core/src/diting/services.spec.ts`

- [ ] **Step 1: Write failing handoff test**

测试编程执行成功后：

- 不调用 `QualityPlugin.evaluate`。
- 写 `metadata.implementationHandoff` 与 `metadata.implementationHandoffPath`。
- 写 `artifacts/implementation-handoff.json`。
- task 切换为 `ready(quality)` / `driverId=quality-orchestrator`。
- transition 包含 `active->ready:Implementation handed to quality agent`。
- log 包含 `programming.completed_for_quality`。

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts --runInBand`

Expected: FAIL，当前编码成功仍内联进入 quality。

- [ ] **Step 2: Implement programming handoff**

在普通 programming task 执行成功后、completion gate 前，写 implementation handoff artifact，记录 metadata path，并通过状态迁移审计切到 `ready(quality)`。

- [ ] **Step 3: Run focused tests**

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts --runInBand`

Expected: PASS。

## Task 4: Quality orchestrator pass and fail-closed path

**Files:**

- Modify: `packages/core/src/diting/service-execution.ts`
- Modify: `packages/core/src/diting/services.spec.ts`

- [ ] **Step 1: Write failing pass path test**

测试 `ready(quality)` task：

- parse implementation handoff。
- 按 repo anchors 校验 workspace。
- 执行 completion gate。
- 调用 `QualityPlugin.evaluate`。
- 写 `artifacts/quality-report.json` 与 `metadata.qualityReportPath`。
- transition 包含 `active->succeeded:Quality orchestration passed`。
- log 包含 `quality.started`、`completion_gate.completed`、`eval.completed`、`quality.passed`。

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts --runInBand`

Expected: FAIL，当前没有 quality orchestration 分支。

- [ ] **Step 2: Write failing anchor and artifact failure tests**

新增测试覆盖：

- `repos` 为空时 fail closed 到 `waiting`。
- repo URL/path/base/head 不匹配时 fail closed 到 `waiting`。
- 无法读取 workspace commit 时 fail closed 到 `waiting`。
- artifact 写入失败时 fail closed 到 `waiting`。
- fail closed 不调用 completion gate 或 quality plugin。
- transition 包含 `active->waiting`。

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts --runInBand`

Expected: FAIL。

- [ ] **Step 3: Implement quality orchestration skeleton**

新增 `isQualityOrchestrationTask` 与 `runQualityOrchestration`。在 workspace prepared 后、普通编程循环前处理 quality task。缺 handoff、anchor 不一致或 artifact 写入失败时 `pauseForWait(type="environment_blocked")`。

- [ ] **Step 4: Run focused tests**

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts --runInBand`

Expected: PASS。

## Task 5: API/UI evidence and code review gates

**Files:**

- Create: `packages/core/src/diting/quality-evidence.ts`
- Create: `packages/core/src/diting/quality-evidence.spec.ts`
- Modify: `packages/core/src/diting/service-execution.ts`
- Modify: `packages/core/src/diting/services.spec.ts`

- [ ] **Step 1: Write failing evidence unit tests**

测试：

- API/UI evidence present 或明确 N/A 时通过。
- UI evidence missing 时失败。
- code review CRITICAL/IMPORTANT finding 失败。
- `code-review-report.json` 缺失时失败。

Run: `npm run test -w apps/server -- packages/core/src/diting/quality-evidence.spec.ts --runInBand`

Expected: FAIL with missing module。

- [ ] **Step 2: Implement evidence evaluator**

实现 `evaluateQualityEvidence`。适用性读取优先级：

1. `task.metadata.qualityRequirements.automation`
2. `implementationHandoff.artifactPaths`
3. `quality.report.automationReports`

只有明确 `not_applicable` 且有 reason 时才可 N/A。

- [ ] **Step 3: Write failing code review integration tests**

测试 quality orchestration 必须调用只读 review runtime，并写 `artifacts/code-review-report.json`。报告至少包含：

- `schemaVersion`
- `reviewArtifactId`
- `executionId`
- `findings`
- `summary`

缺 report、缺 `reviewArtifactId`、runtime 非零退出或 report 写入失败时 fail closed，不允许放行。

- [ ] **Step 4: Implement review runtime gate**

quality runtime 执行只读 review prompt；结果写入 `code-review-report.json`。review report path 与 artifact id 写入 `quality-report.json` 和 repair handoff。

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test -w apps/server -- packages/core/src/diting/quality-evidence.spec.ts packages/core/src/diting/services.spec.ts --runInBand
```

Expected: PASS。

## Task 6: Quality failure -> programming repair handoff

**Files:**

- Modify: `packages/core/src/diting/service-execution.ts`
- Modify: `packages/core/src/diting/services.spec.ts`

- [ ] **Step 1: Write failing repair handoff tests**

测试 quality failure：

- 写 `artifacts/quality-report.json` 与 `metadata.qualityReportPath`。
- 写 `artifacts/quality-repair-handoff.json` 与 `metadata.qualityRepairHandoffPath`。
- 通过 FailureRepairService / `repair_goals` 记录 failure。
- 未达到停止条件时切回 `ready(programming)`。
- transition 包含 `active->ready:Quality failed; returned to programming repair`。
- log 包含 `quality.failed_for_repair` 与 `repair.returned_to_programming`。

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts --runInBand`

Expected: FAIL。

- [ ] **Step 2: Implement repair handoff**

复用现有 `recordFailureRepair`、`buildFailureHash`、`decideStopReason`、`buildRepairObjective`、`buildRepairConstraints`、`buildRepairDoneWhen`。写 quality report 与 repair handoff artifact 后，未达到停止条件时通过 transition 审计切回 programming。

- [ ] **Step 3: Write failure compatibility tests**

覆盖：

- budget limited -> `failed`，transition 包含 `active->failed`。
- repeated failure / no effective diff 不回到 programming。
- Meegle child repair issue 可用时仍写现有 `failureRepair` metadata。

- [ ] **Step 4: Run focused tests**

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts --runInBand`

Expected: PASS。

## Task 7: Quality agent plugin selection and server assembly

**Files:**

- Modify: `packages/core/src/diting/plugin-runtime.spec.ts`
- Modify: `apps/server/src/diting/plugins/execution.ts`
- Modify: `apps/server/src/diting/plugins/index.ts`
- Modify: `apps/server/src/diting/plugins.spec.ts`

- [ ] **Step 1: Write failing runtime selection tests**

测试 runtime 可按 `agentKind=quality`、`driverId=quality-orchestrator`、`runtimeProviderId=codex/cursor` 和 `capability=review` 选择 quality agent plugin。

Run: `npm run test -w apps/server -- packages/core/src/diting/plugin-runtime.spec.ts --runInBand`

Expected: FAIL 或 PASS；若 FAIL，补齐 selection 逻辑。

- [ ] **Step 2: Implement quality runtime providers**

在 server execution plugin 中注册 Codex/Cursor quality orchestrator agent plugin：

```text
agentKind = quality
driverId = quality-orchestrator
capabilities = quality, review, <runtime-provider>
```

Prompt 必须约束只读审查与报告，不允许改业务代码。

- [ ] **Step 3: Write server assembly test**

测试 `createRuntimePlugins` 包含 quality orchestrator agent plugin。

Run: `npm run test -w apps/server -- apps/server/src/diting/plugins.spec.ts --runInBand`

Expected: PASS。

## Task 8: Observability and diagnostics

**Files:**

- Modify: `packages/core/src/diting/run-observability.spec.ts`
- Modify: `packages/core/src/diting/run-observability.ts`
- Modify: `apps/server/src/diting/diagnose-task.spec.ts`
- Modify: `apps/server/src/diting/diagnose-task.ts`

- [ ] **Step 1: Write failing observability tests**

测试事件映射：

- `programming.completed_for_quality`
- `quality.started`
- `quality.passed`
- `quality.failed_for_repair`
- `repair.returned_to_programming`

Run: `npm run test -w apps/server -- packages/core/src/diting/run-observability.spec.ts --runInBand`

Expected: FAIL。

- [ ] **Step 2: Implement event mapping**

将 quality 事件映射到 `quality` stage，将 repair handoff 事件映射到 `repair` stage。

- [ ] **Step 3: Write diagnose tests**

当 task metadata 包含 `implementationHandoffPath`、`qualityReportPath`、`qualityRepairHandoffPath` 时，diagnose 输出包含这些路径和摘要键。

Run:

```bash
npm run test -w apps/server -- packages/core/src/diting/run-observability.spec.ts apps/server/src/diting/diagnose-task.spec.ts --runInBand
```

Expected: PASS。

## Task 9: Documentation and final verification

**Files:**

- Modify: `docs/architecture/diting-technical-design.md`
- Modify: `docs/architecture/diting-open-tasks.md`

- [ ] **Step 1: Update architecture docs**

记录 `agentKind=quality`、`driverId=quality-orchestrator`、Quality Agent 与 `QualityPlugin` 的职责边界。

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm run test -w apps/server -- packages/core/src/diting/quality-handoff.spec.ts packages/core/src/diting/quality-artifacts.spec.ts packages/core/src/diting/quality-evidence.spec.ts packages/core/src/diting/plugin-runtime.spec.ts packages/core/src/diting/run-observability.spec.ts packages/core/src/diting/services.spec.ts apps/server/src/diting/plugins.spec.ts apps/server/src/diting/diagnose-task.spec.ts --runInBand
```

Expected: PASS。

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test -- --runInBand
npm run type-check
npm run build
```

Expected: PASS。
