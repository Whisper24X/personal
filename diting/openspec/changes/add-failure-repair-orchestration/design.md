# 统一失败记录与修复编排设计

## 背景

当前执行链路已经具备 `repair_goals`、quality failed repair loop、completion gate repair、环境失败重试、执行失败重试、Meegle 子 issue 人工闭环等能力。但失败信息的归档和修复方案生成分散在 `ServiceExecution` 多个分支里，不同失败类型的元数据、日志事件和状态策略不一致。

本次设计目标是为所有任务失败建立统一入口：先记录失败事实，再生成修复方案，然后根据失败类型决定自动修复、跳过记录、阻塞或转人工。

技术栈 Profile：`typescript`。

## 方案对比

### 方案 A：在现有失败分支直接补逻辑

优点：
- 改动最小，可以快速补齐特定路径。
- 不需要新增服务或统一类型。

缺点：
- 失败信息结构继续散落，后续新增失败路径仍容易遗漏。
- 同一字段在 metadata/log/repair goal 中可能出现不同命名。
- 难以单独测试“失败归一化”和“策略选择”。

### 方案 B：新增统一 FailureRepairService

优点：
- 所有失败路径通过同一入口沉淀失败事实和修复方案。
- 可将失败归一化、hash、history 裁剪、策略选择做成纯函数或薄服务，易测试。
- 保留现有 `repair_goals`、状态机和 Meegle 子 issue 逻辑，避免大迁移。

缺点：
- 需要改动 `ServiceExecution` 多个失败分支。
- 需要定义新的 metadata 结构和日志事件约定。

### 方案 C：只扩展 RepairGoal.metadata

优点：
- 不新增服务，自动 repair 路径容易落地。
- 数据继续跟随 repair goal。

缺点：
- `blocked`、`needs_human`、`skip_with_record` 这类没有 active repair goal 或不应自动修复的失败很别扭。
- 失败记录和 repair goal 耦合过深，不利于观测和人工排查。

## 最终选择

选择方案 B。

`FailureRepairService` 负责归一化失败事实、生成修复方案、写入 metadata/log，并返回策略。它不直接执行任务，也不绕过状态机。自动修复仍复用现有 `repair_goals` 和 repair loop；人工或阻塞路径仍使用现有 `needs_human`、`blocked` 状态。

## 核心模型

建议新增内部类型：

```ts
type FailureKind =
  | "quality"
  | "completion_gate"
  | "execution"
  | "workflow_prompt"
  | "environment"
  | "preflight"
  | "pull_request"
  | "unknown";

type FailureRepairStrategy =
  | "auto_repair"
  | "skip_with_record"
  | "blocked"
  | "needs_human";

type FailureRepairDecision = {
  failureKind: FailureKind;
  strategy: FailureRepairStrategy;
  failureHash: string;
  failureSummary: string;
  failureDetail: Record<string, unknown>;
  repairPlan: {
    source: FailureKind;
    objective: string;
    constraints: string[];
    doneWhen: string[];
  };
};
```

建议写入 `task.metadata.failureRepair`：

```ts
type FailureRepairMetadata = {
  lastFailure: {
    kind: FailureKind;
    strategy: FailureRepairStrategy;
    hash: string;
    summary: string;
    detail: Record<string, unknown>;
    occurredAt: string;
    executionId: string | null;
  };
  repairPlan: {
    source: FailureKind;
    objective: string;
    constraints: string[];
    doneWhen: string[];
  };
  strategy: FailureRepairStrategy;
  history: Array<{
    kind: FailureKind;
    strategy: FailureRepairStrategy;
    hash: string;
    summary: string;
    occurredAt: string;
    executionId: string | null;
  }>;
};
```

`history` MUST 保留最近 10 条，避免 metadata 无限增长。`detail` 可包含 stderr/stdout 摘要、errorCategory、timeoutCategory、quality checks、completion gate incompleteTasks、environment stage、preflight checks、PR records 或异常 message/stack 摘要。

## 分流策略

### 自动修复

以下失败默认 `auto_repair`：

- `quality`
- `completion_gate`
- 明确可由代码执行器修复的 execution failure

retryable execution failure 仍先遵循现有 retry policy，例如 timeout 或 launch error 可先重新入队或在 repair loop 内联重试。只有当 retry budget 耗尽后仍能判断失败属于代码可修复问题时，才进入 `auto_repair`；若失败更像环境、启动、配置或外部服务问题，则进入 `blocked`，不得盲目创建 repair goal。

行为：
- 写入 `failure.recorded` 与 `failure.repair_plan_created`。
- 创建或更新 `repair_goals`。
- 记录 `failure.auto_repair_invoked`。
- 任务进入 `repairing`，下一轮 execution 带 repair goal 执行。

Meegle quality failed 的子 issue 闭环优先级保持不变：统一失败记录作为上游失败事实；若 Meegle 子 issue 能力可用，任务按既有逻辑进入 `needs_human` 等待子任务方案，而不是直接进入自动 repair。

### 跳过但记录

`workflow_prompt` 失败使用 `skip_with_record`。

行为：
- 写入 `failure.workflow_prompt_skipped`。
- 写入 `task.metadata.failureRepair.lastFailure`。
- 不将任务迁移到 `failed` 或 `blocked`。
- 继续使用内置默认 workflow 或无 workflow 模式执行。
- 如果 fallback 后执行仍失败，再按 `execution` failure 处理。

该规则覆盖 workflow prompt 缺失、读取失败、解析失败或节点模板错误，只要系统仍能安全 fallback 到内置默认 workflow 或无 workflow 模式。若 fallback 不可用，后续失败必须重新归类为 `execution` 或 `unknown`，不得继续使用 `skip_with_record` 掩盖终止原因。

### 阻塞

以下失败默认 `blocked`：

- `environment`
- `preflight`

行为：
- 记录失败信息和修复建议。
- 任务进入 `blocked`。
- 不自动调用执行器。
- 运维修复配置、权限、仓库或任务元数据后，可通过 recover/retry 重新入队。

### 人工介入

以下失败默认 `needs_human`：

- `pull_request`，当错误指向权限、认证、远端保护分支或 API 问题时
- `unknown`

如果 `pull_request` 明确是可配置修复且系统无法向外部线程请求人工，可降级为 `blocked`。

行为：
- 记录失败上下文和建议处理项。
- 任务进入 `needs_human` 或 `blocked`。
- 不自动调用执行器。

## 日志事件

新增结构化事件：

- `failure.recorded`
- `failure.repair_plan_created`
- `failure.auto_repair_invoked`
- `failure.workflow_prompt_skipped`
- `failure.blocked`
- `failure.needs_human`

日志 data MUST 包含：

- `failureKind`
- `strategy`
- `failureHash`
- `failureSummary`
- `repairPlan`
- `executionId`，若有
- `correlation`

## 与现有模块关系

- `ServiceExecution`：在每个失败分支调用 `FailureRepairService`；根据返回 strategy 继续原状态迁移。
- `repair-loop-service.ts`：可保留薄 facade；自动修复路径继续使用 `repair_goals`。
- `service-shared.ts`：可承载纯函数，如 `buildFailureRepairHash`、`appendFailureRepairHistory`、`buildFailureRepairPlan`。
- `run-observability.ts`：可从 logs 与 task metadata 推断失败修复信息；若现有 task observability 响应不包含 task metadata，应补充 `task` 或专门的 `failureRepair` 字段，保持向后兼容。
- `state-machine.ts`：不新增状态，但需要补齐 failure strategy 所需的合法迁移，例如 `running -> needs_human`、`evaluating -> blocked`、`repairing -> blocked`。

## 状态机兼容性

failure repair strategy 是状态迁移的输入，不应绕过状态机。当前执行链路中，失败可能发生在 `running`、`evaluating` 或 `repairing`：

- `running` 阶段可能出现 executor、workflow prompt、environment 或 no-quality pull request failure。
- `evaluating` 阶段可能出现 quality 后 pull request failure。
- `repairing` 阶段可能出现 repair loop 内 environment 或 execution retry budget exhausted。

因此本 change 应同步扩展状态机允许必要迁移，而不是在策略为 `blocked` 或 `needs_human` 时降级为 `failed`。所有新增迁移必须通过 `state-machine.spec.ts` 覆盖。

## 测试策略

- 纯函数测试：不同 `FailureKind` 生成正确 strategy、hash、repair plan 和 history 裁剪。
- execution orchestration 测试：
  - quality failed 写统一失败记录，并进入现有 repair 或 Meegle 子 issue 路径。
  - completion gate failed 写统一失败记录，并自动 repair。
  - retryable execution failure 先遵循 retry policy，预算耗尽后按失败性质进入 `auto_repair` 或 `blocked`。
  - workflow prompt failed 写 `skip_with_record`，不迁移 failed/blocked，并继续 fallback 执行。
  - environment/preflight failed 写统一失败记录，并进入 blocked；preflight 入队前和执行前两条路径都要覆盖。
  - PR 创建失败写统一失败记录，并进入 needs_human 或 blocked。
  - unknown exception 写统一失败记录，并进入 needs_human。
- 状态机测试：覆盖新增的 `blocked` 与 `needs_human` 合法迁移。
- 观测测试：任务 observability 聚合可读到 `failureRepair.lastFailure` 或兼容的 failureRepair 摘要字段，以及 `failure.*` log。

## 风险与缓解

- 风险：workflow prompt fallback 可能掩盖配置错误。
  - 缓解：必须记录 `failure.workflow_prompt_skipped`，并在 metadata 中保留错误详情和 fallback 原因。
- 风险：metadata 过大。
  - 缓解：history 保留最近 10 条，stdout/stderr 只保存摘要或引用日志路径。
- 风险：自动 repair 误处理外部系统问题。
  - 缓解：策略默认只允许 quality、completion gate、execution 代码失败自动修复。
- 风险：与 Meegle 子 issue 闭环重复。
  - 缓解：统一失败记录位于上游；Meegle child issue 仍决定 quality failed 后是否进入人工闭环。
