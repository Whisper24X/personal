# Observability Specification

> 基线：当前实现（截至 2026-06）
> 参考：docs/architecture/diting-api.md、docs/architecture/diting-config.md、docs/architecture/diting-technical-design.md

## Purpose

定义结构化日志落盘、SSE 事件流、trace 聚合与观测 API 的数据源与 payload 约定。

## Requirements

### Requirement: LogDirectoryLayout
Log 插件 SHALL 将结构化日志写入仓库根 `logs/` 目录，至少包含：

- `logs/system/system.log`
- `logs/tasks/<taskId>/task.log`
- `logs/tasks/<taskId>/execution-<executionId>.log`
- `logs/tasks/<taskId>/executor/<executionId>-stdout.log`、stderr、summary
- `logs/traces/<traceId>/trace.log`

#### Scenario: TaskLogPath
- **WHEN** 任务产生业务日志
- **THEN** 写入 `logs/tasks/<taskId>/task.log`

### Requirement: LogPluginCapabilities
Log 插件 MUST 支持 append、按 task/trace lookup、SSE 订阅与快照；execution 控制台输出 MUST 归入任务专属 executor 子目录。

#### Scenario: SseSubscription
- **WHEN** 客户端连接 GET `/api/events`
- **THEN** log 插件提供最近事件快照与实时订阅流

### Requirement: SseEventPayload
SSE 事件 JSON MUST 含 id、schemaVersion、eventType、timestamp、data.correlation；格式为 `event: <eventType>` 与 `data: <json>`。

#### Scenario: EventCorrelation
- **WHEN** 任务状态迁移产生事件
- **THEN** SSE data.correlation 可关联 taskId/traceId

### Requirement: ObservabilityApiAggregate
GET `/api/tasks/:id/observability` MUST 返回 schemaVersion、task、transitions、executions、executionLogs、evalResults、repairGoal 聚合视图。

#### Scenario: FullTaskObservability
- **WHEN** 查询已执行任务的 observability
- **THEN** 响应包含 transitions 与 executionLogs

### Requirement: TraceLogAggregation
GET `/api/traces/:traceId` 的 executionLogs MUST 由 `logs/traces/<traceId>/trace.log` 与 task 级文件日志聚合，而非数据库 execution_logs。

#### Scenario: TraceLogsFromFiles
- **WHEN** 按 traceId 查询
- **THEN** executionLogs 来自文件体系

### Requirement: TransitionStructuredLogging
任务状态迁移 MUST 产生含 from、to、reason、operator、traceId 的结构化 log 条目（见 task-lifecycle spec）。

#### Scenario: TransitionInTaskLog
- **WHEN** 任务 queued → running
- **THEN** logs/tasks/<taskId>/ 下可见结构化 transition 事件

### Requirement: SchemaVersionConsistency
观测相关 API 响应中的 schemaVersion MUST 与运行中服务发布的观测模式版本一致。

#### Scenario: HealthSchemaVersion
- **WHEN** GET `/api/health`
- **THEN** 响应含 schemaVersion 字段

## Technical Notes

- 实现：`apps/server/src/diting/log-adapters.ts`、`apps/server/src/diting/event-stream.ts`、`apps/server/src/diting/ops-view.ts`
- 依赖：plugins（log）、persistence、http-api
