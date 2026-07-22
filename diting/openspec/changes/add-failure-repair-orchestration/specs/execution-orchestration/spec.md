# Execution Orchestration Delta

## MODIFIED Requirements

### Requirement: GoalLoopSequence
Goal Loop SHALL 按序执行：(1) execution 插件运行；(2) 若任务关联 OpenSpec change，则运行 completion-gate；(3) completion-gate 通过后，若 quality 启用则运行 quality；(4) 所有失败路径 MUST 先记录统一 failure repair 事实；(5) completion-gate、quality 或可自动修复的 execution failure 创建/更新 repair goal；(6) 带 repair 上下文重跑 execution；(7) retryable execution failure MUST 先遵循现有 retry policy；(8) 重复直至成功或停止条件；(9) environment、preflight、pull request、unknown 等非自动修复失败 MUST 按策略进入 blocked 或 needs_human。

#### Scenario: FailureRecordedBeforeRepair
- **WHEN** quality eval 返回 `passed=false`
- **THEN** 控制器 MUST 先写入统一 failure repair 记录
- **AND** 再创建或更新 repair goal

#### Scenario: NonRepairableFailureDoesNotInvokeExecutor
- **WHEN** environment preparation 失败且重试预算耗尽
- **THEN** 控制器 MUST 记录 failure repair 事实
- **AND** MUST NOT 调用 execution 插件尝试代码修复

### Requirement: WorkflowFailureBeforeQuality
无效的 WORKFLOW_PROMPTS.md MUST 在 quality 评测前被记录为 `workflow_prompt` failure；当系统可安全 fallback 到内置默认 workflow 或无 workflow 模式时，任务 MUST NOT 因该失败进入 failed 或 blocked，而是 MUST 记录 `skip_with_record` 并继续执行。仅当 fallback 后的 execution 仍失败时，才按 `execution` failure 处理；若 fallback 不可用，系统 MUST 将后续终止原因归类为 `execution` 或 `unknown` failure。

#### Scenario: InvalidWorkflowFileSkippedWithRecord
- **WHEN** 工作区存在但无法解析 WORKFLOW_PROMPTS.md
- **THEN** 控制器 MUST 记录 `failure.workflow_prompt_skipped`
- **AND** `task.metadata.failureRepair.lastFailure.kind` MUST 为 `workflow_prompt`
- **AND** `task.metadata.failureRepair.strategy` MUST 为 `skip_with_record`
- **AND** 任务 MUST 继续使用 fallback workflow 执行

#### Scenario: FallbackExecutionFailureUsesExecutionStrategy
- **WHEN** workflow prompt 失败已被跳过且 fallback execution 随后失败
- **THEN** 后续失败 MUST 记录为 `execution` failure
- **AND** 按 execution failure 策略决定是否自动修复

#### Scenario: WorkflowFallbackUnavailableStopsAsRealFailure
- **WHEN** WORKFLOW_PROMPTS.md 失败且系统无法安全 fallback
- **THEN** 系统 MUST NOT 使用 `skip_with_record` 作为最终策略
- **AND** MUST 将终止原因记录为 `execution` 或 `unknown` failure

## ADDED Requirements

### Requirement: UnifiedFailureRepairDecision
系统 SHALL 对所有任务失败生成统一失败修复决策，至少包含 failureKind、strategy、failureHash、failureSummary、failureDetail 与 repairPlan。

#### Scenario: DecisionContainsRepairPlan
- **WHEN** execution 返回不可重试失败
- **THEN** failure repair decision MUST 包含 repairPlan.objective、repairPlan.constraints 与 repairPlan.doneWhen

#### Scenario: FailureHashStable
- **WHEN** 同一任务连续遇到相同失败摘要、失败检查项和错误类别
- **THEN** failureHash SHOULD 保持稳定，以便 repeated failure 与外部子任务幂等复用

### Requirement: FailureRepairStrategyRouting
系统 SHALL 按 failureKind 选择默认 strategy：quality、completion_gate、明确可由代码执行器修复的 execution failure 使用 `auto_repair`；workflow_prompt 在可安全 fallback 时使用 `skip_with_record`；environment 与 preflight 使用 `blocked`；pull_request 使用 `needs_human` 或 `blocked`；unknown 使用 `needs_human`。

#### Scenario: QualityAutoRepair
- **WHEN** quality failed 且不是 Meegle child issue 人工闭环
- **THEN** strategy MUST 为 `auto_repair`
- **AND** 任务 MUST 进入 repair loop

#### Scenario: RetryableExecutionFailureUsesRetryPolicyFirst
- **WHEN** execution failure 被判定为 retryable 且 retry budget 尚未耗尽
- **THEN** 系统 MUST 先按 retry policy 重新入队或内联重试
- **AND** MUST NOT 因该 retryable failure 立即创建 repair goal

#### Scenario: RetryBudgetExhaustedRoutesByFailureNature
- **WHEN** retryable execution failure 的 retry budget 已耗尽
- **THEN** 系统 MUST 记录统一 failure repair 事实
- **AND** 若失败指向启动、环境、配置或外部服务问题，strategy MUST 为 `blocked`
- **AND** 若失败明确可由代码修改修复，strategy MAY 为 `auto_repair`

#### Scenario: PreflightBlocked
- **WHEN** task preflight failed
- **THEN** strategy MUST 为 `blocked`
- **AND** 任务 MUST NOT 自动调用 execution 插件修复

#### Scenario: UnknownNeedsHuman
- **WHEN** 控制器捕获未分类异常
- **THEN** strategy MUST 为 `needs_human`
- **AND** failureDetail MUST 包含异常 message 与可用上下文
