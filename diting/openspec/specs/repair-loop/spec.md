# Repair Loop Specification

> 基线：当前实现（截至 2026-06）
> 参考：docs/architecture/diting-technical-design.md、docs/architecture/diting-config.md

## Purpose

定义 Goal Loop 修复循环的停止条件、repair goal 持久化及与 needs_human 配置的交互。

## Requirements

### Requirement: RepairGoalPersistence
系统 SHALL 在 `repair_goals` 表维护每任务至多一条 repair goal，含 objective、constraints、done_when、status、iteration、max_iterations、last_failure_hash。

#### Scenario: UpdateRepairGoal
- **WHEN** eval 失败且需继续修复
- **THEN** repair goal iteration 递增或创建新 goal

### Requirement: MaxRepairIterations
repair 轮次 MUST 受 `DITING_GOAL_MAX_REPAIR_ITERATIONS`（默认 3）限制；达到上限后 MUST 停止 repair 循环。

#### Scenario: BudgetExhausted
- **WHEN** iteration 达到 max_iterations 且仍未通过 eval
- **THEN** Goal Loop 停止 repair 并按配置以 failed 或 needs_human 结束

### Requirement: StopConditionEvalPass
当所有 eval checks 通过时，Goal Loop MUST 停止 repair 并将任务标记 done。

#### Scenario: EvalAllPass
- **WHEN** quality 返回 passed 且 acceptance 满足
- **THEN** 不再进入 repairing

### Requirement: StopConditionRepeatedFailure
当检测到 repeated identical failures（相同 failure hash）时，Goal Loop MUST 触发相应 stop signal。

#### Scenario: SameFailureHash
- **WHEN** 连续失败且 failure hash 与 last_failure_hash 相同
- **THEN** 停止条件被触发

### Requirement: StopConditionNoEffectiveDiff
当连续两轮无有效 diff（no effective diff twice in a row）时，Goal Loop MUST 触发 stop signal。

#### Scenario: NoDiffTwice
- **WHEN** 两轮 repair 均无有效代码变更
- **THEN** 停止 repair 继续

### Requirement: StopConditionRiskPolicy
当 risk policy 阻断进一步执行时，Goal Loop MUST 停止自动 repair。

#### Scenario: HighRiskBlocked
- **WHEN** governance/quality 判定高风险且策略阻断
- **THEN** 不再自动进入下一轮 execution

### Requirement: StopConditionHumanIntervention
当任务需要人工介入（needs_human 路径或 `DITING_GOAL_ENABLE_NEEDS_HUMAN_LOOP=true` 下 stop signal 转人工）时，Goal Loop MUST 停止自动 repair 直至 recover。

#### Scenario: NeedsHumanLoopEnabled
- **WHEN** `DITING_GOAL_ENABLE_NEEDS_HUMAN_LOOP` 为 true 且命中 high_risk/repeated_failure/no_effective_diff
- **THEN** 任务转入 needs_human 并可通过 integration 回写评论

### Requirement: NeedsHumanLoopDisabledBehavior
当 `DITING_GOAL_ENABLE_NEEDS_HUMAN_LOOP` 为 false 时，上述 stop signal MUST 继续 repair 并写 goal.stop_reason_continued；达迭代上限后写 goal.budget_exhausted 并以 failed 结束。

#### Scenario: ContinueRepairOnHighRisk
- **WHEN** needs_human loop 禁用且命中 high_risk stop signal
- **THEN** 系统继续 repair 而非自动 needs_human

## Technical Notes

- 实现：`packages/core/src/diting/repair-loop-service.ts`
- 依赖：execution-orchestration、human-intervention、configuration
