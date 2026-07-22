## Why

当前 product agent 已支持在 Meegle 任务没有上传 `spec文档` 附件时生成 OpenSpec change，但生成结果主要保留在服务端 workspace 内，并通过 OpenSpec review 入口等待人工回复。新的审核入口需要更直接地告诉用户生成文档所在位置，而不是再把产物回传到原工作项附件字段。

因此，无附件输入触发 product agent 生成 OpenSpec 后，系统需要在创建 OpenSpec review 子任务时返回生成文档的本地绝对路径，供用户直接审核该 workspace 中的 OpenSpec 文件，同时保留现有 review gate 作为状态推进门禁。

## What Changes

- 当 Meegle 任务没有上传 `spec文档` 且走 product agent 生成路径时，生成并校验 OpenSpec 后，系统计算 `workspaceId/openspec/changes/<changeId>` 的绝对路径。
- 在打开或复用 OpenSpec review 入口时，系统将该绝对路径写入 review request 和 Meegle 子任务描述，供用户审核 `proposal.md`、`design.md`、`specs/`、`tasks.md`。
- task metadata、HumanReview/review payload 记录 `openspecPath`，用于诊断和 programming handoff。
- 已存在 legacy `spec文档` 附件时保持原有导入路径，不生成替换附件，也不删除用户上传的附件。
- 上传接口、zip 打包函数、附件字段写回和上传失败 fail closed 行为全部移除；历史 `generatedSpecAttachment` metadata 不迁移、不补写兼容字段。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `plugins`: task-integration 的 OpenSpec review 请求支持携带 `openspecPath`，Meegle 子任务描述展示该路径。
- `execution-orchestration`: product workflow 在 review ready 前必须计算并传递 generated OpenSpec 本地绝对路径。
- `task-lifecycle`: product task 记录 `openspecPath`，无附件生成路径缺少该路径时不得进入 programming handoff。
- `human-intervention`: OpenSpec review 请求包含 OpenSpec 本地绝对路径，便于用户审核。

## Impact

- `packages/plugin-api`: 调整 OpenSpec review 请求契约，增加 `openspecPath`，移除 generated spec attachment 上传请求/响应类型。
- `packages/core`: 负责计算 generated OpenSpec 绝对路径、持久化结果，并在 handoff 前校验路径存在于 metadata。
- `apps/server`: Meegle adapter 在 OpenSpec review 子任务描述中展示绝对路径。
- 诊断文档：展示 OpenSpec 本地路径和排障信息。
