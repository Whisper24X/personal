# Human Intervention Specification

> 基线：当前实现（截至 2026-06）
> 参考：docs/architecture/diting-api.md、docs/architecture/diting-config.md

## Purpose

定义 needs_human、blocked 状态语义、人工恢复 API 及与 Goal Loop stop signal 的交互。

## Requirements

### Requirement: NeedsHumanState
系统 SHALL 允许通过 POST `/api/tasks/:id/needs-human` 将任务置为 needs_human；请求体 MUST 含 reason；该状态表示等待人工补充信息、审批或外部评论回复。

#### Scenario: ManualNeedsHuman
- **WHEN** POST needs-human 含 reason "High risk change requires review"
- **THEN** 任务 status 为 needs_human 且 reason 被审计

### Requirement: BlockedState
系统 SHALL 允许通过 POST `/api/tasks/:id/block` 将任务置为 blocked；blocked 表示自动重试已停止，需人工修复环境、依赖或配置。

#### Scenario: BlockTask
- **WHEN** POST block 含 reason
- **THEN** 任务 status 为 blocked

### Requirement: RecoverEndpoint
POST `/api/tasks/:id/recover` SHALL 支持从 blocked、needs_human、failed 恢复执行链；请求体 MAY 含 reason。

#### Scenario: RecoverFromNeedsHuman
- **WHEN** needs_human 任务收到 recover
- **THEN** 任务重新进入 queued 路径可被调度

### Requirement: EvaluatingToNeedsHuman
状态机 SHALL 允许 evaluating → needs_human、repairing → needs_human 迁移。

#### Scenario: EvaluatingNeedsHuman
- **WHEN** evaluating 阶段判定需人工
- **THEN** 合法迁移至 needs_human

### Requirement: AutomaticNeedsHumanLoop
当 `DITING_GOAL_ENABLE_NEEDS_HUMAN_LOOP=true` 且任务来源插件支持人工回复闭环时，high_risk、repeated_failure、no_effective_diff 等 stop signal MUST 自动转入 needs_human，并通过 task-integration 回写评论；收到用户评论回复后 MUST 可自动恢复执行链。

#### Scenario: AutoNeedsHumanWithIntegration
- **WHEN** needs_human loop 启用且 integration 支持 pullHumanReplies
- **THEN** stop signal 转 needs_human 而非直接 failed

### Requirement: HumanReviewPersistence
系统 SHALL 支持 HumanReview 相关持久化（human_reviews 表），含 requestType、reason、externalThreadRef、responseSummary、status，用于人工介入审计与恢复。

#### Scenario: HumanReviewRecord
- **WHEN** 任务进入 needs_human 且存在 external thread
- **THEN** HumanReview 记录可被查询用于 recover 去重

## Technical Notes

- 实现：`packages/core/src/diting/human-intervention-service.ts`
- 依赖：repair-loop、task-lifecycle、http-api
