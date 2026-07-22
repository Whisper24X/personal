# Observability Delta

## ADDED Requirements

### Requirement: CompletionGateRunStage
运行观测 SHALL 支持 `completion_gate` stage，并在阶段顺序中将其放置于 `execute` 与 `quality` 之间。

#### Scenario: StageOrderIncludesCompletionGate
- **WHEN** 查询 run observability
- **THEN** stages 顺序包含 `workspace`、`execute`、`completion_gate`、`quality`、`repair`、`pull_request`、`done`

### Requirement: CompletionGateLogInference
运行观测 SHALL 将 `completion_gate.*` 日志映射到 `completion_gate` stage，并据事件后缀推断 running、done、failed 或 skipped 状态。

#### Scenario: CompletionGateCompletedLog
- **WHEN** execution logs 包含 `completion_gate.completed`
- **THEN** run step stage 为 `completion_gate`
- **AND** step status 为 `done`

#### Scenario: CompletionGateSkippedLog
- **WHEN** execution logs 包含 `completion_gate.skipped`
- **THEN** run step stage 为 `completion_gate`
- **AND** step status 为 `skipped`

### Requirement: CompletionGateRepairObservability
completion-gate 触发 repair loop 时，观测输出 SHALL 可区分 completion-gate repair 与 quality repair。

#### Scenario: CompletionGateRepairMetadataVisible
- **WHEN** completion-gate failure 创建 repair goal
- **THEN** observability 聚合中的 repair goal metadata 包含 `repairSource: "completion-gate"`
- **AND** 包含对应 `tasks.md` 文件路径引用与未完成数量

### Requirement: CompletionGateFrontendTimeline
前端 run timeline SHALL 展示 `completion_gate` stage。

#### Scenario: TimelineShowsCompletionGate
- **WHEN** run observability stages 包含 `completion_gate`
- **THEN** 前端阶段进度条展示 `completion_gate` 节点
