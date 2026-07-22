## Context

diting 当前已经具备多仓 workspace、Meegle spec 附件物化、Codex/Cursor 编程 runtime、OpenSpec completion gate、needs_human 与 Meegle 子任务修复闭环。现有实现仍把 `spec文档` 附件视为多仓执行的前置输入：没有 spec 附件会预检失败，任务不会创建工作区。

产品经理 Agent 需要把 Meegle 原始需求转化为 OpenSpec change，并在 Meegle 中完成审核。这个流程要求系统先创建临时 workspace，再由 agent 生成 `openspec/changes/<change-id>/`，所以不能继续把 `spec.zip` 是否存在作为通用阻断条件。

本设计遵循现有 Agent 层重构方向：Agent instance 表示并发容量，Agent kind 表示能力，Driver 表示能力边界，Codex/Cursor 只是 driver 下的 runtime provider。

## Goals / Non-Goals

**Goals:**

- 新增 `product` agent kind 与 `openspec-product` driver，用于 OpenSpec 生成、修订、校验和审核包输出。
- 将同步与预检改为 workspace-first：无 spec 附件时创建 product task 并 bootstrap workspace；有附件时作为 legacy import。
- 通过 Meegle OpenSpec review 子任务或评论完成审核门禁，只有 `【评审通过】` 才能进入开发。
- 审核通过后创建或恢复 `programming` task，并要求其使用 approved workspace OpenSpec。
- 保持旧 `spec.zip` 附件路径可用，避免破坏已实现多仓 spec 工作流。

**Non-Goals:**

- 不让 product driver 修改业务代码、跑质量检查或创建 PR。
- 不把 Codex/Cursor 提升为 product agent；它们仍只是 runtime provider。
- 不在首版实现多人协同编辑或外部文档权限平台。
- 不移除既有 `programming-agent-*` 与 legacy `executor=codex/cursor/programming` 兼容路径。

## Decisions

### Decision 1: Product agent 是新的 agent kind，而不是 coding workflow 节点

选择新增：

```text
agentKind = product
driverId = openspec-product
capabilities = product, openspec, requirements
```

原因：Product agent 的产物是 OpenSpec 与审核包，不是代码 diff。把它塞进 `CodingAgentDriver` 会让 quality、repair、PR 等编码语义混入需求生成流程，也违背现有设计中“非编码 agent 应有自己的 driver”的边界。

备选方案是复用 `programming` agent 的前置 workflow 节点。该方案实现短，但会让一个任务同时承担 spec 生成和代码实现，无法在 Meegle 审核前天然停住，因此不采用。

### Decision 2: 同步阶段计算 `openspecSourceState`

同步不再判断 `spec.zip` 是否存在，而是归一化为：`none`、`legacy_attachment`、`draft_workspace`、`review_pending`、`changes_requested`、`approved_workspace`、`invalid`。

这个状态决定创建 product task、导入 legacy 附件、轮询审核、恢复修订或切换到 programming 阶段。这样无附件是正常入口，不再是错误。

### Decision 3: 分层预检

预检拆成 intake、product workspace、legacy import、programming 四层：

- intake 只要求标题、需求、repo 列表和分支可解析。
- product workspace 只要求 workspace 可创建、repo 可解析、OpenSpec 工具可用。
- legacy import 仅在附件存在时校验附件、压缩包与根级 `openspec/`。
- programming 必须有 approved `workspaceId`、`openspecChangeId` 和通过校验的 OpenSpec。

这避免了旧的“无 spec 附件必 blocked”规则误伤 product-agent bootstrap。

### Decision 4: Meegle review 与 repair 子任务分离

现有 Meegle child repair issue 用于 quality failed 后的修复方案，门禁是 `【开发中】`。OpenSpec review 是产品审核，不应复用 repair 语义。

新增通用 review 能力：`openHumanReviewIssue` / `pullHumanReviewIssues`。审核回复以 `【评审通过】`、`【需要修改】`、`【废弃】` 为门禁。无法创建或读取 review issue 时 fail closed。

### Decision 5: Handoff 通过 workspace artifact 与当前 task 阶段切换

审核通过后，product task 写入 `artifacts/handoff.json`，再将当前 task 切换为 programming task 并恢复到 `ready`。Programming task 必须复用 product workspace 或可恢复快照，不能回退到原始 Meegle 描述直接开发。

备选方案是在同一 task 内从 product 流程切换到 programming 流程。该方案减少 task 数量，但会让任务状态、agent kind、driver 和审计混乱，因此不采用。

### Decision 6: Worker pool 泛化，但保留 legacy 兼容

Worker pool 需要按 agent kind claim 任务：`product-agent-*` 只 claim `agentKind=product`，`programming-agent-*` 只 claim `agentKind=programming`。旧 executor 映射仍保留：`codex/cursor/programming` 都归一为 `programming`。

## Risks / Trade-offs

- Product workspace 长时间等待审核导致磁盘占用增加 → 记录 `workspaceId`、review 状态和最后活动时间，后续增加 TTL/归档策略；未完成审核前不得清理。
- Meegle review 子任务能力不稳定 → 首版提供评论式 fallback，但仍要求前缀门禁；创建/读取失败时 fail closed。
- Product runtime 可能误改代码仓 → product driver prompt 与 governance 限制只允许 OpenSpec/文档产物写入，业务 repo 默认只读。
- Handoff 后 workspace 丢失 → programming task 必须 blocked，不得基于旧需求直接开发；人工可重新生成或恢复 workspace。
- 与现有 spec 附件预检冲突 → 修改 preflight requirement，legacy import 单独校验附件，product bootstrap 不要求附件。

## Migration Plan

1. 新增 OpenSpec specs 与测试，先锁定 product-agent/workspace-first 行为。
2. 泛化 worker pool 与 agent plugin selection，同时保持 programming legacy 测试通过。
3. 实现 sync decision 与分层 preflight，使无附件 Meegle 任务能创建 product task。
4. 实现 ProductSpecDriver 与 Codex/Cursor product runtime provider。
5. 实现 Meegle OpenSpec review adapter 与评论 fallback。
6. 实现 approved OpenSpec handoff 到 programming task 和 workspace restore。
7. 更新 Web 控制台、诊断命令、配置文档和 README。

回滚策略：保留 legacy spec 附件路径与 `programming` 默认路径；若 product agent 关闭，Meegle 任务仍按旧 spec 附件预检和多仓执行链路运行。

## Open Questions

- Product workspace 的 TTL、归档和恢复策略是否需要在首版实现，还是只记录 metadata 并人工运维。
- Meegle 审核子任务应复用开发节点下「任务」类型，还是配置独立节点/任务类型。
- Product runtime 对 repo 的只读限制是通过 prompt/governance 约束，还是增加文件写入 allowlist。
