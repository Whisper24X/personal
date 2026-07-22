# Task Lifecycle Specification

> 基线：当前实现（截至 2026-06）
> 参考：docs/architecture/diting-technical-design.md、docs/architecture/diting-api.md

## Purpose

定义任务状态机合法状态、允许迁移及每次迁移 MUST 伴随的结构化事件与日志。

## Requirements

### Requirement: TaskStatusSets
任务状态 SHALL 分为正常态：created、validated、pending、queued、running、evaluating、repairing、done；异常态：failed、needs_human、blocked、cancelled。

#### Scenario: TerminalDone
- **WHEN** 任务处于 done
- **THEN** 状态机 MUST NOT 允许迁出 done（终态）

### Requirement: LegalTransitionsOnly
所有状态迁移 MUST 通过 `assertValidTransition` 校验；非法 `from -> to` MUST 抛出 `InvalidTransitionError`，禁止绕过状态机直接写库改 status。

#### Scenario: IllegalTransitionRejected
- **WHEN** 尝试从 created 直接迁移到 running
- **THEN** 系统 MUST 拒绝并抛出 InvalidTransitionError

### Requirement: AllowedTransitionTable
系统 SHALL 仅允许以下迁移（节选核心路径）：

- created → validated | blocked | cancelled
- validated → pending | blocked | cancelled
- pending → queued | blocked | cancelled | failed
- queued → running | cancelled | blocked
- running → evaluating | repairing | done | queued | failed | blocked | cancelled
- evaluating → done | repairing | failed | needs_human
- repairing → evaluating | done | failed | needs_human | cancelled
- failed → queued
- needs_human → queued | cancelled
- blocked → queued | cancelled
- cancelled → queued

#### Scenario: ValidateToPending
- **WHEN** 任务从 validated 经业务命令进入 pending
- **THEN** 迁移合法且被持久化

### Requirement: TransitionAuditTrail
每次合法迁移 MUST 写入 `task_transitions` 审计记录，含 from_status、to_status、reason、operator、trace_id；并 MUST 产生结构化 execution log 条目（from、to、reason、operator、traceId）。

#### Scenario: QueueTransitionLogged
- **WHEN** 任务从 validated 进入 queued
- **THEN** task_transitions 表新增一条记录且 logs 中有对应事件

### Requirement: CommandApiDrivesTransitions
HTTP 命令端点（validate、queue、retry、block、needs-human、recover、cancel）与调度/Goal Loop 内部命令 MUST 统一经应用服务与状态机，插件 MUST NOT 自行推进任务状态机。

#### Scenario: PluginCannotTransition
- **WHEN** task-integration 插件尝试直接修改 task status
- **THEN** 该行为违反架构边界，实现 MUST 通过服务层命令完成状态变更

### Requirement: PreflightBlockedState
任务预检失败时，任务 MUST 迁移至 `blocked` 并在 `metadata.preflight` 记录失败检查项；调度器 MUST NOT 调用 `prepareWorkspace`；任务 MUST 可通过 `blocked` → `queued` 恢复。

#### Scenario: BlockedAfterPreflight
- **WHEN** 预检返回 `passed: false`
- **THEN** 任务状态为 `blocked` 且不创建工作区

## Technical Notes

- 实现：`packages/core/src/diting/state-machine.ts`、`packages/core/src/diting/task-command-service.ts`
- 依赖：http-api、persistence、observability
