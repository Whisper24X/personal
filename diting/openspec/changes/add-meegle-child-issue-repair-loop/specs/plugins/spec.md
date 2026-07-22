## ADDED Requirements

### Requirement: TaskIntegrationChildRepairIssueCapability

task-integration 插件 MAY 提供 child repair issue 能力，用于创建或复用人工修复子 issue，并查询该子 issue 的人工方案状态；支持该能力的插件 MUST 实现创建/复用与查询两个方向的接口。

#### Scenario: PluginOpensChildRepairIssue

- **WHEN** core 传入父任务、失败指纹、失败摘要、失败检查项、executionId 与 evalResultId
- **THEN** 插件 MUST 返回子 issue 外部 ID、标题、URL、幂等键与是否复用

#### Scenario: PluginPullsChildRepairIssue

- **WHEN** core 请求查询处于 `needs_human` 的父任务子 issue
- **THEN** 插件 MUST 返回子 issue 是否 ready、原始描述、方案正文、replyId 与 updatedAt

### Requirement: MeegleChildTaskAdapter

Meegle task-integration 插件 SHALL 使用 Meegle CLI 在父 issue 开发节点下创建、复用并查询「任务」子任务；子任务描述以 `【开发中】` 开头时才可产生 ready 方案。

#### Scenario: CreateMeegleChildTask

- **WHEN** Meegle 父任务发生 quality failed 且没有相同幂等键的子任务
- **THEN** 插件 MUST 通过 Meegle CLI 创建「任务」子任务
- **AND** 子任务 MUST 包含 titing 幂等标记

#### Scenario: ReuseMeegleChildTask

- **WHEN** Meegle 父任务发生 quality failed 且已有相同幂等键的子任务
- **THEN** 插件 MUST 返回已有子任务引用
- **AND** `reused` MUST 为 `true`

#### Scenario: ReadMeegleChildTaskDescription

- **WHEN** Meegle 子任务的「子任务描述」为 `【开发中】修复测试失败`
- **THEN** 插件 MUST 返回 `ready: true`
- **AND** `body` MUST 为 `修复测试失败`

#### Scenario: RejectUnreadyMeegleChildTaskDescription

- **WHEN** Meegle 子任务的「子任务描述」为 `修复测试失败`
- **THEN** 插件 MUST 返回 `ready: false`
- **AND** core MUST NOT 恢复父任务
