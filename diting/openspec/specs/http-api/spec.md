# HTTP API Specification

> 基线：当前实现（截至 2026-06）
> 参考：docs/architecture/diting-api.md

## Purpose

定义 Fastify 宿主对外 HTTP API 的通用约定、健康检查、任务命令与查询、Agent、插件、集成、调试与 SSE 行为。

## Requirements

### Requirement: ApiBasePathAndJson
除 SSE 外，所有 API SHALL 挂载在 `/api` 前缀下；请求与响应 MUST 为 JSON。失败响应 MUST 为含 `error` 字段的 JSON 对象。

#### Scenario: JsonErrorResponse
- **WHEN** 请求处理失败
- **THEN** 响应体为 JSON 且包含 `error` 字段

### Requirement: SchemaVersionInResponses
任务相关聚合响应 SHALL 包含 `schemaVersion` 字段，取值与运行中服务发布的观测模式版本一致。

#### Scenario: TaskObservabilitySchemaVersion
- **WHEN** 调用 GET `/api/tasks/:id/observability`
- **THEN** 响应包含 `schemaVersion` 字段

### Requirement: HealthAlive
GET `/api/health` SHALL 返回进程存活状态，包含 `ok`、`status`（alive）、`schemaVersion`、`service`（diting）、`timestamp`。

#### Scenario: HealthCheck
- **WHEN** 客户端请求 GET `/api/health`
- **THEN** 响应 `ok` 为 true 且 `status` 为 alive

### Requirement: ReadinessAggregation
GET `/api/readiness` SHALL 聚合数据库与插件健康；`checks.plugins.requiredKinds` MUST 检查 environment、execution、observability-governance 三类各自存在健康插件；`total`/`healthy` 统计全部注册插件。

#### Scenario: ReadinessReady
- **WHEN** 数据库就绪且三类 requiredKinds 均有健康插件
- **THEN** 响应 `ok` 为 true 且 `status` 为 ready

### Requirement: CreateTaskRequiredFields
POST `/api/tasks` 创建任务时 MUST 提供 `title`、`instruction`、`repo`；`branch` 可选，省略或空白时 MUST 按服务进程时区生成 `feature/YYYYMMDDHHmmss-<taskId前8位>`。

#### Scenario: CreateTaskMinimal
- **WHEN** POST 体含 title、instruction、repo 且无 branch
- **THEN** 任务创建成功且 branch 为自动生成的 feature 分支名

### Requirement: TaskLifecycleCommands
系统 SHALL 提供以下任务状态命令端点：POST `/api/tasks/:id/validate`、queue、retry、block、needs-human、recover、cancel；各端点 MUST 通过应用服务驱动状态机而非直接改库。

#### Scenario: QueueTask
- **WHEN** 对 validated 任务 POST `/api/tasks/:id/queue`
- **THEN** 任务进入 queued 状态

### Requirement: BlockAndNeedsHumanBody
POST `/api/tasks/:id/block` 与 POST `/api/tasks/:id/needs-human` SHALL 接受 JSON 请求体含 `reason` 字段。

#### Scenario: BlockWithReason
- **WHEN** POST block 且 body 含 reason
- **THEN** 任务进入 blocked 且 reason 被记录

### Requirement: RecoverFromExceptionStates
POST `/api/tasks/:id/recover` SHALL 支持从 blocked、needs_human、failed 等状态恢复执行链；请求体 MAY 含 `reason`。

#### Scenario: RecoverBlocked
- **WHEN** 对 blocked 任务 POST recover
- **THEN** 任务重新进入可调度队列路径

### Requirement: TaskObservabilityEndpoints
系统 SHALL 提供 GET `/api/tasks/:id/executions`、transitions、logs、observability、eval-results、repair-goal；observability 响应 MUST 聚合 task、transitions、executions、executionLogs、evalResults、repairGoal。

#### Scenario: ObservabilityAggregate
- **WHEN** GET `/api/tasks/:id/observability`
- **THEN** 响应包含上述聚合字段

### Requirement: TraceAggregate
GET `/api/traces/:traceId` SHALL 按 trace 聚合 tasks、transitions、executions、executionLogs、evalResults、repairGoals。

#### Scenario: TraceQuery
- **WHEN** GET `/api/traces/:traceId` 且 trace 存在
- **THEN** 返回与该 trace 关联的多表聚合视图

### Requirement: FileBackedTaskLogs
GET `/api/tasks/:id/logs` 与 trace/observability 中的 executionLogs MUST 从 `logs/` 文件体系读取，而非 `execution_logs` 数据库表。

#### Scenario: TaskLogsFromFiles
- **WHEN** GET `/api/tasks/:id/logs`
- **THEN** 数据源为 `logs/tasks/<taskId>/` 下文件

### Requirement: AgentEndpoints
系统 SHALL 提供 GET `/api/agents` 与 POST `/api/agents/:id/heartbeat`、disable、enable、recover；heartbeat 请求体 MAY 含 `status`（如 idle）。

#### Scenario: AgentHeartbeat
- **WHEN** POST `/api/agents/:id/heartbeat` 含 status
- **THEN** agent 的 last_heartbeat 更新

### Requirement: PluginConfigEndpoints
系统 SHALL 提供 GET `/api/plugins`、GET/POST `/api/plugin-configs`；POST 体 MUST 含 pluginId、kind、enabled、priority，MAY 含 config 对象。

#### Scenario: UpdatePluginConfig
- **WHEN** POST `/api/plugin-configs` 含有效 pluginId 与 kind
- **THEN** 插件配置覆盖被持久化

### Requirement: MeegleWebhookIntegration
POST `/api/integrations/meegle/webhook` SHALL 要求请求头 `x-diting-webhook-secret` 与配置的 secret 匹配；请求体 MUST 支持单任务 `{ task: {...} }` 或批量 `{ tasks: [] }` 格式。

#### Scenario: MeegleWebhookAuth
- **WHEN** webhook secret 不匹配
- **THEN** 请求 MUST 被拒绝

### Requirement: DebugAndDashboard
系统 SHALL 提供 GET `/api/dashboard` 聚合统计；POST `/api/debug/sync` 触发 integration sync；POST `/api/debug/scheduler` 触发一次 scheduler dispatch。

#### Scenario: ManualSchedulerTick
- **WHEN** POST `/api/debug/scheduler`
- **THEN** scheduler 执行一次 dispatch 周期

### Requirement: SseEventsEndpoint
GET `/api/events` SHALL 提供 SSE 流；事件格式为 `event: <eventType>` 与 `data: <json>`；JSON MUST 含 id、schemaVersion、eventType、timestamp、data.correlation；数据源 MUST 来自文件日志插件的快照与订阅，而非仅内存事件流。

#### Scenario: SseEventShape
- **WHEN** 客户端订阅 `/api/events` 并收到事件
- **THEN** data JSON 包含 schemaVersion 与 eventType

## Technical Notes

- 实现：`apps/server/src/diting/server.ts`
- 依赖：task-lifecycle、observability、persistence、plugins
