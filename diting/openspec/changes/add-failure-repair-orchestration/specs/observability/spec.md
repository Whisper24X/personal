# Observability Delta

## ADDED Requirements

### Requirement: FailureRepairStructuredLogs
系统 SHALL 为统一失败修复编排写入结构化 execution log，事件名至少包括 `failure.recorded`、`failure.repair_plan_created`、`failure.auto_repair_invoked`、`failure.workflow_prompt_skipped`、`failure.blocked` 与 `failure.needs_human`。

#### Scenario: FailureRecordedLog
- **WHEN** 任意 failure repair decision 被创建
- **THEN** execution logs MUST 包含 `failure.recorded`
- **AND** log data MUST 包含 failureKind、strategy、failureHash 与 failureSummary

#### Scenario: AutoRepairInvokedLog
- **WHEN** failure repair strategy 为 `auto_repair`
- **THEN** execution logs MUST 包含 `failure.auto_repair_invoked`
- **AND** log data MUST 包含 repairPlan

### Requirement: FailureRepairMetadataVisible
任务观测聚合 SHALL 暴露 failure repair 信息，使调用方可读取 lastFailure、repairPlan、strategy 与 history。实现 MAY 通过返回包含 `metadata.failureRepair` 的 task 对象，或通过兼容的顶层 `failureRepair` 摘要字段暴露该信息；响应 MUST 保持现有调用方兼容。

#### Scenario: ObservabilityIncludesFailureRepair
- **WHEN** 查询发生过失败的任务 observability
- **THEN** 响应 MUST 包含 task metadata 中的 failureRepair 或等价的 `failureRepair` 摘要字段
- **AND** failureRepair.lastFailure.summary MUST 与最近一次 `failure.recorded` 日志一致

### Requirement: WorkflowPromptSkipObservable
workflow prompt fallback 必须可观测；系统 SHALL 写入专门日志并保留错误详情摘要。

#### Scenario: WorkflowPromptSkipLog
- **WHEN** WORKFLOW_PROMPTS.md 解析失败但系统 fallback 继续
- **THEN** execution logs MUST 包含 `failure.workflow_prompt_skipped`
- **AND** log data MUST 包含 workflowError、fallbackMode 与 failureHash
