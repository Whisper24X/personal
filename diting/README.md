# 谛听(diting)

谛听 是一个 local-first 的 AI 工程执行控制器。它负责任务生命周期、调度、Goal Loop、观测、治理，以及把外部任务源接入统一执行链路。

运行时需要 Node.js 自带的内置 SQLite 绑定（node:sqlite），具体见架构文档。默认数据库路径为 .diting/sqlite/diting.sqlite，可用环境变量 DATABASE_FILE 覆盖。

技术栈概要：

- 后端宿主：Fastify
- 核心：纯 TypeScript（core 包）
- 插件协议：plugin-api 稳定契约包
- 持久化：SQLite 单文件与 SQL 迁移；数据访问实现在服务端应用中（仓储层类名前缀为 Pg，底层为 SQLite）
- 运行能力：本地 git worktree、Codex/Cursor CLI、质量检查链
- 前端：React 控制台

## 目录结构

应用与包位于 apps 与 packages 目录；设计、配置与运维说明在 docs/architecture；可选工作流提示词模板在 docs/templates。

## 内置插件栈

宿主在源码中按插件种类编排默认实现；进程启动时再根据环境变量是否与外置包合并：**若配置了 DITING_PLUGIN_*_PACKAGE，则对应的整个种类由外置模块单独替换**。策略与范例见下文「如何新增插件」及插件开发文档。

| 顺序 (Order) | 插件标识 (Plugin ID) | 类型 (kind) | 能力标签 (capability) | 说明 |
| --- | --- | --- | --- | --- |
| 1 | root-logs | log | default | 根目录 logs 目录结构化落盘与 SSE 数据源 |
| 2 | meegle | task-integration | meegle | Meegle 文件轮询、Webhook，或可选 CLI 拉最新迭代 |
| 3 | git-worktree-local | environment | local-worktree | 镜像缓存、git worktree、依赖安装与清理 |
| 4 | codex / cursor | agent | code-change / repair / workflow | 编码 AgentDriver 下的 runtime provider |
| 5 | openspec-product-codex / openspec-product-cursor | agent | product / openspec | 产品 AgentDriver：生成或修订 OpenSpec change，进入 Meegle 审核门禁 |
| 6 | default-quality | quality | default | 静态检测、单元测试、启动测试、自动化报告评分及 diff 风险 |
| 7 | default-observability-governance | observability-governance | default | 命令策略、脱敏、敏感信息扫描与评测后策略 |
| 8 | gitlab | platform | gitlab / merge-request / cli-auth | GitLab CLI（`glab`）健康检查、设备码授权与 MR 创建前置检测 |

任务会先路由到 `agentKind`，再由 driver 选择能力边界；Codex/Cursor 只是 runtime provider。历史 `executor` 字段仍兼容读取。`agentKind=product` 默认使用 `driverId=openspec-product` 和 Codex runtime，Cursor 可作为 fallback。

## 关键能力

- 任务状态机：自创建直至完成的多阶段迁移
- Goal Loop：支持修复续跑、重复失败收敛、无有效 diff、高风险等停止条件
- 工程环境与工作区管理与清理策略
- 编码 Agent 通过工作流提示词文件驱动多节点执行
- 产品 Agent 在临时 workspace 内生成或导入 OpenSpec change，经 Meegle 审核后才创建编程任务
- 四层质量检测链与变更风险度量
- 治理与观测、trace 聚合与诊断脚本
- 任务来源：手动创建 Meegle 轮询或 Webhook

## Workflow Prompt System

飞书 `spec文档` 包可在工作区根提供可选的工作流说明文件：

- knowledge/WORKFLOW_PROMPTS.md
- WORKFLOW_PROMPTS.md

编码 Agent 解析节点顺序、模板与本地循环上限，在同一工作区内顺序执行；若未提供 `WORKFLOW_PROMPTS.md`，则使用内置 Superpowers 默认 workflow。

OpenSpec product workflow 中 `spec.zip` 是兼容入口而非通用前置条件：附件存在时导入；不存在时 product agent 在 workspace 内生成 `openspec/` 与 review artifact。只有 Meegle 审核回复以 `【评审通过】` 开头时，调度器才会创建后续 `agentKind=programming` 任务。

## 快速开始

### 环境要求

- Node.js + npm（需支持内置模块 node:sqlite）
- git
- codex CLI 或 Cursor 的 agent 子命令

### 安装

```bash
npm install
```

### 启动数据库迁移

```bash
npm run migration:run -w apps/server
```

### 启动服务

```bash
npm run dev:backend
npm run dev:frontend
```

默认地址：

- Web：http://localhost:5173
- API：http://localhost:3000/api

## 常用命令

```bash
npm run build
npm test
npm run migration:run -w apps/server
npm run migration:legacy -w apps/server
npm run smoke:sqlite -w apps/server
npm run diagnose:task -w apps/server -- --task-id <task-id>
```

## 文档

**开发规范（索引）**：[docs/dev-spec/README.md](./docs/dev-spec/README.md) — Git、OpenSpec 工作流、双轨文档、插件约束、工作流提示词、本地测试与门禁。

设计与实现：[Agent 层重构](./docs/architecture/diting-agent-architecture.md)、[产品 Agent 使用手册](./docs/architecture/diting-product-agent-usage.md)、[实施计划](./docs/architecture/diting-product-plan.md)、[技术设计](./docs/architecture/diting-technical-design.md)、[HTTP API](./docs/architecture/diting-api.md)、[数据库 Schema](./docs/architecture/diting-database-schema.md)、[插件开发](./docs/architecture/diting-plugin-development.md)

配置与运维：[配置说明](./docs/architecture/diting-config.md)、[本地开发](./docs/architecture/diting-local-dev.md)、[生产部署](./docs/architecture/diting-deployment.md)、[运维手册](./docs/architecture/diting-ops.md)、[未完成任务清单](./docs/architecture/diting-open-tasks.md)

工程规范（OpenSpec 真源）：见 [架构文档索引](./docs/architecture/index.md) 与 [`openspec/specs/`](./openspec/specs/)。归档 change 后叙事文档与 README 由 skill `openspec-archive-sync-docs` 同步。

工作流提示词模板：[WORKFLOW_PROMPTS 示例](./docs/templates/WORKFLOW_PROMPTS.example.md)（约定见 [dev-spec/workflow-prompts](./docs/dev-spec/workflow-prompts/README.md)）。

首次克隆后请在根目录执行 `npm install` 以安装 `husky` hooks（见 [Git 提交质量门禁](./docs/dev-spec/repo/git-commit-quality-gates.md)）。

## 如何新增插件

### 外置插件（不改本仓库源码）

在配置中填入各插件种类对应的环境变量，指向 npm 包名或可动态导入的文件路径；包须导出 createPlugin（接收配置快照与 pluginKind），并返回符合该种类的单个插件。编码能力现在统一归入 `agent` 种类，Codex/Cursor 作为 runtime provider 扫描与选择。**细则与可复制思路**见 [插件开发文档](./docs/architecture/diting-plugin-development.md)。

### 内置插件（本仓库）

1. **对齐契约**：先在插件契约包中为领域概念补类型与接口。
2. **在本仓实现**：在服务端应用的插件目录内新增类或函数，补上 id、kind、priority、capabilities、health（及可选 init）。
3. **注册**：把新实例并入内置插件分组；运行时的优先与启用仍由插件配置表与运行时共同决定。
4. **如需 Webhook**：在任务接入实现上顺带满足宿主约定的「可注册 HTTP 路由」扩展形状。
5. **专有配置**：需要新环境变量时走统一的配置快照结构，运行时开关仍可依赖插件配置表或 HTTP 运维接口更新。
6. **测试**：为健康检查、主干路径及外置装载若有交叉影响则补回归。

设计与边界仍以 [插件开发文档](./docs/architecture/diting-plugin-development.md) 为准。

## Changelog

### 2026-06-02
- **开发规范索引**：扩展 `docs/dev-spec/` 为六域导航（OpenSpec、双轨文档、插件约束、工作流提示词、测试与 Git 门禁）；见 [dev-spec/README.md](./docs/dev-spec/README.md)。
- **Git 提交规范**：Conventional Commits + `commitlint`；Source Control「生成 commit message」读根目录 [`.cursorrules`](./.cursorrules)；详见 [Git 提交说明规范](./docs/dev-spec/repo/git-commit-convention.md) 与 [Git 提交质量门禁](./docs/dev-spec/repo/git-commit-quality-gates.md)。
- **OpenSpec 工程规范**：新增 `openspec/specs/`（13 个 capability）、`openspec/design/` 摘要、`docs/architecture/index.md` 双轨导航；`docs/architecture/diting-*.md` 保留为叙事参考。归档流程接入 `openspec-archive-sync-docs`，自动同步架构文档与 README。

### 2026-05-13
- **品牌与定位**：项目更名为 diting，定位为 local-first 的 AI 工程执行控制器（任务生命周期、调度、Goal Loop、观测、治理与外部任务源统一接入）。
- **运行时架构**：服务端宿主为 Fastify；编排与状态机在 `packages/core`（如 `ServiceScheduler`、`ServiceExecution`、插件运行时、repair / goal 逻辑）；对外稳定契约为 `packages/plugin-api`。
- **插件栈**：默认内置根日志、Meegle 接入、本地 git worktree 环境、Codex/Cursor CLI 执行、默认质量链与观测治理插件；可通过各 `DITING_PLUGIN_*_PACKAGE` 用外置包**整体替换**对应插件种类（execution 外置时会同时替换内置 Codex 与 Cursor）。
- **工作流提示词**：支持 spec 工作区根的 `WORKFLOW_PROMPTS.md` 或 `knowledge/WORKFLOW_PROMPTS.md` 解析节点顺序、模板与循环上限；缺失时使用内置 Superpowers 默认 workflow。
- **持久化**：使用 Node.js 内置 `node:sqlite` 与单文件 SQLite；迁移由服务端 SQL 脚本驱动，并提供 legacy 迁移命令（见上文常用命令）；默认库路径见文首，可用 `DATABASE_FILE` 覆盖。
- **质量与人类介入**：默认质量插件覆盖静态检测、单元测试、启动测试与自动化测试报告评分；API/UI 自动化在开发验证流程执行，质量插件只读取既有报告指标并结合 diff 风险评分。配置侧增强并支持 needs-human 相关循环与交接场景。
- **观测与运维**：强化运行时事件与执行上下文日志；提供 `diagnose:task`、`smoke:sqlite` 等命令；根目录结构化日志与控制台 SSE 数据源由内置 log 插件承担。
- **前端**：运维控制台统一为 monorepo 内 `apps/web`（React），取代历史上独立的 ops-console 插件前端交付形态。
- **仓库瘦身**：移除 Nest 模块化宿主、TypeORM 中心化数据访问及独立 codex/cursor executor 等插件包路径，对应能力收敛到 `apps/server` 内置插件实现与 SQLite 仓储。

### 2026-06-10
- **Agent 层重构**：新增 [Agent 层重构方案](./docs/architecture/diting-agent-architecture.md)，把执行模型从顶层 execution 下沉到 agent / driver / runtime provider。
- **配置与看板**：新增 agent 相关配置别名与动态编码 runtime 扫描，运维看板开始展示 agent / driver / runtime 路由。
