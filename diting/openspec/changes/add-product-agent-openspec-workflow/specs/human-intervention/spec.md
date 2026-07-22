## ADDED Requirements

### Requirement: OpenSpecReviewHumanGate

当 product task 生成并校验 OpenSpec 后，系统 SHALL 创建或复用 OpenSpec review 审核入口，并将 product task 转入 `needs_human`；系统 MUST 仅根据合规审核前缀推进后续状态。

#### Scenario: OpenSpecReviewPending

- **WHEN** product driver 成功生成 OpenSpec review payload
- **THEN** 系统 MUST 创建或复用 Meegle 审核入口
- **AND** product task MUST 进入 `needs_human`
- **AND** HumanReview MUST 记录 `requestType=openspec_review`

#### Scenario: OpenSpecReviewIgnoresUnprefixedReply

- **WHEN** product task 处于 `needs_human` 且审核回复没有合规前缀
- **THEN** 系统 MUST 保持 product task 为 `needs_human`
- **AND** MUST NOT 进入 programming 开发阶段

### Requirement: OpenSpecReviewPrefixDecisions

OpenSpec review 回复 MUST 使用 `【评审通过】`、`【需要修改】` 或 `【废弃】` 前缀；系统 SHALL 根据前缀分别批准 handoff、恢复修订或终止流程。

#### Scenario: ReviewApproved

- **WHEN** 审核回复以 `【评审通过】` 开头
- **THEN** 系统 MUST 将 HumanReview 标记为 answered
- **AND** product task MUST 记录 approved OpenSpec revision
- **AND** 系统 MUST 将当前 task 切换为 programming 阶段并恢复到 `ready`

#### Scenario: ReviewChangesRequested

- **WHEN** 审核回复以 `【需要修改】` 开头
- **THEN** 系统 MUST 将回复正文作为修订反馈保存
- **AND** product task MUST 从 `needs_human` 恢复到 `queued`

#### Scenario: ReviewDismissed

- **WHEN** 审核回复以 `【废弃】` 开头
- **THEN** 系统 MUST 取消或阻断 product task
- **AND** HumanReview MUST 记录 dismissed 语义

### Requirement: OpenSpecReviewFailClosed

当 Meegle OpenSpec review 能力不可用、审核入口创建失败或无法读取审核回复时，系统 MUST fail closed，禁止自动进入 programming 开发阶段。

#### Scenario: ReviewIssueOpenFailed

- **WHEN** product task 需要创建 OpenSpec review 但创建失败
- **THEN** 系统 MUST 记录失败事件
- **AND** product task MUST 保持 `needs_human` 或进入 `blocked`
- **AND** 系统 MUST NOT 进入 programming 开发阶段

#### Scenario: ReviewPullFailed

- **WHEN** 系统无法读取处于 `needs_human` 的 OpenSpec review 回复
- **THEN** product task MUST 保持等待状态
- **AND** 系统 MUST NOT 基于旧回复或猜测推进

## MODIFIED Requirements

### Requirement: NeedsHumanState
系统 SHALL 允许通过 POST `/api/tasks/:id/needs-human` 将任务置为 needs_human；请求体 MUST 含 reason；该状态表示等待人工补充信息、审批、OpenSpec review 或外部评论回复。系统 MUST 通过 `HumanReview.requestType` 与 task metadata 区分 OpenSpec review、repair 和其他人工介入语义。

#### Scenario: ManualNeedsHuman
- **WHEN** POST needs-human 含 reason "High risk change requires review"
- **THEN** 任务 status 为 needs_human 且 reason 被审计

#### Scenario: ProductNeedsHumanMeansOpenSpecReview
- **WHEN** product task 因 OpenSpec review 进入 `needs_human`
- **THEN** HumanReview MUST 使用 `requestType=openspec_review`
- **AND** metadata MUST 标识该等待不是代码 repair

### Requirement: HumanReviewPersistence
系统 SHALL 支持 HumanReview 相关持久化（human_reviews 表），含 requestType、reason、externalThreadRef、responseSummary、status，用于人工介入审计与恢复。OpenSpec review MUST 使用 `requestType=openspec_review`，并记录 Meegle 审核入口引用和审核决策摘要。

#### Scenario: HumanReviewRecord
- **WHEN** 任务进入 needs_human 且存在 external thread
- **THEN** HumanReview 记录可被查询用于 recover 去重

#### Scenario: OpenSpecReviewRecord
- **WHEN** product task 创建 Meegle OpenSpec review 审核入口
- **THEN** HumanReview MUST 记录审核入口 externalThreadRef
- **AND** 后续审核回复 MUST 更新 responseSummary 与 status

## MODIFIED Requirements

### Requirement: LifecycleTerminologyAlignment
本 change 描述 product task OpenSpec 生成、审核与 programming handoff；历史中 `needs_human` 表示 OpenSpec review 等待、`queued` 表示可调度或审核后重新修订、`blocked` 表示预检或 approved OpenSpec 缺失。对齐 `refactor-task-lifecycle-model` 后：OpenSpec review MUST 使用 `waiting + WaitReason(type=approval, source=openspec-review)`；`queued` 读写为 `ready`；`needs_human` 与 `blocked` 读写为 `waiting`；审核修改后恢复 MUST 使用 `resumeTask()` 进入 `ready`；product agent 执行阶段 MUST 写入 RunAttempt.stage，Task 主状态保持 `active`。

#### Scenario: LegacyStatusNamesMapToSevenStateModel
- **WHEN** 读者或实现引用本 change 中的历史 Task 状态名
- **THEN** MUST 按 `openspec/changes/refactor-task-lifecycle-model/lifecycle-alignment.md` 或本目录 `lifecycle-alignment.md` 映射到 7 态模型
- **AND** 执行阶段 MUST NOT 写入 Task 主状态
