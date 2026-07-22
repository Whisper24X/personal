## MODIFIED Requirements

### Requirement: PersistNewTaskStatuses
任务持久化层 SHALL 只存储新任务主状态：`draft`、`ready`、`active`、`waiting`、`succeeded`、`failed`、`cancelled`。claim 查询 MUST 匹配 `ready` 并写入 `active`。

#### Scenario: ClaimReadyUpdatesActive
- **WHEN** repository claim 一个 `ready` 任务
- **THEN** 数据库中的任务 status MUST 更新为 `active`
- **AND** MUST NOT 写入 `running`

### Requirement: MigrateLegacyTaskStatuses
系统 SHALL 提供一次性历史状态迁移：`created -> draft`、`validated -> draft|ready`、`pending -> draft`、`queued -> ready`、`running|evaluating|repairing -> active`、`done -> succeeded`、`failed -> failed`、`needs_human|blocked -> waiting`、`cancelled -> cancelled`。`validated` MUST 按输入完整度和 preflight 结果判定目标状态；`pending` 作为旧入队事务中间态 MUST NOT 直接迁移为可调度状态。

#### Scenario: LegacyValidatedRechecksReadiness
- **WHEN** 迁移旧状态为 `validated` 的任务
- **THEN** 系统 MUST 重新判定输入完整度和 preflight 结果
- **AND** 只有满足执行条件时新状态才 MUST 是 `ready`
- **AND** 不满足执行条件时新状态 MUST 是 `draft`

#### Scenario: LegacyPendingMigratesToDraft
- **WHEN** 迁移旧状态为 `pending` 的任务
- **THEN** 新状态 MUST 是 `draft`
- **AND** 后续 MUST 通过 `submitTask()` 重新校验后才能进入 `ready` 或 `waiting`

#### Scenario: LegacyNeedsHumanMigratesToWaiting
- **WHEN** 迁移旧状态为 `needs_human` 的任务
- **THEN** 新状态 MUST 是 `waiting`
- **AND** 系统 MUST 补写 WaitReason type `human_input`

#### Scenario: LegacyEvaluatingMigratesToActiveAttempt
- **WHEN** 迁移旧状态为 `evaluating` 的任务
- **THEN** 新状态 MUST 是 `active`
- **AND** 系统 MUST 补写当前 RunAttempt stage `evaluating`

### Requirement: PersistAttemptAndWaitReason
持久化层 SHALL 能稳定保存和查询当前 RunAttempt 与当前 WaitReason。实现 MAY 使用独立表或 task metadata，但 API 和核心服务 MUST 获得一致的领域对象。

#### Scenario: QueryCurrentAttempt
- **WHEN** 任务处于 `active`
- **THEN** repository 或查询服务 MUST 能返回当前 RunAttempt

#### Scenario: QueryCurrentWaitReason
- **WHEN** 任务处于 `waiting`
- **THEN** repository 或查询服务 MUST 能返回当前 WaitReason
