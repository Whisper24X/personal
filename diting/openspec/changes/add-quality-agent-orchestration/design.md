## Context

diting 已具备 `product -> programming` 的多 Agent handoff：Product agent 生成并审核 OpenSpec，审核通过后切换到 Programming agent 执行实现。当前质量链路仍在 `ServiceExecution` 的编程执行循环内联完成：编码执行后直接跑 OpenSpec completion gate、`QualityPlugin.evaluate`、repair loop 和 PR/MR 创建。

本变更把编码后的质量检查抽离为独立的「质检 Agent」。它沿用既有设计原则：Agent instance 表示并发容量，Agent kind 表示能力，Driver 表示能力边界，Codex/Cursor 只是 driver 下的 runtime provider。

## Goals / Non-Goals

**Goals:**

- 新增 `agentKind=quality` 与 `driverId=quality-orchestrator`。
- 编码完成后通过 implementation handoff 将当前 task 切换到 quality 阶段。
- 质检 Agent 编排 completion gate、`QualityPlugin.evaluate`、API/UI 自动化证据 gate、code review 和 quality report。
- 质检失败时通过统一 FailureRepairService / `repair_goals` 生成修复目标，并写 repair handoff 交回 programming。
- 质检通过后才允许 PR/MR 创建与 `succeeded`。

**Non-Goals:**

- 不让 quality Agent 直接改业务代码。
- 不替换 `QualityPlugin` 的底层检查职责。
- 不创建 quality 子 task；首版复用当前 task 切换模型。
- 不新增 release/merge Agent。

## Decisions

### Decision 1: Quality agent 是新的 agent kind

新增：

```text
agentKind = quality
driverId = quality-orchestrator
capabilities = quality, review, <runtime-provider>
```

`ServiceAgentWorkerPool` 支持 `quality-agent-*` claim `agentKind=quality` 的 ready task。`programming` legacy 兼容逻辑保持不变。

### Decision 2: Handoff 使用当前 task 切换

编码 Agent 成功完成实现后，不再内联进入完整质量阶段，而是写入：

```text
artifacts/implementation-handoff.json
```

handoff 必填字段包括 `schemaVersion`、`workspaceId`、`openspecChangeId`、`openspecRevision`、`openspecPath`、`sourceProgrammingTaskId`、`baseSha`、`headSha`、repo anchors、changed files、execution/session 和 artifact paths。

写入后当前 task 更新为：

```text
agentKind = quality
driverId = quality-orchestrator
status = ready
```

状态迁移必须记录 `active -> ready` transition，reason 为 `Implementation handed to quality agent`。

### Decision 3: Quality orchestrator 是编排者，不是 QualityPlugin 替代品

`QualityPlugin` 继续生产结构化检查结果：脚本检查、automation report、diff risk、score、riskLevel 和 checks。

`quality-orchestrator` 负责：

1. 恢复 workspace，并校验 implementation handoff 与当前 workspace repo anchors。
2. 执行 OpenSpec completion gate。
3. 调用 `QualityPlugin.evaluate`。
4. 校验 API/UI 自动化 evidence；无证据不得落结论。
5. 执行只读 code review runtime，并写 `artifacts/code-review-report.json`。
6. 聚合并持久化 `artifacts/quality-report.json`。
7. 通过时触发 PR/MR 创建并转 `succeeded`。
8. 失败时写 repair handoff 并切回 programming。

### Decision 4: Repo anchors 必须 fail closed

implementation handoff 的 repo anchors 需要记录每个 repo 的 `key`、`url`、`path`、`baseSha`、`headSha`。Quality 阶段恢复 workspace 后必须按 repo 精确匹配：

- repo 缺失、URL/path 不一致、base/head 缺失或 sha 不一致时进入 `waiting`。
- `repos` 为空时进入 `waiting`。
- 不调用 completion gate 或 quality plugin。

这保证质检针对的 diff 与编码 Agent 交付的 diff 一致。

### Decision 5: Code review 是强制 gate

quality runtime 必须执行一次只读 review prompt，并写：

```text
artifacts/code-review-report.json
```

报告至少包含 `schemaVersion`、`reviewArtifactId`、`executionId`、`findings`、`summary`。报告缺失、解析失败、缺 `reviewArtifactId`、runtime 非零退出，均不得放行。CRITICAL / IMPORTANT finding 进入 repair handoff；SUGGESTION 进入 report。

### Decision 6: Repair handoff 复用现有 failure repair 模型

质检失败时不直接修代码，而是：

- 调用现有 failure repair 记录逻辑，写 `task.metadata.failureRepair`。
- 更新 `repair_goals`，保留 repeated failure、no effective diff、budget limited 等停止条件。
- 写 `artifacts/quality-report.json`。
- 写 `artifacts/quality-repair-handoff.json`。
- 未达到停止条件时切回：

```text
agentKind = programming
driverId = coding
status = ready
```

状态迁移必须记录 `active -> ready`，reason 为 `Quality failed; returned to programming repair`。

## State Mapping

- 编码完成：`active(programming)` -> write implementation handoff -> `ready(quality)`。
- 质检开始：`ready(quality)` -> `active(quality)`。
- 质检通过：`active(quality)` -> PR/MR 创建 -> `succeeded`。
- 质检失败且可自动修复：`active(quality)` -> write failure repair / repair goal / repair handoff -> `ready(programming)`。
- 质检 fail closed：`active(quality)` -> `waiting`，WaitReason 表达阻断或人工介入原因。
- 修复预算耗尽或不可恢复失败：`active(quality)` 或 `active(programming)` -> `failed`。

## Tech Stack

Profile: `typescript`。

命令来源为仓库 `package.json` 与 `apps/server/package.json`：

```bash
npm run test -w apps/server -- <focused specs> --runInBand
npm test -- --runInBand
npm run type-check
npm run build
```

## Risks / Constraints

- Quality Agent 不得写业务代码；首版通过 prompt、driver 边界和治理约束为只读检查/审查。
- Artifact 写入失败必须 fail closed 到 `waiting`，不得跳过质量报告。
- API/UI 自动化缺证据不得被默认为通过；只有明确 N/A 且有 reason 时才可跳过。
- Repair loop 不得形成第二套协议，必须继续使用 FailureRepairService / `repair_goals`。
- 真实凭据、生产 token 和敏感信息不得写入 handoff、quality report 或 git。

## Open Questions

- 长期是否拆出独立 release/merge Agent。
- Meegle 是否需要单独展示“质检中 / 质检失败 / 修复中 / 复检中”的子任务或评论格式。
- API/UI 自动化长期是否拆出专门 automation plugin；首版只在 quality orchestrator 校验证据完整性。
