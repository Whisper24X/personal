# Execution Orchestration Specification

> 基线：当前实现（截至 2026-06）
> 参考：docs/architecture/diting-technical-design.md

## Purpose

定义 Goal Loop 主链编排步骤、执行器与工作流提示词（WORKFLOW_PROMPTS）语义，以及 controller 与 execution 插件的职责边界。

## Requirements

### Requirement: ControllerDoesNotExecuteTools
diting 控制器 SHALL 负责任务生命周期、调度、Goal Loop、观测与治理编排；MUST NOT 直接调用编码 CLI 或基础设施命令，这些能力 MUST 委托给插件。

#### Scenario: ExecutionViaPlugin
- **WHEN** 任务进入 running
- **THEN** 控制器通过 execution 插件 invoke 执行而非内嵌 CLI

### Requirement: GoalLoopSequence
Goal Loop SHALL 按序执行：(1) execution 插件运行；(2) 若 quality 启用则运行 quality；(3) eval 通过或 quality 禁用且 execution 成功则标记 done；(4) eval 失败或 quality 禁用且 execution 不可重试失败则创建/更新 repair goal；(5) 带 repair 上下文重跑 execution；(6) 重复直至成功或停止条件。

#### Scenario: QualityPassDone
- **WHEN** execution 成功且 quality eval 全部通过
- **THEN** 任务迁移至 done

### Requirement: WorkflowPromptLookup
Execution 插件 SHALL 将 WORKFLOW_PROMPTS.md 作为可选的一等控制输入；查找顺序 MUST 为显式 `workflowPromptsPath`，然后 `{workspacePath}/WORKFLOW_PROMPTS.md`，然后 `{workspacePath}/knowledge/WORKFLOW_PROMPTS.md`；若均不存在则 MUST 使用内置 Superpowers 默认 workflow。仓库 worktree 内 MUST NOT 搜索。

#### Scenario: WorkflowAtWorkspaceRoot
- **WHEN** WORKFLOW_PROMPTS.md 仅存在于工作区根目录
- **THEN** 执行器从该文件解析节点顺序与模板

#### Scenario: WorkflowInKnowledgeDir
- **WHEN** 工作区根目录无 WORKFLOW_PROMPTS.md 但存在 knowledge/WORKFLOW_PROMPTS.md
- **THEN** 执行器使用该文件解析节点顺序与模板

#### Scenario: WorkflowOmitted
- **WHEN** 工作区不存在 WORKFLOW_PROMPTS.md
- **THEN** 执行器使用内置 Superpowers 默认 workflow 执行任务

### Requirement: WorkflowPromptSemantics
工作流解析 MUST 支持：从 workflow 节解析默认节点顺序；从 `### <Node>` 解析节点模板；解析 node-local loopEnabled/maxLoops；从 task 与 workspace 上下文渲染变量；在同一 execution session 内顺序执行节点。

#### Scenario: SequentialNodes
- **WHEN** 工作流定义多节点
- **THEN** 单轮 execution 内按序执行各节点

### Requirement: WorkflowFailureBeforeQuality
无效的 WORKFLOW_PROMPTS.md MUST 在 quality 评测前使任务失败；缺失 WORKFLOW_PROMPTS.md MUST NOT 失败，而是回退到内置 Superpowers 默认 workflow。

#### Scenario: InvalidWorkflowFile
- **WHEN** 工作区存在但无法解析 WORKFLOW_PROMPTS.md
- **THEN** execution 阶段失败，不进入 evaluating

### Requirement: WorkflowLoopVsRepairLoop
节点级 workflow 循环 MUST 停留在单次 execution 内；controller 级 repairing MUST 为 execution 到 execution 的循环，不得被 workflow 内循环替代。

#### Scenario: RepairAcrossExecutions
- **WHEN** eval 失败触发 repairing
- **THEN** 下一轮 execution 为新 execution 记录而非同一 session 内 loop

### Requirement: ExecutorWorkspaceConstraint
Execution 插件 CLI cwd MUST 为 `PreparedWorkspace.workspacePath`（多仓编排根目录）；模板变量 MUST 包含 `reposRoot` 与 `reposList`；stdout/stderr SHOULD 经治理链路脱敏。

#### Scenario: ExecuteFromWorkspaceRoot
- **WHEN** execution 开始
- **THEN** CLI cwd 为工作区根目录而非单一仓库路径

### Requirement: PullRequestsBeforeDone
质量评测通过后、任务迁移至 done 之前，系统 SHALL 对每个有本地变更的仓库创建 Pull Request，并按仓探测默认 base 分支。

#### Scenario: PrPerChangedRepo
- **WHEN** 两个仓库均有本地变更
- **THEN** 创建两个 PR 并写入 `artifacts/prs.json`

## Technical Notes

- 实现：`packages/core/src/diting/execution-orchestrator.ts`、`packages/core/src/diting/service-execution.ts`
- 依赖：plugins、repair-loop、task-lifecycle
