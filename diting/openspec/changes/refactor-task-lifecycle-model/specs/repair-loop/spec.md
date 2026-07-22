## MODIFIED Requirements

### Requirement: RepairLoopUsesAttemptStage
repair loop SHALL 使用当前 RunAttempt stage `repairing` 表示修复阶段，MUST NOT 将任务主状态写为 `repairing`。任务在修复期间 MUST 保持 `active`，除非需要等待外部输入或预算耗尽。

#### Scenario: EvalFailureStartsRepairStage
- **WHEN** quality eval 失败且 repair budget 尚未耗尽
- **THEN** 当前 RunAttempt MUST 进入 `repairing`
- **AND** 任务主状态 MUST 保持 `active`

### Requirement: RepairStopSignalToWaitReason
high_risk、repeated_failure、no_effective_diff、environment_blocked、policy_blocked 等 stop signal 需要人工或外部处理时，系统 SHALL 通过 `pauseForWait()` 将任务迁移到 `waiting` 并写入 WaitReason。

#### Scenario: HighRiskPausesForHumanInput
- **WHEN** repair stop signal 是 high_risk
- **THEN** 任务 MUST 迁移到 `waiting`
- **AND** WaitReason type MUST 是 `human_input` 或 `approval`

### Requirement: RepairBudgetFailure
当自动修复预算耗尽且无需外部输入时，系统 SHALL 将当前 RunAttempt 标记为 `failed`，并将任务迁移到 `failed`。后续恢复 MUST 通过 `retryTask()` 创建新的 Attempt 预算上下文。

#### Scenario: BudgetExhaustedFailsTask
- **WHEN** repair budget 已耗尽且失败不可自动恢复
- **THEN** 当前 RunAttempt MUST 进入 `failed`
- **AND** 任务 MUST 迁移到 `failed`
