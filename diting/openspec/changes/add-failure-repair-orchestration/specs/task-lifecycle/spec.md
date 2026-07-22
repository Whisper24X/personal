# Task Lifecycle Delta

## MODIFIED Requirements

### Requirement: PreflightBlockedState
任务预检失败时，任务 MUST 迁移至 `blocked` 并在 `metadata.preflight` 记录失败检查项；调度器 MUST NOT 调用 `prepareWorkspace`；任务 MUST 可通过 `blocked` → `queued` 恢复；同时系统 MUST 写入统一 failure repair 记录，failureKind 为 `preflight`，strategy 为 `blocked`。该要求 MUST 同时适用于入队前 preflight 与执行前 preflight；当尚未创建 execution 时，failure repair 记录中的 `executionId` MUST 为 `null`。

#### Scenario: BlockedAfterPreflightWithFailureRepair
- **WHEN** 预检返回 `passed: false`
- **THEN** 任务状态为 `blocked` 且不创建工作区
- **AND** `task.metadata.failureRepair.lastFailure.kind` 为 `preflight`
- **AND** `task.metadata.failureRepair.strategy` 为 `blocked`

#### Scenario: PreflightBeforeExecutionWithoutExecutionId
- **WHEN** 执行前 preflight 返回 `passed: false`
- **THEN** 系统 MUST 写入 `task.metadata.failureRepair.lastFailure.executionId` 为 `null`
- **AND** MUST NOT 创建 execution record

## ADDED Requirements

### Requirement: FailureRepairStateTransitions
failure repair strategy MUST 驱动合法任务状态迁移：`auto_repair` 只能进入 repairing 或现有 Meegle needs_human 分支；`blocked` 必须进入 blocked；`needs_human` 必须进入 needs_human；`skip_with_record` 不得单独改变任务状态。状态机 MUST 支持 failure strategy 在现有执行阶段落地，至少包括 `running -> needs_human`、`evaluating -> blocked` 与 `repairing -> blocked`。

#### Scenario: BlockedStrategyTransition
- **WHEN** failure repair strategy 为 `blocked`
- **THEN** 任务 MUST 通过状态机迁移到 `blocked`

#### Scenario: NeedsHumanStrategyTransition
- **WHEN** failure repair strategy 为 `needs_human`
- **THEN** 任务 MUST 通过状态机迁移到 `needs_human`

#### Scenario: StrategyTransitionsDoNotDowngradeToFailed
- **WHEN** failure repair strategy 为 `blocked` 或 `needs_human`
- **THEN** 系统 MUST NOT 仅因当前阶段缺少状态机迁移而降级到 `failed`
- **AND** 对应状态机迁移 MUST 由本 change 显式支持

#### Scenario: SkipWithRecordNoTransition
- **WHEN** failure repair strategy 为 `skip_with_record`
- **THEN** 系统 MUST NOT 仅因该 failure repair decision 迁移任务状态

### Requirement: PullRequestFailureHumanOrBlocked
Pull request 创建失败时，系统 SHALL 记录 failure repair 事实；若失败原因指向外部权限、认证、保护分支或远端 API，任务 SHOULD 进入 `needs_human`；若无法请求人工或需运维修复配置，任务 MAY 进入 `blocked`。

#### Scenario: PullRequestPermissionNeedsHuman
- **WHEN** pull request 创建失败且错误指向远端权限或认证
- **THEN** `task.metadata.failureRepair.lastFailure.kind` MUST 为 `pull_request`
- **AND** strategy SHOULD 为 `needs_human`

#### Scenario: PullRequestConfigBlocked
- **WHEN** pull request 创建失败且错误指向本地或服务端配置缺失
- **THEN** strategy MAY 为 `blocked`

## MODIFIED Requirements

### Requirement: LifecycleTerminologyAlignment
本 change 用 failure repair strategy 驱动任务状态迁移；历史中 strategy 直接落 Task 主状态 `blocked`、`needs_human` 或 `repairing`。对齐 `refactor-task-lifecycle-model` 后：`blocked` strategy MUST 调用 `pauseForWait()` 并写入 WaitReason `environment_blocked` 或 `policy_blocked`；`needs_human` strategy MUST 调用 `pauseForWait()` 并写入 WaitReason `human_input`；`auto_repair` MUST 推进 RunAttempt.stage `repairing` 且 Task 保持 `active`；MUST NOT 将 `repairing`、`running`、`evaluating` 作为 Task 主状态持久化；预检与恢复路径使用 `resumeTask()` 由 `waiting` 进入 `ready`。

#### Scenario: LegacyStatusNamesMapToSevenStateModel
- **WHEN** 读者或实现引用本 change 中的历史 Task 状态名
- **THEN** MUST 按 `openspec/changes/refactor-task-lifecycle-model/lifecycle-alignment.md` 或本目录 `lifecycle-alignment.md` 映射到 7 态模型
- **AND** 执行阶段 MUST NOT 写入 Task 主状态
