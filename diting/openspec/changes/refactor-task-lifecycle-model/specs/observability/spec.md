## MODIFIED Requirements

### Requirement: TaskListShowsMainStatus
观测视图和 UI 列表 SHALL 展示 Task 主状态，MUST NOT 将 AttemptStage 当作任务状态展示。

#### Scenario: ActiveTaskListSummary
- **WHEN** 任务正在 quality eval
- **THEN** 列表中的任务 status MUST 是 `active`
- **AND** 详情或摘要 MAY 展示 AttemptStage `evaluating`

### Requirement: DetailShowsAttemptAndWaitReason
任务详情、诊断和 execution log SHALL 能展示当前 RunAttempt stage、WaitReason、Failure/Repair 摘要和关联 traceId。

#### Scenario: WaitingDiagnosisIncludesRecoverableBy
- **WHEN** operator 诊断 `waiting` 任务
- **THEN** 诊断输出 MUST 包含 WaitReason type、message、externalRef、recoverableBy

### Requirement: TransitionEventsUseNewLifecycleNames
结构化事件和 execution log SHALL 使用新任务主状态名。旧状态名 MAY 只出现在 legacy migration 记录中。

#### Scenario: TransitionLogUsesSucceeded
- **WHEN** 任务完成并通过质量门禁
- **THEN** transition log MUST 记录 `active -> succeeded`
- **AND** MUST NOT 记录 `evaluating -> done`
