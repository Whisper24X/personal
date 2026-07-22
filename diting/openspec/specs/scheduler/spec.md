# Scheduler Specification

> 基线：当前实现（截至 2026-06）
> 参考：docs/architecture/diting-technical-design.md、docs/architecture/diting-api.md、docs/architecture/diting-config.md

## Purpose

定义周期性调度、Agent 容量、heartbeat 超时与任务分派到 execution 的运行时行为。

## Requirements

### Requirement: SchedulerTickInterval
Scheduler SHALL 按 `DITING_SCHEDULER_INTERVAL_MS`（默认 30000ms）周期性 tick；POST `/api/debug/scheduler` MUST 支持手工触发一次 dispatch。

#### Scenario: PeriodicDispatch
- **WHEN** 服务运行且存在 queued 任务与 idle agent
- **THEN** 在一个 tick 周期内尝试分派任务

### Requirement: SeedAgentCount
启动时 SHALL 根据 `DITING_SCHEDULER_AGENT_COUNT`（默认 2，兼容 `DITING_AGENT_COUNT`）seed 指定数量的 `programming-agent-*` 记录；该数量即编程任务最大并发数。

#### Scenario: DefaultTwoAgents
- **WHEN** 使用默认配置首次启动
- **THEN** agents 表存在 2 条 `executor=programming` 的 seed agent

### Requirement: LegacyExecutorAgentRetirement
启动时 SHOULD 将无任务的旧 `codex` / `cursor` agent 标记为 `disabled`，避免继续参与新任务调度；busy 的旧 agent MUST NOT 被 seed 流程修改。

#### Scenario: DisableIdleLegacyAgents
- **WHEN** 启动时存在 task_id 为空的 codex/cursor agent
- **THEN** 这些旧 agent 被标记为 disabled

#### Scenario: PreserveBusyLegacyAgents
- **WHEN** 启动时存在 busy 且绑定 task_id 的 codex/cursor agent
- **THEN** seed 流程不修改该 agent

### Requirement: AgentHeartbeatTimeout
Agent MUST 通过 POST `/api/agents/:id/heartbeat` 或服务端后台 idle heartbeat loop 刷新 heartbeat；超过 `DITING_SCHEDULER_AGENT_OFFLINE_TIMEOUT_MS`（默认 300000ms）无 heartbeat 的 agent SHOULD 视为离线并不再参与分派。

#### Scenario: HeartbeatRefresh
- **WHEN** agent POST heartbeat 含 status idle
- **THEN** last_heartbeat_at 更新

#### Scenario: IdleHeartbeatLoop
- **WHEN** 服务运行且 agent 处于 idle
- **THEN** 后台 idle heartbeat loop 会周期性刷新 last_heartbeat_at，避免正常空转的 agent 被误判为离线

### Requirement: AgentManualControl
系统 SHALL 提供 POST `/api/agents/:id/disable`、enable、recover，允许人工摘除或恢复 agent。

#### Scenario: DisableAgent
- **WHEN** POST disable 某 agent
- **THEN** 该 agent 不再接收新任务分派

### Requirement: QueuedToRunningDispatch
Agent worker MUST 将 queued 编程任务分派给可用 programming agent，驱动任务进入 running 并创建 execution 记录；执行插件选择 MUST 匹配任务 executor 与 execution 插件 capabilities。

#### Scenario: DispatchMatchedExecutor
- **WHEN** queued 任务 executor 为 programming 且存在 idle programming agent 与 programming capability 插件
- **THEN** 任务进入 running 并绑定 agent_id

### Requirement: AgentStatePersistence
Agent 状态 SHALL 持久化于 `agents` 表，含 status、task_id、executor、labels_json、last_heartbeat_at。

#### Scenario: AgentAssignedTask
- **WHEN** 任务分派成功
- **THEN** agent 记录关联 task_id 且 status 反映 busy/idle

## Technical Notes

- 实现：`packages/core/src/diting/scheduler-service.ts`、`packages/core/src/diting/service-scheduler.ts`
- 依赖：task-lifecycle、plugins、configuration
