## ADDED Requirements

### Requirement: ProductAgentDriverCapability

系统 SHALL 支持 `product` agent kind 与 `openspec-product` driver，用于 OpenSpec 生成、修订、校验和审核包输出；Codex/Cursor MUST 作为该 driver 下的 runtime provider，而不是独立产品经理 Agent。

#### Scenario: ProductDriverSelected

- **WHEN** queued task 的 `agentKind` 为 `product` 且 `driverId` 为 `openspec-product`
- **THEN** runtime MUST 选择具备 `product` 与 `openspec` capability 的 agent 插件或 driver
- **AND** 选择结果 MUST 记录 `agentKind=product`、`driverId=openspec-product` 与 `runtimeProviderId`

#### Scenario: ProductRuntimeNotCodingAgent

- **WHEN** product driver 使用 Codex 或 Cursor 执行 OpenSpec 生成
- **THEN** Codex/Cursor MUST 记录为 runtime provider
- **AND** 系统 MUST NOT 将 Codex/Cursor 记录为顶层 agent kind

### Requirement: WorkspaceFirstSpecPreparation

Environment 插件 SHALL 支持 workspace-first 的 product workspace 准备模式；当 product task 没有 Meegle spec 附件时，系统 MUST 创建 workspace、写入任务上下文、准备仓库 worktree，并允许 product driver 在 workspace 内生成 `openspec/`。

#### Scenario: BootstrapProductWorkspaceWithoutSpecAttachment

- **WHEN** product task 没有 `spec文档` 附件且 `openspecSourceState` 为 `none`
- **THEN** `prepareWorkspace` MUST 创建临时 workspace
- **AND** MUST 写入 `task.md` 或等价任务上下文 artifact
- **AND** MUST NOT 因缺少 `spec.zip` 而阻断 workspace 创建

#### Scenario: ProductWorkspaceInitializesOpenSpecRoot

- **WHEN** product workspace bootstrap 完成
- **THEN** workspace MUST 具备可由 product driver 写入 OpenSpec change 的 `openspec/` 根目录或可初始化该根目录的工具链

### Requirement: LegacySpecAttachmentImport

Environment 插件 SHALL 保留 legacy spec 附件导入模式；仅当 Meegle 任务存在 spec 附件时，系统 MUST 下载、解压并校验压缩包根级包含 `openspec/`。

#### Scenario: ImportLegacySpecAttachment

- **WHEN** product task 的 `openspecSourceState` 为 `legacy_attachment`
- **THEN** system MUST 将 spec 附件导入 workspace
- **AND** zip 或 tar 压缩包 MUST 校验根级存在 `openspec/`

#### Scenario: MissingLegacyAttachmentDoesNotBlockProductBootstrap

- **WHEN** product task 没有 spec 附件
- **THEN** legacy import preflight MUST 被跳过
- **AND** 系统 MUST 继续 product workspace bootstrap

### Requirement: ProductWorkspaceRestore

Environment 插件 SHALL 支持通过 `workspaceId` 恢复已批准 OpenSpec 所在 workspace；programming task 若声明 `workspaceId` 与 `openspecChangeId`，系统 MUST 优先复用该 workspace。

#### Scenario: RestoreApprovedWorkspaceForProgrammingTask

- **WHEN** programming task metadata 包含 `workspaceId` 与 approved `openspecChangeId`
- **THEN** environment MUST 尝试恢复对应 workspace
- **AND** `PreparedWorkspace` MUST 指向该 workspace 的 OpenSpec change 与 repos

#### Scenario: MissingApprovedWorkspaceFailsClosed

- **WHEN** programming task 声明的 approved workspace 不存在且无法恢复
- **THEN** environment MUST fail closed
- **AND** 系统 MUST NOT 基于原始 Meegle 描述直接开发

### Requirement: TaskIntegrationOpenSpecReviewCapability

task-integration 插件 MAY 提供 OpenSpec review 能力，用于创建或复用审核入口，并查询审核回复；支持该能力的插件 MUST 实现创建/复用与查询两个方向的接口。

#### Scenario: PluginOpensOpenSpecReviewIssue

- **WHEN** core 传入 product task、OpenSpec changeId、revision、审核摘要与幂等键
- **THEN** 插件 MUST 返回 review issue 外部 ID、标题、URL、幂等键与是否复用

#### Scenario: PluginPullsOpenSpecReviewIssue

- **WHEN** core 请求查询处于 `needs_human` 的 OpenSpec review
- **THEN** 插件 MUST 返回审核状态、原始回复、回复正文、replyId 与 updatedAt

### Requirement: MeegleOpenSpecReviewAdapter

Meegle task-integration 插件 SHALL 支持 OpenSpec review 审核入口；审核回复仅在以 `【评审通过】`、`【需要修改】` 或 `【废弃】` 开头时产生可执行决策。

#### Scenario: MeegleReviewApproved

- **WHEN** Meegle 审核回复为 `【评审通过】同意进入开发`
- **THEN** 插件 MUST 返回 `decision: approved`
- **AND** 回复正文 MUST 为 `同意进入开发`

#### Scenario: MeegleReviewChangesRequested

- **WHEN** Meegle 审核回复为 `【需要修改】补充异常场景`
- **THEN** 插件 MUST 返回 `decision: changes_requested`
- **AND** 回复正文 MUST 为 `补充异常场景`

#### Scenario: MeegleReviewUnreadyText

- **WHEN** Meegle 审核回复未以前缀门禁开头
- **THEN** 插件 MUST 返回未 ready 状态
- **AND** core MUST NOT 进入 programming 开发阶段

## MODIFIED Requirements

### Requirement: TaskPreflightBeforeWorkspace
`prepareWorkspace` 之前系统 SHALL 运行任务预检（仓库列表、任务说明、OpenSpec source state 与阶段化工作区条件）。product task 缺少 spec 附件时 MUST NOT 因 `spec文档` 为空而阻断；仅 legacy spec import 模式 MUST 校验 spec 附件和 `openspec/` 包结构。预检失败 MUST 将任务置为 `blocked` 且不创建或恢复不安全的工作区。

#### Scenario: PreflightAllowsMissingSpecForProductTask
- **WHEN** product task 仓库列表与任务说明有效，但 `spec文档` 附件为空
- **THEN** 预检 MUST 通过 product bootstrap 所需检查
- **AND** 调度器 MAY 创建 product workspace

#### Scenario: PreflightBlocksInvalidLegacySpec
- **WHEN** task 处于 legacy spec import 模式且 spec 压缩包缺少根级 `openspec/`
- **THEN** 任务 MUST 为 `blocked`
- **AND** 错误 MUST 指向 spec 包结构

#### Scenario: PreflightBlocksProgrammingWithoutApprovedSpec
- **WHEN** programming task 缺少 approved `workspaceId` 或 `openspecChangeId`
- **THEN** 任务 MUST 为 `blocked`
- **AND** 系统 MUST NOT 调用 product 或 coding driver
