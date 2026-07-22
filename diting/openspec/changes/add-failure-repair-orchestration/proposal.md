# 统一失败记录与修复编排

## 目标

任务执行链路中任意失败都必须形成可追踪的失败事实、可读的修复方案和明确的后续策略。系统应区分可自动修复的代码/质量类失败与需要人工或环境修复的外部失败，避免失败信息散落在不同分支，也避免把权限、配置、远端服务等问题盲目交给代码执行器。

## 方案

- 在 `packages/core` 新增统一失败修复编排模块，建议命名为 `FailureRepairService`。
- 所有失败路径先归一化为 `failureKind`、`failureSummary`、`failureDetail`、`failureHash`、`repairPlan` 与 `strategy`。
- `quality`、`completion_gate`、明确可由代码执行器修复的 execution failure 进入 `auto_repair`，复用现有 `repair_goals` 和 repair loop。
- retryable execution failure 仍先遵循现有 retry budget；预算耗尽后必须按失败性质区分外部阻塞与代码可修复失败。
- `environment`、`preflight` 进入 `blocked`，记录建议修复步骤但不自动调用执行器。
- `pull_request` 进入 `needs_human` 或 `blocked`，保留 PR 失败明细与远端错误。
- `unknown` 进入 `needs_human`，保留异常上下文。
- `workflow_prompt` 失败在系统可安全 fallback 时不阻塞任务：记录异常并标记 `skip_with_record`，然后使用内置默认 workflow 或无 workflow 模式继续执行。
- 失败事实写入 `task.metadata.failureRepair`，并同步写结构化 execution log。

## Capabilities

- `execution-orchestration`
- `repair-loop`
- `observability`
- `task-lifecycle`

## 影响范围

- `packages/core`：新增失败记录与修复方案归一化模块；调整 `ServiceExecution` 各失败分支。
- `packages/core`：同步补齐状态机合法迁移，使 `blocked`、`needs_human` strategy 不需要降级为 `failed`。
- `@diting/plugin-api`：若需要类型外显，可新增失败修复相关类型；不要求新增数据库表。
- `apps/server`：repository 读写无需迁移；观测 API 通过现有 task metadata 和 logs 暴露失败信息。
- `apps/web`：可选展示 `failureRepair.lastFailure` 与 strategy；本 change 的核心要求不依赖新页面。

## 风险与约束

- 不能绕过现有任务状态机；所有 `blocked`、`needs_human`、`repairing`、`failed` 迁移仍必须通过服务层命令。
- 若现有状态机缺少 failure strategy 所需的合法迁移，本 change 必须显式更新状态机与对应测试，而不是在运行时静默降级。
- `workflow_prompt` 的新行为会改变当前“无效 workflow prompt 直接失败”的语义，需要在 execution 插件或 local runner 层支持 fallback 继续。
- 失败记录保存在 `task.metadata.failureRepair`，必须限制 history 长度，避免 metadata 无限膨胀。
- 自动 repair 只适用于代码、质量、completion gate 这类可由执行器处理的失败；环境、预检、PR、未知异常不得默认自动修复。
