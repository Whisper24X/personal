## ADDED Requirements

### Requirement: MeegleChildIssueHumanRepairGate

当 Meegle 父任务因 quality failed 进入人工介入时，系统 SHALL 在父 issue 开发节点下创建或复用「任务」子任务作为人工修复方案载体；系统 MUST 仅在该子任务的「子任务描述」以 `【开发中】` 开头时恢复父任务。

#### Scenario: ChildDescriptionNotReady

- **WHEN** 父任务处于 `needs_human` 且关联子任务描述为 `请补充方案`
- **THEN** 显式同步接口 MUST 返回 `ready: false`
- **AND** 父任务 MUST 保持 `needs_human`
- **AND** repair goal MUST 保持 `needs_human`

#### Scenario: ChildDescriptionReady

- **WHEN** 父任务处于 `needs_human` 且关联子任务描述为 `【开发中】修复 npm test 失败`
- **THEN** 显式同步接口 MUST 返回 `ready: true` 与 `recovered: true`
- **AND** 系统 MUST 将 `修复 npm test 失败` 作为人工方案写入 repair goal constraints
- **AND** 父任务 MUST 迁移到 `queued`

### Requirement: MeegleChildIssueFailClosed

当 Meegle 子 issue 能力不可用、开发节点不可查询、任务类型不可用或子任务创建失败时，系统 MUST fail closed，禁止回到自动 repair。

#### Scenario: ChildIssueOpenFailed

- **WHEN** Meegle 父任务 quality failed 且创建子任务失败
- **THEN** 系统 MUST 记录 `goal.child_issue_open_failed`
- **AND** 父任务 MUST 进入或保持人工等待状态 `needs_human` 或 `blocked`
- **AND** 系统 MUST NOT 进入自动 repair iteration

### Requirement: ChildIssueIdempotentReuse

系统 SHALL 使用父 issue 外部 ID 与失败指纹构成子任务幂等键，相同失败指纹 MUST 复用已有子任务，不同失败指纹 MUST 创建新的子任务。

#### Scenario: SameFailureHashReusesChildIssue

- **WHEN** 同一 Meegle 父 issue 再次遇到相同 failure hash
- **THEN** 系统 MUST 查询并复用已有子任务
- **AND** 系统 MUST NOT 创建重复子任务

#### Scenario: DifferentFailureHashCreatesChildIssue

- **WHEN** 同一 Meegle 父 issue 遇到不同 failure hash
- **THEN** 系统 MUST 创建新的「任务」子任务

## MODIFIED Requirements

### Requirement: LifecycleTerminologyAlignment
本 change 用 Meegle 父 issue 下「任务」子工单承载人工修复方案；历史中 `needs_human` 表示等待子工单 `【开发中】` 前缀描述、`queued` 表示子方案就绪后恢复父任务调度。对齐 `refactor-task-lifecycle-model` 后：子工单等待 MUST 使用 `waiting + WaitReason(type=external_reply, source=meegle-child-issue, externalRef=<child issue>)`；子描述就绪后 MUST 使用 `resumeTask()` 进入 `ready`（非 `queued`）；`repairing` MUST 为 RunAttempt.stage，Task 主状态保持 `active`；`needs_human` 与 `blocked` 读写为 `waiting`。

#### Scenario: LegacyStatusNamesMapToSevenStateModel
- **WHEN** 读者或实现引用本 change 中的历史 Task 状态名
- **THEN** MUST 按 `openspec/changes/refactor-task-lifecycle-model/lifecycle-alignment.md` 或本目录 `lifecycle-alignment.md` 映射到 7 态模型
- **AND** 执行阶段 MUST NOT 写入 Task 主状态
