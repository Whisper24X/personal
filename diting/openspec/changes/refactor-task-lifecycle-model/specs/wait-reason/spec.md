## ADDED Requirements

### Requirement: WaitingRequiresWaitReason
任务进入 `waiting` 时，系统 MUST 写入结构化 WaitReason。WaitReason MUST 包含 type、source、message、recoverableBy、createdAt，并 MAY 包含 externalRef。

#### Scenario: PauseForHumanInput
- **WHEN** 系统需要用户补充信息
- **THEN** 任务 MUST 迁移到 `waiting`
- **AND** WaitReason type MUST 是 `human_input`
- **AND** recoverableBy MUST 是 `user` 或 `operator`

### Requirement: WaitReasonTypes
WaitReason type SHALL 只包含 `human_input`、`approval`、`external_reply`、`environment_blocked`、`policy_blocked`。

#### Scenario: EnvironmentPreflightBlocked
- **WHEN** 预检失败是凭证、依赖、仓库权限或环境不可用导致
- **THEN** 任务 MUST 进入 `waiting`
- **AND** WaitReason type MUST 是 `environment_blocked`

#### Scenario: PolicyBlockedCommand
- **WHEN** 安全策略、命令策略或治理规则阻断继续执行
- **THEN** 任务 MUST 进入 `waiting`
- **AND** WaitReason type MUST 是 `policy_blocked`

### Requirement: ResumeClearsCurrentWait
`resumeTask()` SHALL 只从 `waiting` 恢复到 `ready`。恢复成功后，系统 MUST 保留 WaitReason 历史用于审计，并 MUST 标记当前等待原因已解决或不再作为当前阻塞原因。

#### Scenario: ExternalReplyResumesTask
- **WHEN** Meegle 评论、子工单回复或 OpenSpec review 回复满足恢复条件
- **THEN** 系统 MUST 调用 `resumeTask()`
- **AND** 任务 MUST 从 `waiting` 迁移到 `ready`

### Requirement: WaitingQuerySurface
任务详情查询 SHALL 返回当前 WaitReason，使 UI 和诊断工具能展示等待类型、来源、外部引用和恢复责任方。

#### Scenario: WaitingTaskDetailsShowReason
- **WHEN** 用户查看 `waiting` 任务详情
- **THEN** 响应 MUST 包含当前 WaitReason
- **AND** UI SHOULD 展示 type、message、externalRef、recoverableBy
