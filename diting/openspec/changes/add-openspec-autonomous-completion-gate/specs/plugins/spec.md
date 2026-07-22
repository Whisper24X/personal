# Plugins Delta

## MODIFIED Requirements

### Requirement: PluginKinds
系统 SHALL 支持以下插件 kind：log、task-integration、environment、execution、completion-gate、quality、observability-governance。

#### Scenario: BuiltinStackKinds
- **WHEN** 未配置任何外置包
- **THEN** 宿主注册上述七类内置插件（execution 含 codex 与 cursor 两个实例，completion-gate 含 OpenSpec 默认实现）

### Requirement: HostAssemblyOrder
宿主 SHALL 按固定顺序拼装最终插件列表：log → task-integration → environment → execution → completion-gate → quality → observability-governance。

#### Scenario: AssemblyOrder
- **WHEN** createResolvedPlugins 合并内置与外置
- **THEN** 扁平列表顺序符合上述 kind 顺序，且 completion-gate 位于 execution 与 quality 之间

### Requirement: WholeKindExternalReplacement
当 `DITING_PLUGIN_*_PACKAGE` 非空时，宿主 MUST 仅注册外置包返回的该 kind 插件，该 kind 下全部内置实现 MUST NOT 再出现。

#### Scenario: ExternalCompletionGateReplace
- **WHEN** `TITING_PLUGIN_COMPLETION_GATE_PACKAGE` 指向有效模块
- **THEN** 内置 `openspec-completion-gate` 不再注册，宿主改用外置 completion-gate 插件

### Requirement: CreatePluginExportContract
外置模块 MUST 导出插件包工厂（命名导出、默认函数或默认对象字段）；宿主传入完整配置快照与期望 kind；返回对象 kind MUST 与期望一致，并满足该 kind 契约方法。

#### Scenario: InvalidCompletionGateContractRejected
- **WHEN** 外置 completion-gate 插件缺少 `evaluate()` 方法
- **THEN** 启动加载 MUST 失败并指出缺失方法

### Requirement: PluginRuntimeSelection
PluginRuntime SHALL 按 plugin_configs 的 enabled 过滤（无配置行视为启用）；environment、completion-gate、quality、log 等同 kind 按有效 priority 降序取第一个；execution MUST 按任务 executor 与 capabilities 匹配并结合 priority 选取。

#### Scenario: CompletionGatePriorityMatch
- **WHEN** 注册多个启用的 completion-gate 插件
- **THEN** 运行时选择有效 priority 最高的插件作为 primary completion gate

## ADDED Requirements

### Requirement: CompletionGatePluginContract
completion-gate 插件 SHALL 在 execution 完成后、quality 执行前评估任务完成度；插件 MUST 返回结构化检查项、包含未完成自动化任务的 `tasks.md` 文件路径、repair objective、repair doneWhen 与 metadata。

#### Scenario: CompletionGateReturnsIncompleteTasks
- **WHEN** OpenSpec change 中仍有无需人工介入的任务未完成
- **THEN** completion-gate 插件返回 `passed=false`，并在 `incompleteTasks` 中列出对应 `tasks.md` 文件路径
- **AND** MUST NOT 在 `incompleteTasks`、`repairObjective` 或 `repairDoneWhen` 中逐项列出 checkbox 文案
- **AND** 可在 metadata 中记录未完成 checkbox 计数

#### Scenario: CompletionGatePassesCompletedTasks
- **WHEN** OpenSpec change 中所有无需人工介入的任务均已完成
- **THEN** completion-gate 插件返回 `passed=true` 且 `incompleteTasks` 为空

### Requirement: OpenSpecCompletionGateParsing
默认 OpenSpec completion-gate 插件 SHALL 保守解析 `tasks.md` checkbox，只豁免明确人工介入任务；普通未勾选 task MUST 视为未完成自动化任务。

#### Scenario: ManualTaskExempted
- **WHEN** 未勾选 task 明确包含 `manual`、`human`、`需要人工`、`等待用户确认` 或 `用户在终端执行 openspec validate`
- **THEN** 默认插件不将该 task 计入未完成自动化任务

#### Scenario: AgentRunnableValidateNotExempted
- **WHEN** 未勾选 task 仅要求 Agent 运行或修复 `openspec validate`
- **THEN** 默认插件仍将该 task 视为未完成自动化任务

### Requirement: OpenSpecChangeResolution
默认 OpenSpec completion-gate 插件 SHALL 通过 `task.metadata.openspecChangeId`、workspace active change metadata、单一 active change fallback 依次定位 change；当 workspace 中存在多个候选 active changes 且任务未提供明确 change-id 时，默认插件 SHALL 扫描所有 active changes 的 `tasks.md` 并汇总未完成自动化任务。

#### Scenario: MetadataChangeIdWins
- **WHEN** `task.metadata.openspecChangeId` 指向存在的 OpenSpec change
- **THEN** 默认插件检查该 change 的 `tasks.md`

#### Scenario: MultipleChangesScanAll
- **WHEN** workspace 中存在多个候选 change 且任务未提供 `openspecChangeId`
- **THEN** 默认插件检查所有候选 change 的 `tasks.md`
- **AND** 未完成任务引用 MUST 只包含存在未完成自动化任务的 `tasks.md` 文件路径
