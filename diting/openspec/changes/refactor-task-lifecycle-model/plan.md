# diting 任务生命周期模型改造实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 diting 的任务状态从 13 态混合模型改造为 7 态 Task 主生命周期，并将执行阶段和等待原因分别下沉到 Attempt 与 WaitReason。

**Architecture:** `TaskStatus` 只保留 `draft/ready/active/waiting/succeeded/failed/cancelled`，所有执行细节由 claim 级 `RunAttempt` 的 `AttemptStage` 表达，所有等待原因由 `WaitReason` 表达。服务层命令收敛为 `submitTask`、`claimTask`、`pauseForWait`、`resumeTask`、`retryTask`、`reopenTask` 等明确入口；`releaseTask` 仅作为调度器内部 claim 释放命令。调度、执行编排、HTTP、持久化和 UI 同步迁移。

**Tech Stack:** TypeScript / Node.js / npm workspaces / Jest / Fastify / SQLite adapter。

---

## OpenSpec Artifact Prerequisite

本计划只能在阶段 2 OpenSpec artifacts 完成并经用户确认后执行。阶段 2 必须先创建并验证以下制品：

- `openspec/changes/refactor-task-lifecycle-model/proposal.md`
- `openspec/changes/refactor-task-lifecycle-model/specs/task-lifecycle/spec.md`
- `openspec/changes/refactor-task-lifecycle-model/specs/run-attempt/spec.md`
- `openspec/changes/refactor-task-lifecycle-model/specs/wait-reason/spec.md`
- `openspec/changes/refactor-task-lifecycle-model/specs/execution-orchestration/spec.md`
- `openspec/changes/refactor-task-lifecycle-model/specs/scheduler/spec.md`
- `openspec/changes/refactor-task-lifecycle-model/specs/http-api/spec.md`
- `openspec/changes/refactor-task-lifecycle-model/specs/persistence/spec.md`
- `openspec/changes/refactor-task-lifecycle-model/tasks.md`
- `openspec/changes/refactor-task-lifecycle-model/workflow-state.md`

阶段 3 的实现任务必须从上述 `tasks.md` 读取并逐项 TDD 执行；不得直接跳过阶段 2 进入代码实现。

---

## File Structure

- Modify: `packages/plugin-api/src/diting/models.ts`，替换 `TaskStatus` 并新增 `AttemptStage`、`WaitReason`、必要的 Attempt 查询契约。
- Modify: `packages/core/src/diting/state-machine.ts`，替换状态迁移表。
- Modify: `packages/core/src/diting/state-machine.spec.ts`，用新主生命周期覆盖合法/非法迁移。
- Modify: `packages/core/src/diting/task-command-service.ts`，公开新命令入口。
- Modify: `packages/core/src/diting/services.ts`、`packages/core/src/diting/service-support.ts`，实现新命令和审计。
- Modify: `packages/core/src/diting/agent-worker-pool.ts`、`packages/core/src/diting/service-scheduler.ts`，将调度 claim 从 `queued/running` 迁移到 `ready/active`。
- Modify: `packages/core/src/diting/service-execution.ts`，Goal Loop 只推进 Attempt 阶段，最终推进 Task 到 `succeeded/failed/waiting`。
- Modify: `packages/core/src/diting/failure-repair-service.ts`、`packages/core/src/diting/human-intervention-service.ts`，使用 WaitReason 表达 blocked/needs-human 场景。
- Modify: `apps/server/src/diting/repositories.ts`，调整 claim SQL、状态映射和 Attempt/WaitReason 持久化读取。
- Modify: `apps/server/src/diting/server.ts`，HTTP 端点迁移到 submit/resume/reopen 等命令。
- Modify: `apps/web/src/App.tsx`，更新状态筛选、操作按钮和详情展示。
- Modify tests: `packages/core/src/diting/services.spec.ts`、`apps/server/src/diting/server.spec.ts`、`apps/server/src/diting/repositories.spec.ts`、`apps/web/src/App.spec.tsx` 等。

---

### Task 1: 更新任务主状态机契约

**Files:**
- Modify: `packages/plugin-api/src/diting/models.ts`
- Modify: `packages/core/src/diting/state-machine.ts`
- Test: `packages/core/src/diting/state-machine.spec.ts`

- [ ] **Step 1: Write the failing test**

在 `packages/core/src/diting/state-machine.spec.ts` 中先替换为新模型断言：

```ts
import { assertValidTransition } from "./state-machine";

describe("state machine", () => {
  it("accepts legal task lifecycle transitions", () => {
    expect(() => assertValidTransition("draft", "ready")).not.toThrow();
    expect(() => assertValidTransition("draft", "waiting")).not.toThrow();
    expect(() => assertValidTransition("ready", "active")).not.toThrow();
    expect(() => assertValidTransition("active", "succeeded")).not.toThrow();
    expect(() => assertValidTransition("active", "waiting")).not.toThrow();
    expect(() => assertValidTransition("active", "failed")).not.toThrow();
    expect(() => assertValidTransition("active", "ready")).not.toThrow();
    expect(() => assertValidTransition("waiting", "ready")).not.toThrow();
    expect(() => assertValidTransition("failed", "ready")).not.toThrow();
    expect(() => assertValidTransition("cancelled", "draft")).not.toThrow();
    expect(() => assertValidTransition("cancelled", "ready")).not.toThrow();
  });

  it("rejects execution stages as task statuses", () => {
    expect(() => assertValidTransition("ready", "evaluating" as never)).toThrow("Illegal task transition");
    expect(() => assertValidTransition("active", "repairing" as never)).toThrow("Illegal task transition");
  });

  it("keeps succeeded terminal", () => {
    expect(() => assertValidTransition("succeeded", "ready")).toThrow("Illegal task transition");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/server -- packages/core/src/diting/state-machine.spec.ts`

Expected: FAIL，因为 `TaskStatus` 尚未包含 `draft/ready/active/waiting/succeeded`。

- [ ] **Step 3: Write minimal implementation**

将 `TaskStatus` 替换为 7 态，新增 `AttemptStage` 与 `WaitReason` 类型；将 `ALLOWED_TRANSITIONS` 改为新主生命周期迁移表。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/server -- packages/core/src/diting/state-machine.spec.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

仅当用户明确要求提交时执行。

### Task 2: 收敛服务层命令语义

**Files:**
- Modify: `packages/core/src/diting/task-command-service.ts`
- Modify: `packages/core/src/diting/services.ts`
- Modify: `packages/core/src/diting/service-support.ts`
- Test: `packages/core/src/diting/services.spec.ts`

- [ ] **Step 1: Write the failing test**

在 `packages/core/src/diting/services.spec.ts` 增加命令语义测试：

```ts
it("resumes waiting tasks to ready with an audit trail", async () => {
  const services = createServicesHarness();
  const task = await services.createTask(makeCreateTaskInput());
  const waiting = await services.pauseForWait(task.id, {
    type: "human_input",
    source: "test",
    message: "need clarification",
    recoverableBy: "user"
  }, "tester");

  expect(waiting.status).toBe("waiting");

  const resumed = await services.resumeTask(task.id, "tester", "answered");

  expect(resumed.status).toBe("ready");
  await expectTransition(task.id, "waiting", "ready", "answered");
});
```

同时增加 `failed -> retryTask -> ready` 与 `cancelled -> reopenTask -> draft/ready` 的测试。

再增加 `active -> releaseTask -> ready` 测试，确保 Agent 心跳超时或瞬时失败不会被误写为业务 retry：

```ts
it("releases active tasks back to ready for transient scheduler failures", async () => {
  const services = createServicesHarness();
  const task = await services.createActiveTask();

  const released = await services.releaseTask(task.id, "agent heartbeat timeout", "scheduler");

  expect(released.status).toBe("ready");
  await expectTransition(task.id, "active", "ready", "agent heartbeat timeout");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts -t "resumes waiting tasks"`

Expected: FAIL，因为 `pauseForWait`、`resumeTask`、`reopenTask` 尚不存在。

- [ ] **Step 3: Write minimal implementation**

新增 `submitTask`、`pauseForWait`、`resumeTask`、`retryTask`、`reopenTask`、`completeTask`、`failTask` 命令，并将 `releaseTask` 限定为调度器内部 claim 释放命令；旧 `queueTask/recoverTask/blockTask/markNeedsHuman` 不再作为主要路径。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts -t "resumes waiting tasks"`

Expected: PASS。

- [ ] **Step 5: Commit**

仅当用户明确要求提交时执行。

### Task 3: 将调度和执行编排迁移到 active + RunAttempt/AttemptStage

**Files:**
- Modify: `packages/core/src/diting/agent-worker-pool.ts`
- Modify: `packages/core/src/diting/service-scheduler.ts`
- Modify: `packages/core/src/diting/service-execution.ts`
- Modify: `packages/plugin-api/src/diting/models.ts`
- Test: `packages/core/src/diting/services.spec.ts`

- [ ] **Step 1: Write the failing test**

在 `services.spec.ts` 增加：

```ts
it("keeps task active while execution moves through attempt stages", async () => {
  const harness = createServicesHarness({ qualityEnabled: true });
  const task = await harness.createReadyTask();

  await harness.runOneSchedulerTick();

  const updated = await harness.tasks.getById(task.id);
  const attempts = await harness.runAttempts.list({ taskId: task.id });
  const executions = await harness.executions.list({ taskId: task.id });

  expect(updated?.status).toBe("succeeded");
  expect(attempts).toHaveLength(1);
  expect(attempts[0].stage).toBe("completed");
  expect(executions.map((execution) => execution.status)).toContain("evaluating");
  expect(executions.at(-1)?.status).toBe("completed");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts -t "keeps task active"`

Expected: FAIL，因为当前调度仍使用 `queued -> running`，执行过程仍推进 Task 到 `evaluating/repairing/done`。

- [ ] **Step 3: Write minimal implementation**

将 claim 改为 `ready -> active`，创建 claim 级 RunAttempt；repair loop 中的多轮插件调用继续写多条 ExecutionRecord 并关联到当前 Attempt；`evaluating/repairing/completion_checking/creating_pr` 仅写 Attempt，不写 Task 主状态。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts -t "keeps task active"`

Expected: PASS。

- [ ] **Step 5: Commit**

仅当用户明确要求提交时执行。

### Task 4: 使用 WaitReason 替代 blocked 和 needs_human

**Files:**
- Modify: `packages/plugin-api/src/diting/models.ts`
- Modify: `packages/core/src/diting/failure-repair-service.ts`
- Modify: `packages/core/src/diting/human-intervention-service.ts`
- Modify: `packages/core/src/diting/service-execution.ts`
- Test: `packages/core/src/diting/failure-repair-service.spec.ts`
- Test: `packages/core/src/diting/services.spec.ts`

- [ ] **Step 1: Write the failing test**

新增策略测试：

```ts
it("pauses for environment blocked failures with a structured wait reason", async () => {
  const harness = createServicesHarness();
  const task = await harness.createActiveTask();

  const paused = await harness.services.pauseForWait(task.id, {
    type: "environment_blocked",
    source: "preflight",
    message: "missing credential",
    recoverableBy: "operator"
  }, "system");

  expect(paused.status).toBe("waiting");
  expect(paused.metadata.waitReason).toMatchObject({
    type: "environment_blocked",
    recoverableBy: "operator"
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts -t "structured wait reason"`

Expected: FAIL，因为当前仍使用 `blocked`/`needs_human`。

- [ ] **Step 3: Write minimal implementation**

将人工输入、审批、外部回复、环境阻塞、策略阻塞全部归一到 `waiting + metadata.waitReason` 或 WaitReason 仓储，并通过 `resumeTask` 恢复。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts -t "structured wait reason"`

Expected: PASS。

- [ ] **Step 5: Commit**

仅当用户明确要求提交时执行。

### Task 5: 更新持久化和历史状态迁移

**Files:**
- Modify: `apps/server/src/diting/repositories.ts`
- Modify: `apps/server/src/diting/run-migrations.ts` 或现有迁移入口
- Test: `apps/server/src/diting/repositories.spec.ts`
- Test: `apps/server/src/diting/repositories.integration.spec.ts`

- [ ] **Step 1: Write the failing test**

新增映射测试：

```ts
it("claims ready tasks as active", async () => {
  const repo = createTaskRepository();
  await repo.create(makeTask({ id: "task-1", status: "ready" }));

  const claimed = await repo.claimQueued("task-1", new Date("2026-06-22T00:00:00.000Z"));

  expect(claimed?.status).toBe("active");
});
```

后续实现可将 `claimQueued` 重命名为 `claimReady`，测试也应随之更新。

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/server -- apps/server/src/diting/repositories.spec.ts`

Expected: FAIL，因为 SQL 仍匹配 `queued` 并写入 `running`。

- [ ] **Step 3: Write minimal implementation**

更新 claim SQL、读取映射和迁移脚本，将旧状态迁移到新状态：`validated` 按输入和 preflight 判定 `draft/ready`，`pending` 保守迁移为 `draft`；同时保留 `task_transitions` 审计记录。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/server -- apps/server/src/diting/repositories.spec.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

仅当用户明确要求提交时执行。

### Task 6: 更新 HTTP API 和 Web 展示

**Files:**
- Modify: `apps/server/src/diting/server.ts`
- Modify: `apps/server/src/diting/server.spec.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/i18n/zh.ts`
- Modify: `apps/web/src/i18n/en.ts`
- Test: `apps/server/src/diting/server.spec.ts`
- Test: `apps/web/src/App.spec.tsx`

- [ ] **Step 1: Write the failing test**

新增 HTTP 测试：

```ts
it("resumes a waiting task through the resume endpoint", async () => {
  const app = await buildTestServer();
  const task = await createWaitingTask(app);

  const response = await app.inject({
    method: "POST",
    url: `/api/tasks/${task.id}/resume`,
    payload: { reason: "user replied" }
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().status).toBe("ready");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/server -- apps/server/src/diting/server.spec.ts -t "resume endpoint"`

Expected: FAIL，因为 `/resume` 尚不存在。

- [ ] **Step 3: Write minimal implementation**

新增或替换 `/submit`、`/resume`、`/retry`、`/reopen` 端点，前端状态筛选和按钮改为新主状态，详情区展示 Attempt/WaitReason。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/server -- apps/server/src/diting/server.spec.ts -t "resume endpoint"`

Expected: PASS。

- [ ] **Step 5: Commit**

仅当用户明确要求提交时执行。

### Task 7: 全量验证

**Files:**
- Modify: `openspec/changes/refactor-task-lifecycle-model/tasks.md`

- [ ] **Step 1: Run type check**

Run: `npm run type-check`

Expected: PASS。

- [ ] **Step 2: Run test all**

Run: `npm test`

Expected: PASS。

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS。

- [ ] **Step 4: Ask user to validate OpenSpec**

用户在终端执行：

```bash
openspec validate "refactor-task-lifecycle-model" --strict
```

Expected: exit 0。

- [ ] **Step 5: Commit**

仅当用户明确要求提交时执行。

## Self-Review

- Spec coverage：计划覆盖 Task 主状态、Attempt 阶段、WaitReason、命令语义、调度执行、持久化、HTTP、UI 和验证。
- Placeholder scan：无 TBD/TODO 占位；具体实现代码将在阶段 3 按 RED/GREEN/REFACTOR 写入。
- Type consistency：本文使用 `TaskStatus`、`AttemptStage`、`WaitReason`、`submitTask`、`pauseForWait`、`resumeTask`、`retryTask`、`reopenTask` 等名称，与设计文档一致。
