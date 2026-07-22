# Configuration Specification

> 基线：当前实现（截至 2026-06）
> 参考：docs/architecture/diting-config.md

## Purpose

定义 diting 服务端从环境变量装载配置、启动前校验及兼容旧变量名的规则。

## Requirements

### Requirement: ConfigBootstrapValidation
系统 SHALL 在启动前通过配置读取与校验函数装载结构化配置；所有毫秒超时、重试次数、repair 轮次 MUST 为正数。

#### Scenario: InvalidTimeout
- **WHEN** 某超时环境变量为非正数
- **THEN** 启动校验 MUST 失败并阻止服务就绪

### Requirement: WorkspacePathDistinct
工作区根目录（`DITING_WORKSPACE_ROOT`，默认 `.diting/workspaces`）与镜像缓存根目录（`DITING_WORKSPACE_REPO_CACHE_ROOT`，默认 `.diting/repos`）MUST NOT 为同一路径。

#### Scenario: SamePathRejected
- **WHEN** 两路径解析为同一目录
- **THEN** 启动校验 MUST 失败

### Requirement: DatabaseFileEnv
系统 SHALL 支持 `DATABASE_FILE` 指定 SQLite 文件路径；父目录不存在时 MUST 自动创建。

#### Scenario: CustomDatabaseFile
- **WHEN** 设置 `DATABASE_FILE` 为有效路径
- **THEN** 服务使用该路径作为 SQLite 文件

### Requirement: BackendPort
系统 SHALL 使用 `BACKEND_PORT`（默认 `3000`）作为 Fastify listen 端口。

#### Scenario: DefaultPort
- **WHEN** 未设置 `BACKEND_PORT`
- **THEN** 服务监听 3000 端口

### Requirement: SchedulerEnvDefaults
调度相关环境变量 SHALL 默认为：`DITING_SCHEDULER_INTERVAL_MS=30000`、`DITING_SCHEDULER_AGENT_COUNT=2`（兼容 `DITING_AGENT_COUNT`）、`DITING_SCHEDULER_AGENT_OFFLINE_TIMEOUT_MS=300000`（兼容 `DITING_AGENT_OFFLINE_TIMEOUT_MS`）、`DITING_AGENT_WORKER_POLL_INTERVAL_MS=1000`。

#### Scenario: SchedulerTick
- **WHEN** 使用默认调度配置
- **THEN** scheduler tick 间隔为 30 秒

### Requirement: GoalRecoveryLimits
Goal 恢复参数 SHALL 支持：`DITING_GOAL_EXECUTION_TIMEOUT_MS`（默认 36000000）、`DITING_GOAL_QUALITY_TIMEOUT_MS`（默认 600000）、`DITING_GOAL_ENVIRONMENT_RETRY_LIMIT`（默认 2）、`DITING_GOAL_EXECUTION_RETRY_LIMIT`（默认 2）、`DITING_GOAL_MAX_REPAIR_ITERATIONS`（默认 3）、`DITING_GOAL_ENABLE_NEEDS_HUMAN_LOOP`（默认 false）。

#### Scenario: NeedsHumanLoopDisabled
- **WHEN** `DITING_GOAL_ENABLE_NEEDS_HUMAN_LOOP` 为 false
- **THEN** 高风险等 stop signal 继续 repair 而非自动转 needs_human

### Requirement: ExternalPluginPackageEnv
各 `DITING_PLUGIN_*_PACKAGE` 环境变量非空时，宿主 MUST 对该 kind 执行整类外置替换；为空时 MUST 保留该 kind 全部内置插件。

#### Scenario: ExecutionExternalReplace
- **WHEN** `DITING_PLUGIN_EXECUTION_PACKAGE` 非空
- **THEN** 内置 Codex 与 Cursor 执行器均不再注册，仅加载外置模块返回的单个 execution 插件

### Requirement: PrCommitMessageAgent
PR 阶段创建提交时 SHOULD 默认通过 `DITING_PR_COMMIT_MESSAGE_AGENT=agent` 调用执行 agent，根据任务信息与 staged diff 生成 Conventional Commit message；配置为 `heuristic` 时 MUST 跳过 agent 并使用内置兜底规则。

#### Scenario: AgentCommitMessageDisabled
- **WHEN** `DITING_PR_COMMIT_MESSAGE_AGENT=heuristic`
- **THEN** PR 阶段提交说明不调用执行 agent，改用内置规则生成

### Requirement: MeegleWebhookSecret
Meegle 为 webhook 模式（`DITING_PLUGIN_MEEGLE_MODE=webhook`）时 MUST 提供 `DITING_PLUGIN_MEEGLE_WEBHOOK_SECRET`。

#### Scenario: WebhookWithoutSecret
- **WHEN** webhook 模式且未配置 secret
- **THEN** 启动校验 MUST 失败

### Requirement: MeeglePollingFiles
Meegle 为 polling 模式且配置了结果文件时 MUST 同时配置任务文件（`DITING_PLUGIN_MEEGLE_TASKS_FILE` 与 `DITING_PLUGIN_MEEGLE_RESULTS_FILE`）。

#### Scenario: ResultsFileOnly
- **WHEN** polling 模式仅配置 results 文件
- **THEN** 启动校验 MUST 失败

### Requirement: MeegleLatestSprintFields
`MEEGLE_SOURCE_MODE` 或 `DITING_PLUGIN_MEEGLE_SOURCE_MODE` 为 `latest_sprint` 时 MUST 补齐 CLI 与项目、迭代、需求相关字段（见 diting-config.md 表）。

#### Scenario: LatestSprintIncomplete
- **WHEN** latest_sprint 模式缺少必填 Meegle CLI 字段
- **THEN** 启动校验 MUST 失败

### Requirement: MeegleBoardFilter
`MEEGLE_BOARD_USER_EMAIL`（或 `DITING_PLUGIN_MEEGLE_BOARD_USER_EMAIL`）非空时，latest_sprint MUST 先按迭代和节点查询候选需求，再在 work item 详情的 `role_members` 中按板子角色成员邮箱过滤；角色名来自 `MEEGLE_BOARD_FIELD`（默认 `板子R`）。未配置邮箱但 `MEEGLE_BOARD_VALUE`（或 `DITING_PLUGIN_MEEGLE_BOARD_VALUE`）非空时，latest_sprint MUST 在 demand MQL 查询中按板子角色成员显示名过滤，查询时 MUST 使用 Meegle 角色字段语法 `__角色名`。未配置邮箱和 `MEEGLE_BOARD_VALUE` 时 MUST 不施加板子角色过滤。

#### Scenario: BoardFilterConfigured
- **WHEN** `MEEGLE_SOURCE_MODE=latest_sprint` 且 `MEEGLE_BOARD_VALUE=R`
- **THEN** demand MQL 仅返回 `MEEGLE_BOARD_FIELD`（默认 `板子R`）角色成员包含 `R` 的需求

#### Scenario: BoardEmailFilterConfigured
- **WHEN** `MEEGLE_SOURCE_MODE=latest_sprint` 且 `MEEGLE_BOARD_USER_EMAIL=yangdong2@guanghe.tv`
- **THEN** demand MQL MUST NOT include the board role display-name filter
- **AND** hydrated demand details MUST only produce tasks whose `role_members` include `MEEGLE_BOARD_FIELD`（默认 `板子R`）with member email `yangdong2@guanghe.tv`

#### Scenario: BoardFilterOmitted
- **WHEN** latest_sprint 且未设置 `MEEGLE_BOARD_USER_EMAIL` 与 `MEEGLE_BOARD_VALUE`
- **THEN** 拉取行为与引入该 requirement 前一致（无板子角色过滤）

### Requirement: LegacyEnvFallback
新配置环境变量名 SHALL 优先；文档列出的旧 env 名 MUST 作为 fallback 继续兼容。

#### Scenario: LegacyAgentCount
- **WHEN** 仅设置 `DITING_AGENT_COUNT` 而未设置 `DITING_SCHEDULER_AGENT_COUNT`
- **THEN** 系统使用 `DITING_AGENT_COUNT` 作为 agent 数量

### Requirement: GovernanceThresholds
治理阈值 SHALL 可通过环境变量配置，包括 `DITING_GOVERNANCE_ALLOW_COMMAND_PREFIXES`、`DITING_GOVERNANCE_BLOCK_COMMAND_PATTERNS`、`DITING_GOVERNANCE_MAX_PROMPT_CHARS`（默认 16000）、`DITING_GOVERNANCE_MAX_OUTPUT_CHARS`（默认 12000）、`DITING_GOVERNANCE_MAX_FILES_CHANGED`（默认 20）、`DITING_GOVERNANCE_MAX_DIFF_LINES`（默认 400）。

#### Scenario: DefaultGovernanceLimits
- **WHEN** 未覆盖治理环境变量
- **THEN** 使用上述默认值参与策略判定

### Requirement: LogDirectoryFixed
当前运行时 MUST 将业务日志写入仓库根目录 `logs/` 树；不存在用于切换日志根目录的环境变量。

#### Scenario: LogPathLayout
- **WHEN** 服务写入任务日志
- **THEN** 路径形如 `logs/tasks/<taskId>/task.log`

### Requirement: MultiRepoWorkspaceConfig
服务端配置 SHALL 支持多仓 spec 工作流相关环境变量：`DITING_PREFLIGHT_DEEP`、`DITING_SPEC_MAX_BYTES`、`DITING_WORKSPACE_OPENSPEC_INIT`、`DITING_WORKSPACE_SUPERPOWERS_INSTALL_CMD`、`DITING_WORKSPACE_TOOLING_TIMEOUT_MS`；Superpowers SHALL 有内置默认安装命令，`DITING_WORKSPACE_SUPERPOWERS_INSTALL_CMD` 仅作为高级覆盖项。

#### Scenario: PreflightDeepEnv
- **WHEN** `DITING_PREFLIGHT_DEEP=true`
- **THEN** 预检将 spec 附件下载到临时目录以校验压缩包包含 `openspec/`，并在提供 WORKFLOW_PROMPTS 时校验其内容

## Technical Notes

- 实现：`apps/server/src/diting/config.ts`
- 依赖：plugins（外置包 env）、governance（阈值 env）
