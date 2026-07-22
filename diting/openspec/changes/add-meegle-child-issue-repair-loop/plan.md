# Meegle Child Issue Repair Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Meegle child issue repair loop where quality failures create or reuse a child task, wait for a `【开发中】` child description, then resume the parent task with repair-only context.

**Architecture:** Extend the existing `needs_human` and repair goal flow instead of adding a new task state. Meegle integrations get optional child repair issue capabilities; core execution fails closed into `needs_human` for Meegle quality failures, and a new task command/API/button explicitly checks the child task description before recovering the parent task.

**Tech Stack:** TypeScript monorepo, Jest for `apps/server` and `packages/core` tests, Vitest/Testing Library for `apps/web`, Fastify HTTP API, existing Meegle CLI wrapper.

---

## File Structure

- Modify: `packages/plugin-api/src/titing/plugins.ts`
  - Add child repair issue request/ref/reply types and optional `TaskIntegrationPlugin` methods.
- Modify: `packages/plugin-api/src/titing/models.ts`
  - Add optional repair-only metadata type if a shared model is needed.
- Modify: `packages/core/src/titing/service-shared.ts`
  - Add helpers to read/write child issue metadata, build repair-only goal content, and detect ready child descriptions.
- Modify: `packages/core/src/titing/service-execution.ts`
  - Intercept Meegle quality failures before automatic repair, create/reuse child issue, and move parent task to `needs_human`.
- Modify: `packages/core/src/titing/service-scheduler.ts`
  - Add explicit `syncHumanRepairIssue` command logic that checks one parent task's child issue.
- Modify: `packages/core/src/titing/services.ts`
  - Expose `syncHumanRepairIssue`.
- Modify: `packages/core/src/titing/task-command-service.ts`
  - Add command facade method if command service is used by UI/API wiring.
- Modify: `packages/core/src/titing/services.spec.ts`
  - Cover execution, fail-closed, explicit sync, readiness gate, and dedupe behavior.
- Modify: `apps/server/src/titing/server.ts`
  - Add `POST /api/tasks/:id/sync-human-repair-issue`.
- Modify: `apps/server/src/titing/server.spec.ts`
  - Cover the new HTTP command and 409 behavior.
- Modify: `apps/server/src/titing/plugins/meegle.ts`
  - Implement child task create/reuse/query using Meegle CLI.
- Modify: `apps/server/src/titing/plugins/shared.ts`
  - Add child task comment/body builders, CLI payload parsers, and description gate helpers.
- Modify: `apps/server/src/titing/plugins.spec.ts`
  - Cover Meegle child issue CLI fixtures, idempotency, and `【开发中】` gate.
- Modify: `apps/server/src/titing/plugins/execution.ts`
  - Add repair-only prompt rendering so recovered tasks do not rerun the full parent task.
- Modify: `apps/web/src/App.tsx`
  - Add task metadata typing, button state, API call, and ready/not-ready message.
- Modify: `apps/web/src/App.spec.tsx`
  - Cover button visibility, API call, ready false copy, and recovered refresh behavior.

## Task 1: Plugin API Contract

**Files:**
- Modify: `packages/plugin-api/src/titing/plugins.ts`
- Test: `packages/core/src/titing/services.spec.ts`

- [ ] **Step 1: Write the failing type-usage test**

Add a small compile-time/runtime fixture near the existing task integration harness in `packages/core/src/titing/services.spec.ts` that uses the new optional methods. The test should fail to compile before the plugin-api types exist.

```ts
it("accepts task integrations with child repair issue capabilities", async () => {
  const plugin = createTaskIntegrationPlugin([], [], [], []);
  plugin.openHumanRepairIssue = async (_task, request) => ({
    externalId: "child-1",
    title: "repair child",
    url: "https://meegle.example/child-1",
    idempotencyKey: request.idempotencyKey,
    reused: false
  });
  plugin.pullHumanRepairIssues = async () => [{
    taskId: "task-1",
    parentExternalId: "MEEGLE-1",
    childExternalId: "child-1",
    replyId: "child-1:1",
    ready: true,
    body: "修复 npm test failed",
    rawDescription: "【开发中】修复 npm test failed",
    updatedAt: "2026-06-09T00:00:00.000Z"
  }];

  await expect(plugin.openHumanRepairIssue(createTask({ id: "task-1", status: "needs_human" }), {
    requestId: "request-1",
    idempotencyKey: "idem-1",
    failureHash: "hash-1",
    failureSummary: "npm test failed",
    failedChecks: ["npm test"],
    executionId: "execution-1",
    evalResultId: "eval-1",
    stopReason: null,
    requestedAt: "2026-06-09T00:00:00.000Z"
  })).resolves.toEqual(expect.objectContaining({ externalId: "child-1" }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "accepts task integrations with child repair issue capabilities"`

Expected: FAIL with TypeScript errors that `openHumanRepairIssue`, `pullHumanRepairIssues`, and child repair issue types do not exist.

- [ ] **Step 3: Add minimal plugin-api types**

In `packages/plugin-api/src/titing/plugins.ts`, add:

```ts
export type HumanRepairIssueRequest = {
  requestId: string;
  idempotencyKey: string;
  failureHash: string;
  failureSummary: string;
  failedChecks: string[];
  executionId: string;
  evalResultId: string;
  stopReason: "high_risk" | "repeated_failure" | "no_effective_diff" | "budget_limited" | null;
  requestedAt: string;
};

export type HumanRepairIssueRef = {
  externalId: string;
  title: string;
  url: string | null;
  idempotencyKey: string;
  reused: boolean;
};

export type HumanRepairIssueReply = {
  taskId: string;
  parentExternalId: string;
  childExternalId: string;
  replyId: string;
  ready: boolean;
  body: string;
  rawDescription: string;
  updatedAt: string;
};
```

Extend `TaskIntegrationPlugin`:

```ts
openHumanRepairIssue?(task: TitingTask, request: HumanRepairIssueRequest): Promise<HumanRepairIssueRef>;
pullHumanRepairIssues?(tasks: TitingTask[]): Promise<HumanRepairIssueReply[]>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "accepts task integrations with child repair issue capabilities"`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

Do not commit unless explicitly requested. Note changed files for later staging.

## Task 2: Shared Child Issue Metadata Helpers

**Files:**
- Modify: `packages/core/src/titing/service-shared.ts`
- Test: `packages/core/src/titing/services.spec.ts`

- [ ] **Step 1: Write failing helper tests**

Add tests for the child description gate and idempotency key helper.

```ts
it("requires child repair descriptions to start with the exact development prefix", () => {
  expect(readReadyChildRepairDescription("【开发中】请修复测试")).toEqual("请修复测试");
  expect(readReadyChildRepairDescription(" 【开发中】前面有空格")).toBeNull();
  expect(readReadyChildRepairDescription("请修复测试")).toBeNull();
});

it("builds stable child repair idempotency keys from parent external id and failure hash", () => {
  const key = buildChildRepairIssueIdempotencyKey("MEEGLE-1", "failure-hash");
  expect(key).toMatch(/^titing-child-repair:[a-f0-9]{64}$/);
  expect(key).toBe(buildChildRepairIssueIdempotencyKey("MEEGLE-1", "failure-hash"));
  expect(key).not.toBe(buildChildRepairIssueIdempotencyKey("MEEGLE-2", "failure-hash"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "child repair"`

Expected: FAIL because `readReadyChildRepairDescription` and `buildChildRepairIssueIdempotencyKey` are missing.

- [ ] **Step 3: Implement helpers**

In `packages/core/src/titing/service-shared.ts`, add:

```ts
import { createHash } from "node:crypto";

const CHILD_REPAIR_READY_PREFIX = "【开发中】";

export function readReadyChildRepairDescription(rawDescription: string): string | null {
  if (!rawDescription.startsWith(CHILD_REPAIR_READY_PREFIX)) {
    return null;
  }
  return rawDescription.slice(CHILD_REPAIR_READY_PREFIX.length).trim();
}

export function buildChildRepairIssueIdempotencyKey(parentExternalId: string, failureHash: string): string {
  const digest = createHash("sha256")
    .update(parentExternalId)
    .update("\0")
    .update(failureHash)
    .digest("hex");
  return `titing-child-repair:${digest}`;
}
```

If `node:crypto` import already exists, merge imports instead of duplicating.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "child repair"`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

No commit unless explicitly requested.

## Task 3: Core Quality Failure Creates Child Issue

**Files:**
- Modify: `packages/core/src/titing/service-execution.ts`
- Modify: `packages/core/src/titing/service-shared.ts`
- Test: `packages/core/src/titing/services.spec.ts`

- [ ] **Step 1: Write failing quality-failed test**

Add a test next to the existing `needs_human` loop tests.

```ts
it("opens a Meegle child repair issue on first low-risk quality failure without auto repair", async () => {
  const openedIssues: Array<{ taskId: string; failureHash: string; stopReason: unknown }> = [];
  const harness = createHarness({
    tasks: [createTask({ id: "task-child-1", status: "queued" })],
    executions: [createExecutionResult({ exitCode: 0, sessionId: "codex:s1", summary: "tests failed" })],
    qualityResults: [{
      passed: false,
      score: 70,
      riskLevel: "low",
      checks: [{ name: "npm test", passed: false, detail: "1 failed" }],
      report: { diff: { filesChanged: 1, insertions: 5, deletions: 0 } }
    }],
    childRepairIssues: openedIssues,
    enableNeedsHumanLoop: true
  });
  const task = harness.tasks.get("task-child-1");
  if (!task) throw new Error("task missing");
  task.source = "meegle";
  task.externalId = "MEEGLE-CHILD-1";
  harness.tasks.set(task.id, cloneExistingTask(task));

  await harness.services.runSchedulerTick();

  expect(harness.tasks.get("task-child-1")?.status).toBe("needs_human");
  expect(openedIssues).toEqual([
    expect.objectContaining({
      taskId: "task-child-1",
      stopReason: null
    })
  ]);
  expect(harness.repairGoals.get("task-child-1")).toEqual(expect.objectContaining({
    status: "needs_human",
    objective: expect.stringContaining("npm test")
  }));
  expect(harness.logs.some((item) => item.eventType === "goal.iteration_started")).toBe(false);
});
```

Extend the harness helper with an optional `childRepairIssues` array and implement `openHumanRepairIssue` in the fake plugin to push request metadata.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "opens a Meegle child repair issue"`

Expected: FAIL because quality failures still enter repair flow and fake plugin child issue methods are not used.

- [ ] **Step 3: Implement minimal child issue branch**

In `ServiceExecution`, before the current repair transition after `evalResult.passed === false`, add a helper call like:

```ts
const childIssueHandled = await this.handleChildRepairIssueQualityFailure(
  currentTask,
  execution,
  nextGoal,
  failureHash,
  stopReason,
  result,
  evalResult,
  evalChecks,
  qualityPlugin.id,
  agent.id
);
if (childIssueHandled) {
  currentTask = childIssueHandled.task;
  goal = childIssueHandled.goal;
  break;
}
```

The helper should:

```ts
private async handleChildRepairIssueQualityFailure(...): Promise<{ task: TitingTask; goal: RepairGoal } | null> {
  if (task.source !== "meegle" || !task.externalId) return null;
  const integration = this.deps.runtime.getTaskIntegrations().find((plugin) =>
    plugin.id === task.source && plugin.openHumanRepairIssue && plugin.pullHumanRepairIssues
  );
  if (!integration?.openHumanRepairIssue) {
    return this.failClosedChildRepairIssue(...);
  }
  // build request, call integration, save metadata.humanLoop.childIssue, upsert goal needs_human, transition task.
}
```

Do not route Meegle quality failures back into automatic repair.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "opens a Meegle child repair issue"`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

No commit unless explicitly requested.

## Task 4: Core Fail-Closed Behavior

**Files:**
- Modify: `packages/core/src/titing/service-execution.ts`
- Test: `packages/core/src/titing/services.spec.ts`

- [ ] **Step 1: Write failing fail-closed test**

```ts
it("fails closed when Meegle child repair issue creation is unavailable", async () => {
  const harness = createHarness({
    tasks: [createTask({ id: "task-child-fail", status: "queued" })],
    executions: [createExecutionResult({ exitCode: 0, sessionId: "codex:s1", summary: "tests failed" })],
    qualityResults: [{
      passed: false,
      score: 70,
      riskLevel: "low",
      checks: [{ name: "npm test", passed: false, detail: "1 failed" }],
      report: { diff: { filesChanged: 1, insertions: 5, deletions: 0 } }
    }],
    childRepairIssueError: new Error("child task type missing"),
    enableNeedsHumanLoop: true
  });
  const task = harness.tasks.get("task-child-fail");
  if (!task) throw new Error("task missing");
  task.source = "meegle";
  task.externalId = "MEEGLE-CHILD-FAIL";
  harness.tasks.set(task.id, cloneExistingTask(task));

  await harness.services.runSchedulerTick();

  expect(["needs_human", "blocked"]).toContain(harness.tasks.get("task-child-fail")?.status);
  expect(harness.logs.some((item) => item.eventType === "goal.child_issue_open_failed")).toBe(true);
  expect(harness.logs.some((item) => item.eventType === "goal.iteration_started")).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "fails closed when Meegle child repair issue creation is unavailable"`

Expected: FAIL because errors are not handled or auto repair continues.

- [ ] **Step 3: Implement fail-closed helper**

Add `failClosedChildRepairIssue` to `ServiceExecution`:

```ts
await this.support.appendExecutionLog(task, execution, "goal.child_issue_open_failed", message, {
  error: message,
  failureHash,
  evalResultId: evalResult.id,
  executionId: execution.id
}, this.support.buildCorrelation({ task, execution, agentId, pluginId: task.source }));

await this.deps.repairGoals.upsert({ ...goal, status: "needs_human", updatedAt: this.support.now() });
const needsHumanTask = await this.support.transitionTask(task, "needs_human", "Child repair issue unavailable", operator, execution);
needsHumanTask.completedAt = this.support.now();
await this.deps.tasks.save(needsHumanTask);
return { task: needsHumanTask, goal: { ...goal, status: "needs_human" } };
```

If transition to `needs_human` is not legal for the current status, use `blocked` only when the state machine requires it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "fails closed when Meegle child repair issue creation is unavailable"`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

No commit unless explicitly requested.

## Task 5: Explicit Child Issue Sync Command

**Files:**
- Modify: `packages/core/src/titing/service-scheduler.ts`
- Modify: `packages/core/src/titing/services.ts`
- Modify: `packages/core/src/titing/task-command-service.ts`
- Test: `packages/core/src/titing/services.spec.ts`

- [ ] **Step 1: Write failing sync tests**

```ts
it("does not recover when child repair issue description is not ready", async () => {
  const task = createTask({ id: "task-child-sync-1", status: "needs_human" });
  task.source = "meegle";
  task.externalId = "MEEGLE-SYNC-1";
  task.metadata = {
    humanLoop: {
      requestId: "request-1",
      requestedAt: "2026-06-09T00:00:00.000Z",
      seenReplyIds: [],
      childIssue: { externalId: "child-1", failureHash: "hash-1" }
    }
  };
  const harness = createHarness({
    tasks: [task],
    childRepairReplies: [{
      taskId: task.id,
      parentExternalId: "MEEGLE-SYNC-1",
      childExternalId: "child-1",
      replyId: "child-1:not-ready",
      ready: false,
      body: "",
      rawDescription: "还没准备好",
      updatedAt: "2026-06-09T00:05:00.000Z"
    }],
    enableNeedsHumanLoop: true
  });

  const result = await harness.services.syncHumanRepairIssue(task.id, "api");

  expect(result).toEqual(expect.objectContaining({ ready: false, recovered: false }));
  expect(harness.tasks.get(task.id)?.status).toBe("needs_human");
});

it("recovers parent task when child repair issue description is ready", async () => {
  // same setup, but reply ready true with body "修复 npm test failed"
  const result = await harness.services.syncHumanRepairIssue(task.id, "api");
  expect(result).toEqual(expect.objectContaining({ ready: true, recovered: true }));
  expect(harness.tasks.get(task.id)?.status).toBe("queued");
  expect(harness.repairGoals.get(task.id)?.constraints.at(-1)).toContain("Human guidance: 修复 npm test failed");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "child repair issue description"`

Expected: FAIL because `syncHumanRepairIssue` does not exist.

- [ ] **Step 3: Implement service command**

Add a return type:

```ts
type HumanRepairIssueSyncResult = {
  ready: boolean;
  recovered: boolean;
  childExternalId: string | null;
  replyId: string | null;
  summary: string;
};
```

Implement `syncHumanRepairIssue(id, operator = "system")` in `TitingServices` and delegate into scheduler/service helper. It should:

- load the task and validate `status === "needs_human"`;
- validate `source === "meegle"` and `metadata.humanLoop.childIssue`;
- call `integration.pullHumanRepairIssues([task])`;
- choose the reply matching the child external ID;
- return `ready: false` without state transition when not ready;
- update instruction, metadata, repair goal, and transition to `queued` when ready;
- skip duplicate `replyId`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "child repair issue description"`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

No commit unless explicitly requested.

## Task 6: HTTP API Endpoint

**Files:**
- Modify: `apps/server/src/titing/server.ts`
- Modify: `apps/server/src/titing/server.spec.ts`

- [ ] **Step 1: Write failing route tests**

In `apps/server/src/titing/server.spec.ts`, add:

```ts
it("syncs a task child repair issue through the task command API", async () => {
  const state = createState({
    syncHumanRepairIssue: async (id: string, operator: string) => ({
      ready: true,
      recovered: true,
      childExternalId: "child-1",
      replyId: "child-1:ready",
      summary: `${operator}:${id}:ready`
    })
  });
  const server = await buildServerWithState(state, { startScheduler: false });
  try {
    const response = await server.inject({ method: "POST", url: "/api/tasks/task-1/sync-human-repair-issue" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expect.objectContaining({
      ready: true,
      recovered: true,
      childExternalId: "child-1"
    }));
  } finally {
    await server.close();
  }
});

it("returns 409 when child repair issue sync is not valid for the task", async () => {
  const state = createState({
    syncHumanRepairIssue: async () => {
      const error = new Error("Task is not waiting for a child repair issue");
      error.name = "ConflictError";
      throw error;
    }
  });
  const server = await buildServerWithState(state, { startScheduler: false });
  try {
    const response = await server.inject({ method: "POST", url: "/api/tasks/task-1/sync-human-repair-issue" });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "Task is not waiting for a child repair issue" });
  } finally {
    await server.close();
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w apps/server -- apps/server/src/titing/server.spec.ts -t "child repair issue"`

Expected: FAIL because route and conflict mapping do not exist.

- [ ] **Step 3: Implement route and conflict response**

In `server.ts`, add near existing task commands:

```ts
fastify.post("/api/tasks/:id/sync-human-repair-issue", async (request: FastifyRequest, reply: FastifyReply) => {
  const params = request.params as { id: string };
  try {
    return await state.services.syncHumanRepairIssue(params.id, "api");
  } catch (error) {
    if (error instanceof Error && error.name === "ConflictError") {
      return reply.status(409).send({ error: error.message });
    }
    throw error;
  }
});
```

Update the test `ServiceState` type/mock to include `syncHumanRepairIssue`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w apps/server -- apps/server/src/titing/server.spec.ts -t "child repair issue"`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

No commit unless explicitly requested.

## Task 7: Meegle Child Task Adapter

**Files:**
- Modify: `apps/server/src/titing/plugins/meegle.ts`
- Modify: `apps/server/src/titing/plugins/shared.ts`
- Test: `apps/server/src/titing/plugins.spec.ts`

- [ ] **Step 1: Write failing Meegle fixture tests**

Add tests in `plugins.spec.ts` using the existing command mock style:

```ts
it("creates a Meegle child repair issue with a stable idempotency marker", async () => {
  const plugin = createMeeglePluginWithCommandMocks([
    {
      argsIncludes: ["workitem", "query"],
      stdout: JSON.stringify({ data: [] })
    },
    {
      argsIncludes: ["workitem", "create"],
      stdout: JSON.stringify({ data: { id: "child-1", name: "【titing修复方案】Fix build" } })
    }
  ]);
  const task = createMeegleTask("MEEGLE-1");

  const ref = await plugin.openHumanRepairIssue?.(task, {
    requestId: "request-1",
    idempotencyKey: "titing-child-repair:abc",
    failureHash: "hash-1",
    failureSummary: "npm test failed",
    failedChecks: ["npm test"],
    executionId: "execution-1",
    evalResultId: "eval-1",
    stopReason: null,
    requestedAt: "2026-06-09T00:00:00.000Z"
  });

  expect(ref).toEqual(expect.objectContaining({
    externalId: "child-1",
    idempotencyKey: "titing-child-repair:abc",
    reused: false
  }));
});

it("returns ready child repair issue replies only when description starts with development prefix", async () => {
  const plugin = createMeeglePluginWithCommandMocks([
    {
      argsIncludes: ["workitem", "get"],
      stdout: JSON.stringify({ data: { id: "child-1", fields: { "子任务描述": "【开发中】修复 npm test failed" } } })
    }
  ]);
  const task = createMeegleNeedsHumanTaskWithChild("MEEGLE-1", "child-1");

  const replies = await plugin.pullHumanRepairIssues?.([task]);

  expect(replies).toEqual([
    expect.objectContaining({
      ready: true,
      body: "修复 npm test failed",
      childExternalId: "child-1"
    })
  ]);
});
```

Use actual helper names from existing `plugins.spec.ts`; if no helper exists, create narrow local helpers in the test.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w apps/server -- apps/server/src/titing/plugins.spec.ts -t "child repair issue"`

Expected: FAIL because Meegle plugin lacks child issue methods and parsers.

- [ ] **Step 3: Implement minimal Meegle methods**

In `meegle.ts`:

```ts
async openHumanRepairIssue(task: TitingTask, request: HumanRepairIssueRequest): Promise<HumanRepairIssueRef> {
  const existing = await this.findExistingChildRepairIssue(task, request);
  if (existing) return { ...existing, reused: true };
  return this.createChildRepairIssue(task, request);
}

async pullHumanRepairIssues(tasks: TitingTask[]): Promise<HumanRepairIssueReply[]> {
  const replies = await Promise.all(tasks.map((task) => this.readChildRepairIssue(task)));
  return replies.filter((reply): reply is HumanRepairIssueReply => Boolean(reply));
}
```

Use Meegle CLI wrappers already present:

- query child tasks under parent development node;
- create workitem of type `任务`;
- read `子任务描述` field from child task detail;
- parse `【开发中】` with the shared helper;
- include `titing:parent=...;failure=...;request=...` marker in child title or description.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w apps/server -- apps/server/src/titing/plugins.spec.ts -t "child repair issue"`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

No commit unless explicitly requested.

## Task 8: Repair-Only Execution Prompt

**Files:**
- Modify: `apps/server/src/titing/plugins/execution.ts`
- Test: `apps/server/src/titing/plugins.spec.ts`

- [ ] **Step 1: Write failing prompt test**

Add a unit test around the execution plugin command prompt construction using the existing executor command mock.

```ts
it("renders repair-only prompts without rerunning the full parent task", async () => {
  const { plugin, commands } = createExecutorPluginHarness();
  const task = createTask({
    instruction: "Implement the entire original feature",
    acceptanceCriteria: ["All original acceptance criteria"]
  });
  task.metadata = { humanLoop: { executionMode: "repair_only" } };
  const goal = createRepairGoal({
    objective: "Fix npm test",
    doneWhen: ["Pass npm test"],
    constraints: ["Human guidance: 修复断言"]
  });

  await plugin.execute(task, createWorkspace(), goal);

  const prompt = commands.at(0)?.args.join(" ") ?? "";
  expect(prompt).toContain("Fix npm test");
  expect(prompt).toContain("Human guidance: 修复断言");
  expect(prompt).not.toContain("Implement the entire original feature");
  expect(prompt).not.toContain("All original acceptance criteria");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/server -- apps/server/src/titing/plugins.spec.ts -t "repair-only prompts"`

Expected: FAIL because current prompt always renders `task.instruction` and full acceptance criteria.

- [ ] **Step 3: Implement repair-only variables**

In `execution.ts`, update `buildWorkflowVariables`:

```ts
const repairOnly = goal && readExecutionMode(task.metadata) === "repair_only";
return {
  ...,
  taskPrompt: repairOnly
    ? "Repair-only execution: do not reimplement the full parent task. Fix only the repair goal failures."
    : task.instruction,
  acceptanceCriteria: repairOnly ? goal.doneWhen.join("\n") : task.acceptanceCriteria.join("\n"),
  ...
};
```

Add a local metadata reader or export one from `service-shared.ts` if core and server both need it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/server -- apps/server/src/titing/plugins.spec.ts -t "repair-only prompts"`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

No commit unless explicitly requested.

## Task 9: Web Console Button

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.spec.tsx`

- [ ] **Step 1: Write failing UI tests**

Add tests around the task detail action row:

```tsx
it("shows a child issue sync button for needs_human tasks with child issue metadata", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /^tasks$/i }));
  fireEvent.click(await screen.findByRole("button", { name: /needs human child task/i }));

  expect(await screen.findByRole("button", { name: /检查子任务方案|sync child issue/i })).not.toBeNull();
});

it("posts child issue sync and shows not-ready feedback", async () => {
  fetchMock.mockImplementationOnce(buildJsonResponse({ ready: false, recovered: false, summary: "子任务描述尚未以【开发中】开头" }));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /^tasks$/i }));
  fireEvent.click(await screen.findByRole("button", { name: /needs human child task/i }));
  fireEvent.click(await screen.findByRole("button", { name: /检查子任务方案|sync child issue/i }));

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/tasks/task-needs-human-child/sync-human-repair-issue"),
      expect.objectContaining({ method: "POST" })
    );
  });
  expect(await screen.findByText(/尚未以/)).not.toBeNull();
});
```

Update test fixtures to include a `needs_human` task with:

```ts
metadata: {
  humanLoop: {
    childIssue: {
      externalId: "child-1",
      failureHash: "hash-1"
    }
  }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w apps/web -- src/App.spec.tsx -t "child issue sync"`

Expected: FAIL because the button and metadata typing do not exist.

- [ ] **Step 3: Implement UI action**

In `App.tsx`:

- extend `Task` type with `source`, `externalId`, and `metadata`;
- add a `childRepairSyncMessage` state;
- add `syncChildRepairIssue(taskId)` using `postJson`;
- add action row button when `selectedTask.status === "needs_human"` and `hasChildIssue(selectedTask.metadata)`.

Button example:

```tsx
<button className="secondary-button" onClick={() => void syncChildRepairIssue(selectedTask.id)} type="button">
  检查子任务方案
</button>
```

After success, call `refreshAll()` and `refreshTaskDetails(taskId)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -w apps/web -- src/App.spec.tsx -t "child issue sync"`

Expected: PASS.

- [ ] **Step 5: Checkpoint**

No commit unless explicitly requested.

## Task 10: Full Verification and OpenSpec Readiness

**Files:**
- Modify: `docs/superpowers/specs/2026-06-09-meegle-child-issue-repair-loop-plan.md`
- Later migrate to: `openspec/changes/add-meegle-child-issue-repair-loop/plan.md`

- [ ] **Step 1: Run server tests**

Run: `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts apps/server/src/titing/server.spec.ts apps/server/src/titing/plugins.spec.ts`

Expected: PASS.

- [ ] **Step 2: Run web tests**

Run: `npm run test -w apps/web -- src/App.spec.tsx`

Expected: PASS.

- [ ] **Step 3: Run type checks**

Run: `npm run type-check`

Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Read lints**

Use Cursor `ReadLints` for changed files:

- `packages/plugin-api/src/titing/plugins.ts`
- `packages/core/src/titing/service-shared.ts`
- `packages/core/src/titing/service-execution.ts`
- `packages/core/src/titing/service-scheduler.ts`
- `packages/core/src/titing/services.ts`
- `apps/server/src/titing/server.ts`
- `apps/server/src/titing/plugins/meegle.ts`
- `apps/server/src/titing/plugins/shared.ts`
- `apps/server/src/titing/plugins/execution.ts`
- `apps/web/src/App.tsx`

Expected: no new diagnostics.

- [ ] **Step 6: OpenSpec artifact handoff**

After this plan is accepted, ask the user to run:

```bash
/opsx-new add-meegle-child-issue-repair-loop
```

Then ask the user to paste `openspec instructions` output for `proposal.md`, `specs/<capability>/spec.md`, and `tasks.md` so the artifacts can be written under `openspec/changes/add-meegle-child-issue-repair-loop/`.

## Self-Review

- Spec coverage: parent/child issue model, `【开发中】` gate, explicit API/button trigger, fail-closed Meegle behavior, repair-only execution, idempotent child reuse, and tests are each mapped to a task.
- Placeholder scan: no `TBD`, no unresolved "implement later"; Meegle CLI exact command shape remains intentionally fixture-driven because the design requires validating the current CLI payload before implementation.
- Type consistency: `HumanRepairIssueRequest`, `HumanRepairIssueRef`, `HumanRepairIssueReply`, `openHumanRepairIssue`, `pullHumanRepairIssues`, and `syncHumanRepairIssue` are consistently named across tasks.
