# Execution Orchestration Delta

## MODIFIED Requirements

### Requirement: GoalLoopSequence
Goal Loop SHALL 按序执行：(1) execution 插件运行；(2) 若任务关联 OpenSpec change，则运行 completion-gate；(3) completion-gate 通过后，若 quality 启用则运行 quality；(4) completion-gate failure 创建/更新 repair goal；(5) 带 repair 上下文重跑 execution；(6) completion-gate repair 后仍失败时，在当前 `TitingTask` 下继续 repair，直到通过或预算耗尽；(7) eval 失败仍进入既有 repair loop。

#### Scenario: CompletionGateBeforeQuality
- **WHEN** execution 成功且任务关联 OpenSpec change
- **THEN** 控制器 MUST 在调用 `QualityPlugin.evaluate` 前调用 primary completion-gate 插件

#### Scenario: CompletionGatePassThenQuality
- **WHEN** completion-gate 返回 `passed=true`
- **THEN** 控制器继续执行原 quality 评估流程

## ADDED Requirements

### Requirement: CompletionGateBlocksQuality
OpenSpec 任务的 completion-gate failure MUST 阻止 quality 执行；该失败不是 quality failure，MUST NOT 创建 `EvalResult`。

#### Scenario: IncompleteTasksDoNotRunQuality
- **WHEN** completion-gate 返回 `passed=false` 且列出包含未完成自动化任务的 `tasks.md` 文件路径
- **THEN** 控制器不调用 `QualityPlugin.evaluate`
- **AND** 不创建 `EvalResult`
- **AND** 任务进入 repair loop

#### Scenario: IncompleteTasksStillFailAfterRepair
- **WHEN** completion-gate 已经触发过一次 repair，且下一轮仍返回 `passed=false`
- **THEN** 控制器 MUST 继续在当前 `TitingTask` 下进入下一轮 repair
- **AND** MUST NOT 调用 `QualityPlugin.evaluate`
- **AND** MUST NOT 将当前任务结束为 `done`
- **AND** 直到 completion-gate 返回 `passed=true` 或 repair 预算耗尽

#### Scenario: MissingGateFailsClosedForOpenSpec
- **WHEN** 任务关联 OpenSpec change 但没有启用任何 completion-gate 插件
- **THEN** 控制器 MUST fail-closed
- **AND** 不得进入 quality

### Requirement: CompletionGateRepairLoop
completion-gate failure SHALL 复用现有 repair loop，并通过 `RepairGoal.metadata` 标识来源和包含未完成任务的 `tasks.md` 文件路径；repair 后仍失败时 SHALL 在当前任务下继续 repair，直到通过或预算耗尽。

#### Scenario: RepairGoalFromCompletionGate
- **WHEN** completion-gate 返回未完成自动化任务
- **THEN** 控制器创建或更新 repair goal
- **AND** `metadata.repairSource` 为 `completion-gate`
- **AND** `metadata.incompleteTasks` 包含对应 `tasks.md` 文件路径

#### Scenario: CompletionGateIterationStarted
- **WHEN** completion-gate failure 启动下一轮开发
- **THEN** 控制器记录 `completion_gate.iteration_started`
- **AND** task 状态迁移为 `repairing`

#### Scenario: CompletionGateContinuesAfterRepair
- **WHEN** completion-gate 经一次 repair 后仍返回未完成自动化任务
- **THEN** 控制器 MUST 更新 repair goal 的 `metadata.incompleteTasks`
- **AND** MUST 在当前 `TitingTask` 下启动下一轮 repair

### Requirement: NonOpenSpecGateSkip
非 OpenSpec 任务 SHALL 不强制执行 completion-gate，并继续既有 quality 流程。

#### Scenario: NonOpenSpecTaskContinuesQuality
- **WHEN** 任务未关联 OpenSpec change 且 workspace 中没有可定位的 OpenSpec change
- **THEN** 控制器 MUST NOT 因缺少 completion-gate 而 fail-closed
- **AND** 继续执行 quality 流程
