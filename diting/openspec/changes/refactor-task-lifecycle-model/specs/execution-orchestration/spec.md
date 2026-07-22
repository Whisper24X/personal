## MODIFIED Requirements

### Requirement: GoalLoopSequence
Goal Loop SHALL 按序推进当前 RunAttempt：preparing、executing、completion_checking、evaluating、repairing、creating_pr。执行细节 MUST 写入 RunAttempt stage 或 ExecutionRecord，MUST NOT 将 `evaluating`、`repairing`、`creating_pr` 写入 Task 主状态。

#### Scenario: QualityPassSucceedsTask
- **WHEN** execution 成功、completion gate 通过且 quality eval 全部通过
- **THEN** 当前 RunAttempt MUST 进入 `creating_pr` 并在交付物创建成功后进入 `completed`
- **AND** 任务 MUST 从 `active` 迁移到 `succeeded`

### Requirement: CompletionGateAttemptStage
OpenSpec completion gate SHALL 表示为 RunAttempt stage `completion_checking`。gate 失败但可修复时，RunAttempt SHALL 进入 `repairing`；需要人工审批或外部输入时，任务 SHALL 进入 `waiting` 并写入 WaitReason。

#### Scenario: CompletionGateNeedsApproval
- **WHEN** completion gate 发现 OpenSpec 自动化任务未完成且需要人工判断
- **THEN** 任务 MUST 迁移到 `waiting`
- **AND** WaitReason type MUST 是 `approval`

### Requirement: WorkflowFailureBeforeQuality
无效的 WORKFLOW_PROMPTS.md MUST 使当前 RunAttempt 在进入 quality 前失败或进入可修复阶段。任务是否进入 `waiting`、`failed` 或 `ready` MUST 由 failure strategy、repair budget 和 release policy 决定。

#### Scenario: InvalidWorkflowCanRepair
- **WHEN** WORKFLOW_PROMPTS.md 无效且 repair budget 尚未耗尽
- **THEN** 当前 RunAttempt MUST 进入 `repairing`
- **AND** 任务主状态 MUST 保持 `active`

### Requirement: PullRequestsBeforeSucceeded
质量评测通过后、任务迁移至 `succeeded` 之前，系统 SHALL 对每个有本地变更的仓库创建 Pull Request 或 Merge Request，并在当前 RunAttempt 中记录 `creating_pr` 阶段。

#### Scenario: PrPerChangedRepoBeforeSuccess
- **WHEN** 两个仓库均有本地变更
- **THEN** 系统 MUST 创建两个 PR 或 MR 并写入交付物
- **AND** 创建完成后任务 MUST 迁移至 `succeeded`
