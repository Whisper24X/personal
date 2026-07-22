## MODIFIED Requirements

### Requirement: TaskStatusSets
任务主状态 SHALL 只包含 `draft`、`ready`、`active`、`waiting`、`succeeded`、`failed`、`cancelled`。`running`、`evaluating`、`repairing` MUST NOT 作为任务主状态持久化；`needs_human`、`blocked` MUST 由 `waiting` 配合 WaitReason 表达；`done` MUST 替换为 `succeeded`。

#### Scenario: TaskStatusUsesBusinessLifecycle
- **WHEN** 系统创建、调度、执行、等待、失败、取消或完成任务
- **THEN** 任务 status MUST 是 `draft`、`ready`、`active`、`waiting`、`succeeded`、`failed`、`cancelled` 之一
- **AND** 任务 status MUST NOT 是 `created`、`validated`、`pending`、`queued`、`running`、`evaluating`、`repairing`、`done`、`needs_human` 或 `blocked`

### Requirement: LegalTransitionsOnly
所有任务主状态迁移 MUST 通过 `assertValidTransition` 校验。系统 SHALL 允许 `draft -> ready|waiting|cancelled`、`ready -> active|waiting|cancelled`、`active -> succeeded|waiting|failed|ready|cancelled`、`waiting -> ready|cancelled`、`failed -> ready|cancelled`、`cancelled -> draft|ready`。`succeeded` MUST 是终态。

#### Scenario: ActiveCanReleaseToReady
- **WHEN** Agent 心跳超时或发生可重新调度的瞬时失败
- **THEN** 系统 MUST 允许 `active -> ready`
- **AND** 本次 RunAttempt MUST 记录释放原因

#### Scenario: SucceededIsTerminal
- **WHEN** 任务处于 `succeeded`
- **THEN** 状态机 MUST NOT 允许迁出 `succeeded`

### Requirement: CommandApiDrivesTransitions
任务主状态迁移 SHALL 由领域命令驱动：`createTask`、`submitTask`、`claimTask`、`releaseTask`、`pauseForWait`、`resumeTask`、`retryTask`、`reopenTask`、`cancelTask`、`completeTask`、`failTask`。插件、仓储和调度器 MUST NOT 绕过服务层直接写入任务 status。`releaseTask()` SHALL 仅作为调度器内部 claim 释放命令，不得作为用户侧恢复入口；用户侧恢复 MUST 使用 `resumeTask()`、`retryTask()` 或 `reopenTask()`。

#### Scenario: ResumeOnlyFromWaiting
- **WHEN** `resumeTask()` 被调用
- **THEN** 当前任务 MUST 处于 `waiting`
- **AND** 成功后任务 MUST 迁移到 `ready`

#### Scenario: RetryOnlyFromFailed
- **WHEN** `retryTask()` 被调用
- **THEN** 当前任务 MUST 处于 `failed`
- **AND** 成功后任务 MUST 迁移到 `ready`

#### Scenario: ReopenCancelledTask
- **WHEN** `reopenTask()` 被调用且任务处于 `cancelled`
- **THEN** 系统 MUST 根据输入是否仍满足提交条件将任务迁移到 `draft` 或 `ready`

### Requirement: TransitionAuditTrail
每次合法任务主状态迁移 MUST 写入 `task_transitions` 审计记录，包含 from_status、to_status、reason、operator、trace_id。迁移日志 SHOULD 记录关联的 RunAttempt、WaitReason 或 Failure 信息。

#### Scenario: WaitingTransitionLogged
- **WHEN** 任务因人工输入进入 `waiting`
- **THEN** `task_transitions` MUST 新增 `active -> waiting` 或当前状态到 `waiting` 的记录
- **AND** execution log MUST 包含 WaitReason 的 type、source、recoverableBy
