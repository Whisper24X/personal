## ADDED Requirements

### Requirement: MeegleQualityFailureStopsForChildIssue

当 Meegle 父任务发生 quality failed 时，系统 SHALL 在进入自动 repair 前创建或复用子 issue，并将父任务转入人工等待；该行为 MUST 覆盖首轮低风险 quality failed，即使没有触发 high_risk、repeated_failure 或 no_effective_diff stop signal。

#### Scenario: FirstLowRiskQualityFailure

- **WHEN** Meegle 父任务首轮 execution 成功但 quality eval 返回 `passed: false`、`riskLevel: low`
- **THEN** 系统 MUST 调用子 issue 创建或复用能力
- **AND** 父任务 MUST 迁移到 `needs_human`
- **AND** 系统 MUST NOT 写入 `goal.iteration_started`

#### Scenario: StopSignalQualityFailure

- **WHEN** Meegle 父任务 quality failed 且命中 high_risk、repeated_failure 或 no_effective_diff
- **THEN** 系统 MUST 创建或复用子 issue
- **AND** 父任务 MUST 迁移到 `needs_human`
- **AND** 系统 MUST NOT 自动开始下一轮 repair

### Requirement: RepairOnlyExecutionAfterChildIssueRecovery

当父任务由子 issue 方案恢复时，下一次 execution SHALL 使用 repair-only 语义；执行提示词 MUST 聚焦失败检查项、失败摘要和人工方案，MUST NOT 要求重新实现完整父需求。

#### Scenario: RepairOnlyPrompt

- **WHEN** 父任务从子 issue 方案恢复到 `queued`
- **THEN** repair goal MUST 标记 repair-only 执行语义
- **AND** execution prompt MUST 包含失败检查项和人工方案
- **AND** execution prompt MUST NOT 将完整父任务 acceptance criteria 作为本轮完成范围

### Requirement: ChildIssueWorkspaceRetention

当父任务进入 `needs_human` 等待子 issue 方案时，系统 SHALL 保留当前工作区，以便后续定向修复可复用上下文；任务完成为 `done` 后才执行常规清理。

#### Scenario: NeedsHumanDoesNotCleanupWorkspace

- **WHEN** Meegle 父任务 quality failed 后进入 `needs_human`
- **THEN** environment cleanup MUST NOT 因该状态立即执行
- **AND** 后续恢复到 `queued` 后 MUST 可继续基于保留工作区进行定向修复
