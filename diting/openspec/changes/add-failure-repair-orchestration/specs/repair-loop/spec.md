# Repair Loop Delta

## ADDED Requirements

### Requirement: FailureRepairMetadata
系统 SHALL 在 `task.metadata.failureRepair` 中维护最近失败事实、修复方案、策略和有限历史；该 metadata MUST 可被 repair loop、观测 API 和人工排查读取。

#### Scenario: LastFailureRecorded
- **WHEN** 任务发生 quality failed
- **THEN** `task.metadata.failureRepair.lastFailure.kind` MUST 为 `quality`
- **AND** lastFailure MUST 包含 hash、summary、detail、occurredAt 与 executionId

#### Scenario: FailureHistoryBounded
- **WHEN** 同一任务记录超过 10 次 failure repair 事实
- **THEN** `task.metadata.failureRepair.history` MUST 只保留最近 10 条

### Requirement: AutoRepairUsesRepairGoal
当 failure repair strategy 为 `auto_repair` 时，系统 SHALL 复用 `repair_goals` 作为下一轮 execution 的修复输入；repair goal MUST 与 failure repair 的 repairPlan 保持一致。

#### Scenario: ExecutionFailureCreatesRepairGoal
- **WHEN** execution failure 被判定为 `auto_repair`
- **THEN** 系统 MUST 创建或更新 repair goal
- **AND** repair goal objective MUST 来源于 failure repair repairPlan.objective
- **AND** repair goal last_failure_hash MUST 等于 failure repair failureHash

### Requirement: NonRepairableFailureStopsAutoRepair
当 failure repair strategy 为 `blocked`、`needs_human` 或 `skip_with_record` 时，系统 MUST NOT 仅因生成了 repairPlan 而自动启动 repair iteration。

#### Scenario: EnvironmentFailureDoesNotRepair
- **WHEN** environment failure strategy 为 `blocked`
- **THEN** 系统 MUST NOT 写入 `goal.iteration_started`
- **AND** MUST NOT 调用 execution 插件进行代码修复

#### Scenario: WorkflowPromptSkipDoesNotRepair
- **WHEN** workflow prompt failure strategy 为 `skip_with_record`
- **THEN** 系统 MUST NOT 创建 repair goal
- **AND** MUST 继续当前 execution fallback 路径
