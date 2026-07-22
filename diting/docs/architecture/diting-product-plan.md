# diting Agent 层实施计划

更新日期：2026-06-10

本文档基于 [diting-agent-architecture.md](./diting-agent-architecture.md) 形成实施计划，目标是把 `execution(codex/cursor)` 重构为 `agent -> driver -> runtime provider` 的稳定链路。

## 目标

1. 让 `agent` 成为一等领域概念，后续可扩展非编码 agent。
2. 保留 Codex/Cursor 作为编码 `runtime provider`，支持动态扫描、排序、禁用和多实例并存。
3. 保留旧 `executor` 与旧配置的兼容读写，不强制迁移历史数据。
4. 让调度、worker pool、任务执行、看板展示统一围绕 `agent` 语义。

## 实施范围

- 契约层：补齐 `AgentKind`、`AgentRequest`、`AgentDriverPlugin`、`CodingRuntimeProvider`。
- 核心层：新增 `normalizeAgentRequest`，让任务先路由到 agent，再路由到 driver/runtime。
- 服务层：重构 agent pool、插件运行时和执行编排，支持同 kind 多实例。
- 服务端：保留原 API 表面，补充 agent/driver/runtime 字段。
- 前端：任务、runs、agents、plugins 看板展示新层次。
- 文档：同步 README、architecture index 与新的设计文档。

## 配置计划

### 新配置面

- `scheduler.agents.programming.count`
- `scheduler.agents.programming.offlineTimeoutMs`
- `scheduler.agents.programming.workerPollIntervalMs`
- `plugins.agents.packageName`
- `plugins.agents.defaultKind`
- `plugins.agents.defaultRuntime`
- `plugins.agents.codexBin`
- `plugins.agents.cursorBin`

### 兼容配置面

- `plugins.execution.*`
- `DITING_DEFAULT_EXECUTOR`
- `CODEX_CLI_BIN`
- `CURSOR_CLI_BIN`
- `DITING_SCHEDULER_AGENT_COUNT`
- `DITING_AGENT_COUNT`

## 里程碑

### M1 契约与兼容

- 新增 agent 领域类型。
- 旧任务继续可读，可创建，可执行。
- 旧 `executor=codex/cursor/programming` 映射到新 agent request。

### M2 编码 Driver 合并

- Codex/Cursor 收敛到一个编码 agent driver。
- runtime provider 可动态扫描和多实例注册。
- 默认优先级为 Codex > Cursor。

### M3 调度泛化

- Agent pool 以 `agent.kind` 作为并发容量维度。
- 同 kind 多 agent 可并发执行。
- 忙碌 agent 不会重复 claim。

### M4 看板与运维

- 运维看板展示 `kind / driverId / runtimeProviderId / displayName`。
- 运行详情展示选中的 runtime provider。
- 插件页支持启用、禁用、排序和健康状态查看。

### M5 非编码扩展

- 新增 review / triage / docs / qa 等 agent kind。
- 非编码 agent 可接入独立 driver。
- 不需要改编码主链路。

## 验收标准

- 旧任务继续能跑。
- Codex/Cursor 可以同时存在多个实例。
- 默认选择 Codex，Codex 不可用时 fallback Cursor。
- 前端能看见 agent / driver / runtime 的完整路由。
- 新增非编码 agent 不需要修改 coding driver 的核心逻辑。

