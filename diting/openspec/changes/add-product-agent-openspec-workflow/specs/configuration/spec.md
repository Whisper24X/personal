## ADDED Requirements

### Requirement: ProductAgentConfig

服务端配置 SHALL 支持 product agent 相关环境变量，用于启用 product agent、配置并发数量、默认 driver 与默认 runtime provider。

#### Scenario: ProductAgentCountConfigured

- **WHEN** `DITING_SCHEDULER_PRODUCT_AGENT_COUNT=1`
- **THEN** 启动 seed MUST 创建 1 个 product agent capacity slot
- **AND** 该配置 MUST NOT 改变 programming agent count

#### Scenario: ProductRuntimeDefaults

- **WHEN** 未显式配置 product runtime provider
- **THEN** product driver MUST 默认优先选择 Codex provider
- **AND** Codex 不可用时 MAY fallback 到 Cursor provider

### Requirement: OpenSpecReviewGateConfig

服务端配置 SHALL 支持 OpenSpec review gate 相关环境变量，用于控制是否通过 Meegle 审核入口推进 product task，以及允许的审核前缀。

#### Scenario: DefaultReviewPrefixes

- **WHEN** 未覆盖 OpenSpec review 前缀配置
- **THEN** 系统 MUST 使用 `【评审通过】`、`【需要修改】`、`【废弃】` 作为默认门禁前缀

#### Scenario: ReviewGateDisabled

- **WHEN** OpenSpec review gate 被显式禁用
- **THEN** product task MUST NOT 自动进入 programming 开发阶段
- **AND** 系统 MUST 以配置定义的安全方式停在人工确认状态

### Requirement: WorkspaceRestoreConfig

服务端配置 SHALL 支持 workspace restore 与 product workspace 保留策略；默认情况下，product task 等待审核期间 MUST 保留 workspace，approved handoff 后当前 task 切换成的 programming task MUST 优先复用该 workspace。

#### Scenario: ProductWorkspaceRetainedDuringReview

- **WHEN** product task 进入 OpenSpec review `needs_human`
- **THEN** workspace cleanup MUST NOT 删除该 task 的 workspace

#### Scenario: RestoreRequiredByDefault

- **WHEN** programming task 声明 `workspaceId` 但 workspace 无法恢复
- **THEN** 默认策略 MUST fail closed
- **AND** 任务 MUST NOT 降级为从原始需求直接开发

### Requirement: LegacySpecAttachmentCompatibilityConfig

服务端配置 SHALL 保留 legacy spec 附件导入行为；开启 product workflow 后，spec 附件只作为 `legacy_attachment` source state 的输入，不再是所有 Meegle 任务的通用必填项。

#### Scenario: LegacyAttachmentStillImported

- **WHEN** Meegle task 提供 `spec文档` 附件且 product workflow 启用
- **THEN** 系统 MUST 可将附件导入 product workspace
- **AND** MUST 校验压缩包根级 `openspec/`

#### Scenario: MissingAttachmentAllowedForProductWorkflow

- **WHEN** Meegle task 未提供 `spec文档` 附件且 product workflow 启用
- **THEN** 配置默认 MUST 允许创建 product task
- **AND** 系统 MUST 不因缺少附件直接 blocked
