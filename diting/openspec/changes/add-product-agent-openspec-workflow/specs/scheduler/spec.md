## ADDED Requirements

### Requirement: ProductAgentCapacity

启动时系统 SHALL 支持 seed `product-agent-*` 记录作为产品经理 Agent 并发容量；product agent MUST 只接收 `agentKind=product` 的任务。

#### Scenario: SeedProductAgents

- **WHEN** 配置的 product agent count 大于 0
- **THEN** agents 表 MUST 存在对应数量的 `kind=product` 或等价 `executor=product` 的 product agent
- **AND** 这些 agent MUST 使用 `driverId=openspec-product`

#### Scenario: ProductAgentDoesNotClaimProgrammingTask

- **WHEN** 存在 idle product agent 与 queued programming task
- **THEN** product agent MUST NOT claim programming task

### Requirement: AgentKindWorkerDispatch

Agent worker pool SHALL 按 agent kind 查找可 claim 的 queued task；同一 worker 一次只能 claim 一个与自身 kind 匹配的任务，并通过 repository CAS 绑定 agent 与 task。

#### Scenario: ProductWorkerClaimsProductTask

- **WHEN** 存在 idle product agent 与 queued product task
- **THEN** worker MUST 将该 product task 迁移至 running
- **AND** agent 记录 MUST 绑定该 taskId

#### Scenario: ProgrammingWorkerStillClaimsProgrammingTask

- **WHEN** 存在 idle programming agent 与 queued programming task
- **THEN** worker MUST 保持既有 programming dispatch 行为

#### Scenario: AgentKindMismatchSkipped

- **WHEN** queued task 的 `agentKind` 与 idle agent kind 不匹配
- **THEN** worker MUST 跳过该任务
- **AND** MUST NOT 抢占其他 kind 的容量槽

## MODIFIED Requirements

### Requirement: SeedAgentCount
启动时 SHALL 根据 `DITING_SCHEDULER_AGENT_COUNT`（默认 2，兼容 `DITING_AGENT_COUNT`）seed 指定数量的 `programming-agent-*` 记录；该数量即编程任务最大并发数。系统还 SHALL 根据 product agent 配置 seed `product-agent-*` 记录；product agent 数量不影响 programming agent 并发数。

#### Scenario: DefaultTwoAgents
- **WHEN** 使用默认配置首次启动
- **THEN** agents 表存在 2 条 `executor=programming` 的 seed agent

#### Scenario: ProductAgentsSeededSeparately
- **WHEN** product agent count 配置为 1
- **THEN** agents 表存在 1 条 product agent
- **AND** programming agent 数量仍按 `DITING_SCHEDULER_AGENT_COUNT` 计算

### Requirement: QueuedToRunningDispatch
Agent worker MUST 将 queued 任务分派给可用且 kind 匹配的 agent，驱动任务进入 running 并创建 execution 记录；product task MUST 分派给 product agent，programming task MUST 分派给 programming agent。执行插件选择 MUST 匹配任务的 `agentKind`、`driverId`、`runtimeProviderId` 与 capabilities。

#### Scenario: DispatchMatchedExecutor
- **WHEN** queued 任务 executor 为 programming 且存在 idle programming agent 与 programming capability 插件
- **THEN** 任务进入 running 并绑定 agent_id

#### Scenario: DispatchMatchedProductAgent
- **WHEN** queued 任务 `agentKind=product` 且存在 idle product agent 与 product capability 插件
- **THEN** 任务进入 running 并绑定 product agent id
- **AND** execution 记录 MUST 包含 `agentKind=product` 与 `driverId=openspec-product`
