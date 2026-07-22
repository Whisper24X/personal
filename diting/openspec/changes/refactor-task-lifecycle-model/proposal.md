## Why

当前 diting 的 `TaskStatus` 同时承载业务生命周期、单次执行阶段、等待原因和恢复入口，导致状态机持续膨胀，`running/evaluating/repairing/needs_human/blocked/queued` 等状态在任务、调度、执行和人工协作之间语义重叠。

本 change 将任务主状态、执行尝试阶段和等待原因拆成独立模型，让任务列表、执行详情、人工协作和 retry/reopen 行为都能被稳定理解和观测。

## What Changes

- **BREAKING**：将任务主状态替换为 `draft/ready/active/waiting/succeeded/failed/cancelled`，删除旧的 `created/validated/pending/queued/running/evaluating/repairing/done/needs_human/blocked` 任务态。
- **BREAKING**：将 `queue/recover/block/needs-human` 等旧领域命令收敛为 `submitTask`、`claimTask`、`pauseForWait`、`resumeTask`、`retryTask`、`reopenTask`、`completeTask`、`failTask`；`releaseTask` 仅作为调度器内部 claim 释放入口。
- 新增 claim 级 `RunAttempt` 模型：一次 `ready -> active` 调度领取创建一个 Attempt，Attempt 使用 `AttemptStage` 表达 `preparing/executing/completion_checking/evaluating/repairing/creating_pr/completed/failed`。
- 新增结构化 `WaitReason`：`waiting` 任务必须记录等待类型、来源、说明、外部引用和恢复责任方。
- 调度器从 `queued -> running` 改为 `ready -> active`，Agent 心跳超时或瞬时失败通过 `releaseTask()` 执行 `active -> ready`。
- Goal Loop 不再把 `evaluating/repairing` 写入 Task 主状态，completion gate、quality、repair、PR 创建只推进当前 Attempt 阶段。
- 人工介入、审批、Meegle 子工单回复、环境阻塞和策略阻塞统一写入 `waiting + WaitReason`，恢复统一走 `resumeTask()`。
- 历史状态需要一次性迁移到新模型，并为活跃执行、等待和终态任务补写 Attempt 或 WaitReason。

## Capabilities

### New Capabilities

- `run-attempt`: 定义 claim 级执行尝试、AttemptStage、Attempt 与 ExecutionRecord 的关系，以及 Attempt 的完成、失败和释放语义。
- `wait-reason`: 定义 waiting 任务的结构化等待原因、恢复责任方、外部引用和查询契约。

### Modified Capabilities

- `task-lifecycle`: 将任务主状态机替换为 7 态模型，并重定义命令入口与合法迁移。
- `execution-orchestration`: 将执行、completion gate、quality、repair 和 PR 创建阶段下沉到 RunAttempt。
- `scheduler`: 将调度领取和超时恢复从 `queued/running` 改为 `ready/active/releaseTask`。
- `human-intervention`: 将 `needs_human` 和 `blocked` 语义改为 `waiting + WaitReason`。
- `repair-loop`: 将修复轮次和停止原因归属到 Attempt/WaitReason，不再扩展 Task 主状态。
- `http-api`: 将旧命令端点迁移到 submit/resume/retry/reopen 等新命令语义。
- `persistence`: 迁移旧任务状态，并持久化或稳定返回 RunAttempt 与 WaitReason。
- `observability`: 列表展示 Task 主状态，详情和事件展示 AttemptStage、WaitReason、Failure/Repair 记录。

## Impact

- `packages/plugin-api`: 替换 `TaskStatus`，新增 `RunAttempt`、`AttemptStage`、`WaitReason` 及相关 repository/query 契约。
- `packages/core`: 重写状态机、命令服务、调度、Goal Loop、failure repair、human intervention、repair loop 和观测事件。
- `apps/server`: 更新 SQLite repository、迁移脚本、HTTP routes、诊断接口和插件适配。
- `apps/web`: 更新状态筛选、操作按钮、详情页 Attempt/WaitReason 展示和中英文文案。
- `openspec/changes`: 当前活跃 change 中引用旧状态语义的 delta 需要在后续实现前按本模型重新对齐。
