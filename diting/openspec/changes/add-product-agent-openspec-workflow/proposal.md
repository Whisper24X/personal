## Why

当前多仓工作流把 Meegle `spec文档` 附件作为执行前置条件，缺少 `spec.zip` 时会在预检阶段阻断任务。产品经理 Agent 需要在没有预制 spec 包的情况下，先创建临时 workspace，基于 Meegle 需求自动生成 OpenSpec，并通过 Meegle 完成审核后再交给开发 Agent。

## What Changes

- 新增 `product` agent kind 与 `openspec-product` driver 的调度语义，用于 OpenSpec 生成、修订、校验和审核包输出。
- 将 Meegle 同步与预检从 `spec.zip` 存在性检查改为 workspace-first 的 `openspecSourceState` 决策。
- 支持 product task 在没有 `spec文档` 附件时 bootstrap 临时 workspace 并生成 OpenSpec；legacy spec 附件仅作为可选导入路径。
- 新增 OpenSpec 审核人工闭环：Meegle 审核子任务或评论回复必须使用 `【评审通过】`、`【需要修改】`、`【废弃】` 前缀门禁。
- 审核通过后创建或恢复 `programming` task，并要求其使用 approved workspace OpenSpec；缺少 approved OpenSpec 时 fail closed。
- 扩展配置，支持 product agent 数量、OpenSpec review gate 与 workspace restore 行为。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `plugins`: workspace-first 环境准备、legacy spec 附件导入、product driver 与通用 Meegle review 能力。
- `scheduler`: worker pool 从只分派 programming task 泛化为按 agent kind 分派 product/programming task。
- `task-lifecycle`: product task 的 OpenSpec 生成、审核、handoff 状态语义，以及 programming task 的 approved OpenSpec 前置条件。
- `human-intervention`: OpenSpec review 使用 `HumanReview` 与 Meegle 审核入口，按前缀门禁恢复、批准或终止。
- `execution-orchestration`: product driver 生成和校验 OpenSpec，审核通过后 handoff 给 programming driver。
- `configuration`: product agent 与 OpenSpec review/workspace restore 相关环境变量。

## Impact

- `packages/plugin-api`: 扩展 agent/task-integration/environment 相关契约与 metadata 类型。
- `packages/core`: 泛化 agent worker pool、agent plugin 选择、任务预检、状态流和 handoff 服务。
- `apps/server`: 新增 product driver、Codex/Cursor product runtime provider、Meegle review adapter、workspace bootstrap/import/restore 实现和配置读取。
- `apps/web`: 展示 product task、OpenSpec review 状态、handoff 与诊断信息。
- `docs/architecture`: 与 `diting-product-agent-openspec-workflow.md` 保持同步；实现后归档需同步叙事文档与 README。
