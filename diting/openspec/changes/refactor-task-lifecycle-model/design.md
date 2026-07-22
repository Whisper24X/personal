# diting 任务生命周期模型改造设计文档

## 澄清问题及结论

- 需求来源：`DITING_TASK_LIFECYCLE_OPTIMIZED.md` 已明确要求将任务主生命周期、执行尝试阶段、等待原因和重试恢复语义拆开。
- 本轮范围：只完成 `/openspec-superpowers-workflow` 的阶段 1 和阶段 2，不进入实现阶段。
- change-id：`refactor-task-lifecycle-model`。
- 技术栈 Profile：`typescript`。仓库是 npm workspaces monorepo，核心改造集中在 `packages/core`、`packages/plugin-api`、`apps/server` 和 `apps/web`。
- 测试策略：后续阶段 3 必须按 TDD 执行，优先使用 `npm run test -w apps/server -- <test-file>`、`npm run type-check`、`npm run build`。
- 兼容策略：按方案要求不保留旧状态兼容层，OpenSpec 和实现都以新模型为准；历史数据迁移在持久化任务中显式处理。

## 候选方案对比

### 方案 A：直接替换 Task 主状态，并复用现有 `executions` 作为 RunAttempt 基础

优点：
- 与目标方案最贴近，能一次性消除 `TaskStatus` 同时表达业务生命周期、执行阶段和等待原因的问题。
- 可在现有 `ExecutionRecord`/`executions` 基础上演进出 RunAttempt，减少全新存储模型的引入成本。
- UI 可自然变成列表展示 Task 主状态、详情展示 Attempt 阶段和 WaitReason。

缺点：
- 影响面最大，`state-machine`、命令服务、调度、执行编排、HTTP、持久化、UI 和测试都需要同步改造。
- 现有活跃 OpenSpec change 仍引用旧状态名，后续实现前需要按新 spec 重新对齐。

适用场景：
- 当前分支尚未发布新模型，允许一次性替换旧语义。
- 团队希望长期减少状态机膨胀，而不是继续添加别名和兼容状态。

### 方案 B：保留旧状态作为兼容层，新增派生的 Task/Attempt 展示模型

优点：
- 短期实现成本低，旧 API 和旧测试可逐步迁移。
- 可先在 UI 和查询层展示新模型，降低一次性改动风险。

缺点：
- 违背原方案“不保留旧状态兼容层”的方向。
- 旧状态仍会继续污染持久化和服务层，后续每个新能力都要维护双语义映射。
- `recover/retry/cancelled -> queued` 等歧义不会被根治。

适用场景：
- 已上线系统需要长时间灰度迁移，且外部消费者依赖旧状态名。

### 方案 C：只改 OpenSpec 和文档，暂不约束实现架构

优点：
- 阶段 1/2 成本最低，能快速形成产品/架构共识。
- 不影响当前活跃开发。

缺点：
- 后续实现容易重新走回旧结构，OpenSpec 无法提供足够的工程约束。
- 无法在 plan 中明确 TDD 边界和文件责任。

适用场景：
- 仅需做概念验证或评审材料，不准备立即进入工程改造。

## 最终选择及理由

选择方案 A：直接替换 Task 主状态，并复用现有 `executions` 作为 RunAttempt 基础。

理由：
- 用户提供的目标方案已经明确要求将任务业务生命周期、执行尝试阶段、等待原因分层，且不保留旧状态兼容层。
- 当前代码中已经存在 `ExecutionRecord`、`ExecutionStatus`、`HumanReview`、`RepairGoal` 等基础结构，适合演进成 RunAttempt/WaitReason，而不是从零构建。
- 该方案能从 OpenSpec 层面约束后续实现：Task 只表达 `draft/ready/active/waiting/succeeded/failed/cancelled`，执行细节只能进入 Attempt，等待细节只能进入 WaitReason。

## 技术设计

### 架构分层

#### Task 主生命周期

`TaskStatus` 替换为 7 个业务主状态：

```ts
type TaskStatus =
  | "draft"
  | "ready"
  | "active"
  | "waiting"
  | "succeeded"
  | "failed"
  | "cancelled";
```

Task 主状态只表达业务视角：
- `draft`：任务已创建但尚未满足入队条件。
- `ready`：任务满足执行条件，等待调度。
- `active`：任务正在被系统处理，具体阶段由当前 Attempt 表达。
- `waiting`：等待人工、审批、外部回复、环境修复或策略放行。
- `succeeded`：任务完成并通过质量门禁。
- `failed`：自动处理停止，需要人工决定 retry 或 close。
- `cancelled`：任务被用户或外部流程取消。

#### RunAttempt / AttemptStage

每次 `ready -> active` claim 创建一个执行尝试。后续执行、completion gate、评测、修复和 PR 创建都属于 Attempt 阶段，不再改变 Task 主状态。

```ts
type AttemptStage =
  | "preparing"
  | "executing"
  | "completion_checking"
  | "evaluating"
  | "repairing"
  | "creating_pr"
  | "completed"
  | "failed";
```

现有 `ExecutionRecord` 和 `executions` 表是最接近 RunAttempt 的基础。后续实现可将 `ExecutionStatus` 扩展为 `AttemptStage`，或新增 `RunAttempt` 类型并由 execution 记录承接单次执行细节。OpenSpec 约束是“一次 claim 至少有一个当前 Attempt”，实现细节由阶段 3 TDD 固化。

#### WaitReason

`waiting` 不再通过 `needs_human` 或 `blocked` 区分原因，而是绑定结构化 `WaitReason`。

```ts
type WaitReason = {
  type: "human_input" | "approval" | "external_reply" | "environment_blocked" | "policy_blocked";
  source: string;
  message: string;
  externalRef?: string;
  recoverableBy: "user" | "integration" | "operator" | "system";
  createdAt: string;
};
```

WaitReason 可先持久化在 `task.metadata.waitReason` 中，或新增独立表。鉴于本次是生命周期核心改造，OpenSpec 需要要求查询层能稳定返回当前等待原因；具体存储方案在实现阶段通过测试决定。

#### 命令边界

命令按目标模型收敛：

| 命令 | 状态流转 |
| --- | --- |
| `createTask` | `[*] -> draft` |
| `submitTask` | `draft -> ready` 或 `draft -> waiting` |
| `claimTask` | `ready -> active`，并创建 Attempt |
| `pauseForWait` | `draft/ready/active -> waiting`，并写 WaitReason |
| `releaseTask` | `active -> ready`，调度器内部使用，用于 Agent 心跳超时、瞬时失败或可重新调度的 claim 释放 |
| `resumeTask` | `waiting -> ready` |
| `retryTask` | `failed -> ready`，并重置新 Attempt 预算上下文 |
| `reopenTask` | `cancelled -> draft/ready` |
| `cancelTask` | 非 `succeeded` 状态进入 `cancelled` |
| `completeTask` | `active -> succeeded` |
| `failTask` | `active -> failed` |

`recoverTask`、`queueTask`、`blockTask`、`markNeedsHuman` 的旧语义在后续实现中应被新命令替换或删除，不再作为主要领域命令。

### 关键决策

- `TaskStatus` 不再包含执行阶段：`running/evaluating/repairing` 全部归入 Attempt。
- `TaskStatus` 不再包含等待原因：`needs_human/blocked` 全部归入 `waiting + WaitReason`。
- `done` 重命名为 `succeeded`，强调需要通过质量门禁。
- `queued` 重命名为 `ready`，避免把队列实现细节暴露为业务生命周期。
- `pending` 删除，提交/入队过程作为 `submitTask` 的事务内部细节。
- `active -> ready` 保留为调度器内部恢复边，只能由 `releaseTask()` 触发，并必须记录 Attempt 释放原因；它不是用户侧 `resume/retry/reopen` 恢复入口，也不表示业务 retry。
- `failed` 只允许 `retryTask()` 恢复到 `ready`；`waiting` 只允许 `resumeTask()` 恢复到 `ready`；`cancelled` 只允许 `reopenTask()` 重新打开。
- UI 列表展示 Task 主状态，详情页展示当前 Attempt 阶段、WaitReason 和 Failure/Repair 记录。

### RunAttempt 与 ExecutionRecord 边界

本 change 先固定领域边界：

- `RunAttempt` 是 claim 级实体：一次 `ready -> active` 调度领取创建一个 Attempt。
- `ExecutionRecord` 是 Attempt 下的一轮 execution 插件调用记录：repair loop 中多轮执行可以产生多条 ExecutionRecord。
- `AttemptStage` 表达当前 Attempt 的宏观阶段，`ExecutionRecord.status` 表达单轮执行记录状态。
- Attempt 完成后写入 `completed/failed` stage；若因可重新调度释放而返回 `ready`，记录独立的 `releaseReason` 或 `terminationReason=released`，但 `released` 不是 `AttemptStage`。
- 后续实现可以先通过现有 `executions` 表加字段承载 Attempt 关系，也可以新增 `run_attempts` 表；OpenSpec 必须要求对外查询能稳定返回当前 Attempt 和其 execution 轮次。

### 影响范围

- `packages/plugin-api/src/diting/models.ts`：替换 `TaskStatus`，新增或演进 `AttemptStage`/`RunAttempt`/`WaitReason` 契约。
- `packages/core/src/diting/state-machine.ts`：替换允许迁移表和非法迁移测试。
- `packages/core/src/diting/task-command-service.ts`、`services.ts`、`service-support.ts`：命令入口和审计流转调整。
- `packages/core/src/diting/service-execution.ts`：Goal Loop 改为推进 Attempt 阶段，Task 保持 `active`。
- `packages/core/src/diting/agent-worker-pool.ts`、`service-scheduler.ts`：调度从 `queued/running` 改为 `ready/active`。
- `packages/core/src/diting/failure-repair-service.ts`、`human-intervention-service.ts`、`repair-loop-service.ts`：失败、人工介入和修复策略改为 WaitReason/Attempt 语义。
- `apps/server/src/diting/repositories.ts` 和迁移脚本：任务状态枚举、claim SQL、历史状态迁移。
- `apps/server/src/diting/server.ts`：HTTP 命令端点从旧命令迁移到新命令。
- `apps/web/src/App.tsx`：状态筛选、按钮和详情展示更新。
- `openspec/specs/*`：`task-lifecycle`、`execution-orchestration`、`human-intervention`、`scheduler`、`http-api`、`persistence` 等能力需要 delta。

### 活跃 OpenSpec change 冲突矩阵

| 活跃 change | 旧语义依赖 | 新模型映射 |
| --- | --- | --- |
| `add-product-agent-openspec-workflow` | product task 通过 `needs_human` 表示 OpenSpec review 等待，通过 `queued` 恢复 handoff | OpenSpec review 写 `waiting + WaitReason(type=approval, source=openspec-review)`；审核通过后 `resumeTask()` 进入 `ready` |
| `add-generated-spec-attachment-return` | 人工介入和附件返回链路依赖 `needs_human` | 附件缺失或等待返回写 `waiting + WaitReason(type=external_reply)` |
| `add-meegle-child-issue-repair-loop` | Meegle 子工单修复依赖 `needs_human -> queued` | 子工单等待写 `waiting + WaitReason(type=external_reply, externalRef=<child issue>)`；回复后 `resumeTask()` |
| `add-failure-repair-orchestration` | failure strategy 直接落 `blocked` 或 `needs_human` | strategy 只产出 `pauseForWait()` 或 Attempt failed；环境/策略阻断分别映射为 `environment_blocked` / `policy_blocked` |
| `add-openspec-autonomous-completion-gate` | completion gate delta 仍引用 `done`、`repairing`、`needs_human` 等旧任务态 | gate 执行写 AttemptStage `completion_checking`；通过后进入 `evaluating/creating_pr` 阶段，失败可修复进入 AttemptStage `repairing`，需人工时写 `waiting + WaitReason(type=approval)` |

### 风险与约束

- 活跃 change 中仍有旧状态名，本 change 应作为顶层生命周期重构，后续实现前需要处理冲突或重新对齐 delta。
- 如果仅改类型不改状态迁移入口，调度器和仓储可能绕过 `assertValidTransition` 产生不一致状态。
- 如果 Attempt 与 ExecutionRecord 的边界不清，可能出现“一次 claim 多个 execution”与“一次 Attempt 多轮 repair”的统计歧义。OpenSpec 应要求当前 Attempt 对外稳定可查。
- HTTP API 端点重命名会影响前端和外部调用方；由于本方案不保留旧状态兼容层，后续实现必须同步更新调用方。
- 历史数据迁移需明确旧状态映射：`created -> draft`、`validated -> draft|ready`（按输入完整度和 preflight 结果判定）、`pending -> draft`（作为旧入队中间态重新提交校验）、`queued -> ready`、`running/evaluating/repairing -> active`、`needs_human/blocked -> waiting`、`done -> succeeded`。

### 历史状态迁移规则

| 旧状态 | 新 Task 状态 | 补写策略 |
| --- | --- | --- |
| `created` | `draft` | 保留 metadata，不创建 Attempt |
| `validated` | `draft` 或 `ready` | 若输入完整且 preflight 仍通过则为 `ready`；否则保守落 `draft`，由 `submitTask()` 重新校验 |
| `pending` | `draft` | 作为旧入队事务中间态删除，不直接进入可调度态；迁移后由 `submitTask()` 重新校验 |
| `queued` | `ready` | 不创建 Attempt |
| `running` | `active` | 为当前任务补写一个当前 Attempt，阶段为 `executing` |
| `evaluating` | `active` | 补写当前 Attempt，阶段为 `evaluating` |
| `repairing` | `active` | 补写当前 Attempt，阶段为 `repairing` |
| `done` | `succeeded` | 若存在最新 execution，标记 Attempt `completed` |
| `failed` | `failed` | 若存在最新 execution，标记 Attempt `failed` |
| `needs_human` | `waiting` | 补写 `WaitReason(type=human_input, source=legacy-status)` |
| `blocked` | `waiting` | 补写 `WaitReason(type=environment_blocked, source=legacy-status)` |
| `cancelled` | `cancelled` | 不创建新的 Attempt |
| 无法判定的异常数据 | `waiting` | 补写 `WaitReason(type=policy_blocked, source=legacy-migration)`，由 operator 处理 |

### Open Questions（供 Code Review 阶段补充）

- WaitReason 首版是否存储在 `task.metadata.waitReason`，还是新增独立 `wait_reasons` 表。
- HTTP API 是否一次性删除旧端点，还是在同一 release 中返回 410/迁移提示；旧端点不得代理执行新命令，避免形成事实兼容层。
- `cancelled -> draft/ready` 的 `reopenTask()` 判定规则是否完全基于输入有效性，还是允许调用方显式指定目标状态。
