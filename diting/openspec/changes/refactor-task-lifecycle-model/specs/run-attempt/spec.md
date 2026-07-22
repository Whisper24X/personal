## ADDED Requirements

### Requirement: RunAttemptClaimScope
系统 SHALL 将 RunAttempt 定义为一次任务 claim 的执行尝试。每次任务从 `ready` 迁移到 `active` 时，系统 MUST 创建一个当前 RunAttempt，并将该 Attempt 与任务、Agent、workspace、traceId 关联。

#### Scenario: ClaimCreatesRunAttempt
- **WHEN** 调度器成功领取 `ready` 任务并将其迁移到 `active`
- **THEN** 系统 MUST 创建一个 RunAttempt
- **AND** RunAttempt 初始 stage MUST 是 `preparing`

### Requirement: AttemptStageSet
RunAttempt stage SHALL 只包含 `preparing`、`executing`、`completion_checking`、`evaluating`、`repairing`、`creating_pr`、`completed`、`failed`。这些阶段 MUST NOT 写入 Task 主状态。

#### Scenario: EvaluationDoesNotChangeTaskStatus
- **WHEN** 当前 RunAttempt 进入 `evaluating`
- **THEN** 任务主状态 MUST 保持 `active`
- **AND** 详情查询 MUST 能返回当前 Attempt stage 为 `evaluating`

### Requirement: ExecutionRecordBelongsToAttempt
ExecutionRecord SHALL 表示 RunAttempt 下的一轮 execution 插件调用记录。一个 RunAttempt MAY 包含多条 ExecutionRecord，用于表达 repair loop 中的多轮执行。

#### Scenario: RepairCreatesMultipleExecutionRecords
- **WHEN** quality 失败触发 repair 并重新执行
- **THEN** 当前 RunAttempt MAY 关联多条 ExecutionRecord
- **AND** 任务主状态 MUST 保持 `active`

### Requirement: AttemptTerminalReasons
RunAttempt 结束时 MUST 记录结果：成功结束为 stage `completed`，不可恢复失败为 stage `failed`，可重新调度释放 MUST 记录独立的 release reason 或 termination reason。`released` MUST NOT 作为 `AttemptStage` 持久化。若 Attempt 被释放，任务 MUST 从 `active` 返回 `ready`。

#### Scenario: HeartbeatTimeoutReleasesAttempt
- **WHEN** Agent 心跳超时且任务可重新调度
- **THEN** 当前 RunAttempt MUST 记录 release reason
- **AND** 任务 MUST 通过 `releaseTask()` 从 `active` 迁移到 `ready`
