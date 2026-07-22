## MODIFIED Requirements

### Requirement: HumanInterventionUsesWaiting
系统 SHALL 使用 `waiting + WaitReason` 表达人工作业、审批、外部评论回复和子工单等待。`needs_human` 和 `blocked` MUST NOT 作为任务主状态使用。

#### Scenario: ManualNeedsHumanBecomesWaiting
- **WHEN** 用户或系统要求人工补充信息
- **THEN** 任务 MUST 迁移到 `waiting`
- **AND** WaitReason type MUST 是 `human_input`

### Requirement: ApprovalWaitReason
OpenSpec review、PR review 或审批流等待 SHALL 使用 WaitReason type `approval`，并通过 externalRef 记录外部审批入口。

#### Scenario: OpenSpecReviewWaiting
- **WHEN** product task 生成 OpenSpec 后等待审核
- **THEN** 任务 MUST 处于 `waiting`
- **AND** WaitReason type MUST 是 `approval`
- **AND** externalRef SHOULD 指向审核评论、子任务或 OpenSpec 路径

### Requirement: ExternalReplyRecovery
Meegle 评论回复、子工单回复或集成系统回复满足恢复条件时，系统 SHALL 去重处理回复并调用 `resumeTask()`，不得调用旧的 recover-to-queued 语义。

#### Scenario: MeegleReplyResumesWaitingTask
- **WHEN** waiting 任务收到符合门禁前缀的 Meegle 回复
- **THEN** 系统 MUST 调用 `resumeTask()`
- **AND** 任务 MUST 迁移到 `ready`

### Requirement: HumanReviewPersistence
HumanReview 记录 SHALL 继续用于人工介入审计。进入 `waiting` 时，HumanReview 与 WaitReason MUST 能通过 taskId 或 externalRef 关联。

#### Scenario: HumanReviewLinkedToWaitReason
- **WHEN** 任务因外部审核进入 `waiting`
- **THEN** HumanReview MUST 可查询
- **AND** 当前 WaitReason MUST 能说明等待来源和恢复责任方
