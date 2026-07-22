# Plugins Specification

> 基线：当前实现（截至 2026-06）
> 参考：docs/architecture/diting-plugin-development.md、docs/architecture/diting-technical-design.md

## Purpose

定义插件 kind 契约、宿主装配顺序、外置替换规则、运行时选择与就绪检查边界。

## Requirements

### Requirement: PluginKinds
系统 SHALL 支持以下插件 kind：log、task-integration、execution、environment、quality、observability-governance。

#### Scenario: BuiltinStackKinds
- **WHEN** 未配置任何外置包
- **THEN** 宿主注册上述六类内置插件（execution 含 codex 与 cursor 两个实例）

### Requirement: PluginRequiredFields
每个插件 MUST 提供稳定 id、kind、priority、capabilities 列表及 health 检查；MAY 实现 init 接收与 plugin_id 匹配的配置行。

#### Scenario: HealthCheck
- **WHEN** 宿主启动并调用插件 health
- **THEN** 每个已注册插件返回健康状态供 readiness 聚合

### Requirement: HostAssemblyOrder
宿主 SHALL 按固定顺序拼装最终插件列表：log → task-integration → environment → execution → quality → observability-governance。

#### Scenario: AssemblyOrder
- **WHEN** createResolvedPlugins 合并内置与外置
- **THEN** 扁平列表顺序符合上述 kind 顺序

### Requirement: WholeKindExternalReplacement
当 `DITING_PLUGIN_*_PACKAGE` 非空时，宿主 MUST 仅注册外置 `createPlugin` 返回的单个插件，该 kind 下全部内置实现 MUST NOT 再出现。

#### Scenario: ExternalLogReplace
- **WHEN** `DITING_PLUGIN_LOG_PACKAGE` 指向有效模块
- **THEN** 内置 root-logs 不再注册

### Requirement: CreatePluginExportContract
外置模块 MUST 导出 `createPlugin` 工厂（命名导出、默认函数或默认对象字段）；宿主传入完整配置快照与期望 kind；返回对象 kind MUST 与期望一致，并满足该 kind 契约方法。

#### Scenario: InvalidKindRejected
- **WHEN** createPlugin 返回 kind 与宿主期望不一致
- **THEN** 启动加载 MUST 失败

### Requirement: PluginRuntimeSelection
PluginRuntime SHALL 按 plugin_configs 的 enabled 过滤（无配置行视为启用）；environment、quality、log 等同 kind 按有效 priority 降序取第一个；execution MUST 按任务 executor 与 capabilities 匹配并结合 priority 选取。

#### Scenario: ExecutorCapabilityMatch
- **WHEN** 任务 executor 为 codex
- **THEN** 调度 MUST 选择 capabilities 含 codex 的 execution 插件

### Requirement: LogPluginRequired
运行时 MUST 存在至少一个可用 log 插件，以支撑 SSE、任务日志 API 与 execution log 适配器。

#### Scenario: MissingLogPlugin
- **WHEN** 无任何 log 插件可用
- **THEN** 宿主 bootstrap 或 readiness MUST 反映不可用

### Requirement: ReadinessRequiredKinds
GET `/api/readiness` 的插件检查 MUST 要求 environment、execution、observability-governance 三类各自至少有一个健康插件；log、quality、task-integration 不参与 readiness 门禁但缺失仍影响业务链路。

#### Scenario: ReadinessWithoutExecution
- **WHEN** 无健康 execution 插件
- **THEN** readiness plugins 检查 MUST 失败

### Requirement: TaskIntegrationBoundaries
task-integration 插件 SHALL 拉取外部任务、映射为 ditingTask、回写结果；外部任务 MUST 用 source + externalId 唯一标识；MUST NOT 在插件内推进状态机。

#### Scenario: ExternalIdUniqueness
- **WHEN** 同一 source+externalId 重复接入
- **THEN** 持久化层按唯一约束处理

### Requirement: HttpRouteExtension
满足通用运行时插件形状的实现 SHALL 支持可选的 registerRoutes，将 Fastify 路由（如 Meegle webhook）挂到宿主。

#### Scenario: MeegleWebhookRoute
- **WHEN** 内置 Meegle 插件加载
- **THEN** `/api/integrations/meegle/*` 路由可用

### Requirement: NoDirectPersistenceBypass
插件 MUST NOT 绕过应用服务层直接改写 SQLite 或自建任务状态机；业务日志 MUST 经 log 插件写入 `logs/` 树。

#### Scenario: PluginUsesServiceLayer
- **WHEN** 插件需持久化业务数据
- **THEN** 通过宿主注入的 repository/服务接口而非裸 SQL

### Requirement: MultiRepoWorkspaceLayout
Environment 插件 SHALL 在 `{workspacePath}/repos/<slug>/` 为每个仓库准备 git worktree，共用同一任务分支，并设置 `PreparedWorkspace.repos` 与各仓 path/cachePath。

#### Scenario: TwoReposPrepared
- **WHEN** `metadata.repos` 列出两个仓库 URL
- **THEN** `prepareWorkspace` 在 `repos/` 下创建两个 worktree，且 `repoPath` 指向第一个仓库路径

### Requirement: SpecDocumentMaterialization
Environment 插件 SHALL 在 execution 前将飞书 spec 附件物化到工作区根目录；压缩包 spec MUST 在根级包含 `openspec/` 目录；重名时 MUST 使用 `{basename}-{n}{ext}` 另存，不得覆盖。

#### Scenario: SpecZipExtracted
- **WHEN** spec 附件为 zip
- **THEN** 内容解压到工作区根目录并校验存在 `openspec/`

#### Scenario: SpecZipWithoutOpenSpecBlocked
- **WHEN** spec 压缩包缺少根级 `openspec/`
- **THEN** 任务在预检或工作区准备阶段失败，且错误指向 spec 包结构

### Requirement: SpecSkillsLoad
Spec 物化后，environment 插件 SHALL 扫描可选的 `skills/` 或 `.cursor/skills/` 下的 `SKILL.md` 并合并到 `{workspacePath}/.cursor/skills/` 供 CLI 发现；当根级 `skills/` 由本次 spec 物化新增时，加载后 MUST 清理该源目录，避免作为待提交文件留在工作区根目录。

#### Scenario: SkillsMerged
- **WHEN** spec 含 `skills/demo/SKILL.md`
- **THEN** 工作区存在 `.cursor/skills/demo/SKILL.md`，且不保留本次 spec 物化新增的根级 `skills/`

### Requirement: TaskPreflightBeforeWorkspace
`prepareWorkspace` 之前系统 SHALL 运行任务预检（仓库列表、spec 附件、`openspec/` 包结构；若提供 WORKFLOW_PROMPTS 则校验其合规）；失败 MUST 将任务置为 `blocked` 且不创建工作区目录。

#### Scenario: PreflightBlocksMissingSpec
- **WHEN** spec 附件为空
- **THEN** 任务为 `blocked` 且不创建 worktree

## Technical Notes

- 契约：`packages/plugin-api/`
- 选择层：`packages/core/src/diting/plugin-runtime.ts`、`plugin-capability-router.ts`、`plugin-policy-engine.ts`
- 装配：`apps/server/src/diting/external-plugins.ts`、`plugins/index.ts`
