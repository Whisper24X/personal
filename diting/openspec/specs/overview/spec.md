# Overview Specification

> 基线：当前实现（截至 2026-06）
> 参考：README.md、docs/architecture/diting-architecture-description.md §1–3、docs/architecture/diting-technical-design.md

## Purpose

定义 diting 系统定位、核心架构原则与非目标边界，作为所有 capability spec 的上位约束。

## Requirements

### Requirement: SystemPositioning
diting SHALL 作为 local-first 的 AI 工程执行控制器，统一管理任务接入、调度、Goal Loop、观测与治理；MUST NOT 定位为单纯任务系统或单一 AI Agent，而是面向工程任务的执行控制平面。

#### Scenario: PluginDelegatedExecution
- **WHEN** 任务需要运行 Codex/Cursor CLI
- **THEN** 控制器通过 execution 插件调用而非内嵌工具链

### Requirement: CoreDomainStability
任务状态机、调度模型与修复循环 MUST 收敛在 packages/core 领域层；变化点（执行器、环境、任务来源、质量、治理）MUST 通过插件扩展。

#### Scenario: StateMachineInCore
- **WHEN** 新增任务状态迁移规则
- **THEN** 变更位于 packages/core 状态机而非 Fastify 路由层

### Requirement: FrameworkFreeCore
packages/core MUST 保持框架无关；Fastify MUST 仅承担传输；SQLite 访问 MUST 位于 server 包 repository 适配器后。

#### Scenario: NoFastifyInCore
- **WHEN** 审查 packages/core 依赖
- **THEN** 不包含 Fastify 或 HTTP 框架导入

### Requirement: EventFirstObservability
重要状态变化与系统行为 MUST 产出结构化事件并写入 logs/ 与 SSE（见 observability spec）。

#### Scenario: TransitionEmitsEvent
- **WHEN** 任务完成状态迁移
- **THEN** 产生可订阅的结构化事件

### Requirement: Recoverability
长流程 MUST 支持失败恢复与幂等；任务 MUST 支持 retry、recover、repair loop（见 task-lifecycle、repair-loop spec）。

#### Scenario: FailedToQueued
- **WHEN** 任务 failed 且运维 POST recover/retry
- **THEN** 可重新进入 queued 执行链

### Requirement: CommandQuerySeparation
对外 HTTP API MUST 区分命令端点（POST 状态变更）与查询端点（GET 聚合）；Presentation 层 MUST NOT 内含调度决策或插件业务逻辑。

#### Scenario: QueueViaPost
- **WHEN** 客户端需入队任务
- **THEN** 使用 POST 命令端点而非 GET

### Requirement: NonGoalsPhaseOne
第一阶段架构 MUST NOT 以以下能力为中心（MAY 未来扩展但不作为 spec 约束）：分布式多活、强多租户隔离、PB 级日志分析、组织级权限平台、跨区域高可用。

#### Scenario: LocalFirstDefault
- **WHEN** 默认部署形态
- **THEN** 单进程模块化单体 + 本地 SQLite 文件

### Requirement: ModularMonolithStyle
系统 SHALL 采用模块化单体 + Ports and Adapters + 领域服务编排；单仓库、单宿主、单进程起步，内部 MUST 强制模块边界。

#### Scenario: PluginApiPort
- **WHEN** core 调用执行能力
- **THEN** 依赖 plugin-api 接口而非具体 CLI 实现

## Technical Notes

- 目标态详述：openspec/design/target-architecture.md
- 实现概览：apps/server、packages/core、packages/plugin-api、apps/web
