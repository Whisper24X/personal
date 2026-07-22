# Generated OpenSpec Local Path Return 设计文档

## 澄清问题及结论

- 用户明确要求不再回传 OpenSpec 到 `spec文档` 附件。
- 该能力只作用于无 `spec文档` 附件、由 product agent 自动生成 OpenSpec 的路径。
- OpenSpec review 子任务描述成为用户查看生成 spec 产物的主入口；OpenSpec review gate 仍负责 `【评审通过】`、`【需要修改】`、`【废弃】` 状态推进。
- legacy 用户上传的 `spec文档` 附件必须保留，不被 generated archive 覆盖或删除。
- 历史 `generatedSpecAttachment` metadata 不迁移、不补写兼容字段。
- 本 change 只完成阶段 1 和阶段 2 的 OpenSpec 制品，不进入代码实现。

## 候选方案对比

### 方案 A：Core 计算路径，integration 展示路径（推荐）

Core 在 product agent 生成和校验 OpenSpec 后，计算 `workspaceId/openspec/changes/<changeId>` 的绝对路径，并把 `openspecPath` 传给 task-integration 的 OpenSpec review 创建能力。Meegle adapter 在评审子任务描述中展示该路径，并提示用户审核 `proposal.md`、`design.md`、`specs/`、`tasks.md`。

优点：实现简单，避免附件上传副作用和字段写回失败；Core 仍负责领域语义，Meegle adapter 只负责外部评审入口呈现。缺点是本地绝对路径只对能访问该 workspace 的审核人/运行环境有效。

### 方案 B：Core 负责打包，integration 负责上传

Core 在 product agent 生成和校验 OpenSpec 后，把 workspace 中完整 `openspec/` 目录打包为确定性 zip，再通过 Meegle adapter 上传到「spec文档」字段。

优点：用户可从附件下载。缺点：引入上传接口、zip 打包、附件字段写回、失败重试和 fail closed 语义；当前需求已明确不再回传。

### 方案 C：product runtime 自行返回路径

让 Codex/Cursor product runtime 在生成 OpenSpec 后自行把路径写入输出摘要。

优点：表面上改动少。缺点：路径呈现不受 core 状态机约束，review 子任务可能缺少稳定字段，handoff 和诊断难以统一。

## 最终选择及理由

采用方案 A。用户明确要求不再回传附件，因此 Core 只计算 OpenSpec change 目录绝对路径并持久化 `openspecPath`；Meegle adapter 在子任务描述中展示该路径。这样可以删除上传接口和打包函数，同时保持 review gate 与 programming handoff 的统一状态语义。

## 技术设计

### 架构分层

- `plugin-api`: `OpenSpecReviewIssueRequest` 增加 `openspecPath?: string`；删除 generated spec attachment upload 契约。
- `core`: 在 product driver 成功返回 `openspecChangeId` 时计算 `workspaceId/openspec/changes/<changeId>`，写入 task metadata / HumanReview / execution log，并传给 review request。
- `apps/server` Meegle adapter: 创建 OpenSpec review 子任务时，在描述中展示 `OpenSpec 文档绝对路径` 和审核提示。
- review/handoff: review body 展示本地绝对路径；approval 时无附件生成路径必须已有 `openspecPath`，否则 fail closed。

### 关键决策

- `openspecPath` 指向 change 目录，而不是整个 `openspec/` 根目录，便于用户直接定位本次生成内容。
- review 子任务描述必须包含路径和审核文件提示。
- legacy attachment 路径不触发 generated upload，也不替换产品手工上传的 spec 包。
- 历史 `generatedSpecAttachment` metadata 不迁移、不兼容补写；新流程只写入和依赖 `openspecPath`。

### 风险与约束

- 本地绝对路径只对能访问服务端 workspace 的用户有效。
- workspace 被清理或不可恢复时，approval handoff 仍应 fail closed。
- 多次修订时 `openspecPath` 随 `changeId` 更新；review attempt 继续使用既有 idempotency key 规则。

### Open Questions

- 是否需要在 Web UI 同步展示 `openspecPath`，可在后续独立 change 中处理。
