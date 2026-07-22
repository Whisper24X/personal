## MODIFIED Requirements

### Requirement: ReadyTaskDispatch
调度器 SHALL 只领取 `ready` 任务。成功领取任务时，系统 MUST 将任务迁移到 `active`，绑定 Agent，并创建当前 RunAttempt。

#### Scenario: ClaimReadyTask
- **WHEN** 存在可用 Agent 且任务处于 `ready`
- **THEN** 调度器 MUST 通过服务层执行 `ready -> active`
- **AND** MUST 创建 stage 为 `preparing` 的 RunAttempt

### Requirement: SchedulerDoesNotUseQueuedRunning
调度器 MUST NOT 读写 `queued` 或 `running` 任务状态。任何队列可调度语义 MUST 使用 `ready`，任何正在处理语义 MUST 使用 `active`。

#### Scenario: NoQueuedRunningMutation
- **WHEN** 调度器领取或释放任务
- **THEN** 持久化的任务 status MUST NOT 被写为 `queued` 或 `running`

### Requirement: ActiveTimeoutRelease
Agent 心跳超时、租约失效或瞬时调度失败时，调度器 SHALL 使用 `releaseTask()` 将可重新调度任务从 `active` 释放回 `ready`，并记录当前 RunAttempt 的 release reason；该释放原因 MUST NOT 作为 `AttemptStage` 持久化。

#### Scenario: HeartbeatTimeoutReturnsReady
- **WHEN** `active` 任务的 Agent 心跳超时且任务未达到失败预算
- **THEN** 任务 MUST 迁移到 `ready`
- **AND** 当前 RunAttempt MUST 记录释放原因
