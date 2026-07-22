# Meegle 子 issue 修复闭环设计文档

## 澄清问题及结论

- 飞书看板进入 titing 的需求为父 issue；当父 issue 在开发/质量评测阶段出现 bug、测试失败或 quality failed 时，不再直接重试父 issue。
- 环境准备失败、执行器启动失败、执行超时等非质量评测失败不纳入本次父子 issue 闭环，继续沿用现有环境重试、执行重试或 blocked 策略。
- 父 issue 失败后，titing 在同一飞书项目看板的开发节点下创建或复用「任务」子任务。子任务包含子任务 ID、名称、子任务描述等字段，可通过 Meegle CLI 查询。
- 子任务描述必须以 `【开发中】` 开头，titing 才视为人工方案已补全并触发父任务修复；否则父任务保持 `needs_human`。
- 读取子任务描述不是隐式等待完成，而是通过任务级接口显式触发；前端控制台提供按钮调用该接口，人工补完方案后由用户主动点击检查。
- 同一个父 issue 多次失败时，按失败指纹复用子任务；相同失败指纹复用已有子任务，不同失败指纹创建新的子任务。
- 恢复父任务时新开一次 execution，但只带失败检查项、失败摘要和子任务方案作为 repair goal 输入；不重新执行完整需求实现。

## 候选方案对比

### 方案 A：把子任务当作普通人工回复来源

在 Meegle 插件内查询子任务描述，将符合 `【开发中】` 门禁的描述转换为现有 `HumanReply`，复用 `ServiceScheduler.applyHumanReply` 的恢复逻辑。

优点：
- 对 core 层改动小。
- 能复用 `needs_human`、`repair goal` 和现有调度恢复路径。

缺点：
- 父子 issue、失败指纹、子任务 ID 等业务语义会被隐藏在“评论回复”模型后面。
- 难以准确审计“哪个失败创建了哪个子任务、哪个子任务触发了哪次修复”。
- 子任务创建/复用和评论回复混杂，后续扩展其他看板平台成本较高。

### 方案 B：扩展 needs_human loop 为父子 issue 模型

在 `TaskIntegrationPlugin` 增加面向人工修复 issue 的可选能力：创建或复用子 issue、查询子 issue 方案。core 层在任何 quality eval failed 后，先把失败指纹、失败检查项、执行摘要、子 issue 引用写入 `task.metadata.humanLoop`，并将 repair goal 标记为 `needs_human`，不再立即进入自动 repair。后端提供显式同步接口读取子任务描述，只有以 `【开发中】` 开头才恢复父任务并注入定向修复目标；前端控制台按钮负责调用该接口。

优点：
- 与业务语义一致：父 issue 代表原始需求，子 issue 代表人工补充方案。
- 可以按失败指纹稳定复用子任务，避免重复创建同类人工补充任务。
- 可审计子任务 ID、失败指纹、恢复来源和方案正文。
- 保留现有状态机与 repair goal 主体，不需要新增任务状态。

缺点：
- 需要扩展 plugin-api 与 Meegle 插件。
- 需要为 Meegle CLI 的子任务创建、查询、描述解析补测试。

### 方案 C：新增独立 ChildIssueService

新增 core 服务专门管理父子 issue、失败指纹、子任务状态、方案门禁与恢复，Meegle 插件仅作为底层 adapter。

优点：
- 长期抽象边界最清晰。
- 未来支持多个看板平台时便于统一子 issue 生命周期。

缺点：
- 当前需求会引入更多新结构和迁移，超出最小闭环。
- 现有 `needs_human`、`HumanReview`、`pullHumanReplies` 能力会出现并行概念，短期复杂度较高。

## 最终选择及理由

选择方案 B。

理由：
- 最新代码已经具备 `needs_human` 状态、`repair_goals`、`humanLoop` metadata、`TaskIntegrationPlugin.reportNeedsHuman` 和 `pullHumanReplies`，方案 B 可以沿用这些运行时约束，只扩展交互实体。
- `ServiceExecution` 当前只在任务 `done` 时清理 workspace，父任务进入 `needs_human` 后可以保留工作区，为后续定向修复提供基础。
- 该方案能满足“不重试父任务、创建子 issue、等待子任务描述、只修失败点”四个核心要求，同时避免引入全新的状态机。

## 技术设计

### 架构分层

技术栈 Profile：`typescript`。

#### plugin-api

扩展 `TaskIntegrationPlugin` 的可选能力，保持向后兼容：

- `openHumanRepairIssue?(task, payload): Promise<HumanRepairIssueRef>`
  - 创建或复用人工修复子 issue。
  - 输入包含父任务、失败指纹、失败摘要、失败检查项、execution/eval IDs、requestId。
  - 输出包含子 issue 外部 ID、标题、URL 或平台引用、是否复用、幂等键。
- `pullHumanRepairIssues?(tasks): Promise<HumanRepairIssueReply[]>`
  - 针对 `needs_human` 父任务查询子 issue。
  - 只有子任务描述以 `【开发中】` 开头时才返回 `ready: true` 和方案正文；未满足门禁时返回 `ready: false` 供日志观测，不恢复父任务。

建议新增类型：

- `HumanRepairIssueRequest`
  - `requestId`
  - `failureHash`
  - `failureSummary`
  - `failedChecks`
  - `executionId`
  - `evalResultId`
  - `stopReason`，可为 `null`
  - `requestedAt`
- `HumanRepairIssueRef`
  - `externalId`
  - `title`
  - `url`
  - `idempotencyKey`
  - `reused`
- `HumanRepairIssueReply`
  - `taskId`
  - `parentExternalId`
  - `childExternalId`
  - `replyId`
  - `ready`
  - `body`
  - `rawDescription`
  - `updatedAt`

保留 `reportNeedsHuman` / `pullHumanReplies` 用于旧的评论式闭环。优先级为：若 Meegle integration 支持 `openHumanRepairIssue` 和 `pullHumanRepairIssues`，使用子 issue 闭环；若非 Meegle integration 不支持子 issue 能力，则保持现有评论式闭环或 repair loop 行为。

Meegle 父 issue 的子 issue 闭环必须 fail closed：如果子 issue 创建失败、开发节点不可查询、任务类型不可用或 metadata 持久化失败，不得回到自动 repair。系统应记录 `goal.child_issue_open_failed`，将父任务保持/迁移到 `needs_human`（若无法安全等待人工则 `blocked`），等待人工或运维修复集成能力。

#### core execution

在 `ServiceExecution` 的 quality failed 分支中加入子 issue 优先路径，入口应早于当前自动 repair 迁移：

- 任何 quality eval failed 均触发该路径，而不是只在 `high_risk`、`repeated_failure`、`no_effective_diff` 等 stop signal 后触发。
- 不覆盖环境失败、execution retryable failure 或 workflow prompt 解析失败。
- 计算并保存 `failureHash`、`failedChecks`、`failureSummary`、`executionId`、`evalResultId`、`stopReason`。
- 若 integration 支持 `openHumanRepairIssue`，调用该方法创建或复用子 issue。
- 将返回的 `childExternalId`、`childUrl`、`reused`、`failureHash` 写入 `task.metadata.humanLoop.childIssue`。
- 将 repair goal 状态置为 `needs_human`，目标只包含失败检查项、失败摘要和质量报告相关约束。
- 父任务迁移到 `needs_human`，不进入自动 repair，也不执行父任务全量 retry。

如果 Meegle integration 不支持子 issue 能力或子 issue 能力失败，fail closed：记录 `goal.child_issue_open_failed`，父任务进入 `needs_human` 或 `blocked`，不得自动 repair。

如果非 Meegle integration 不支持子 issue 能力，保留现有逻辑：命中 stop signal 且 `TITING_GOAL_ENABLE_NEEDS_HUMAN_LOOP=true` 时走评论式人工介入；否则继续当前 repair loop。

#### core scheduler

新增任务级人工修复同步命令，供 HTTP API 和前端控制台显式触发。建议命名为 `syncHumanRepairIssue(taskId, operator)`，由 `TitingServices` 或独立 command service 暴露，内部复用 integration 的 `pullHumanRepairIssues` 能力：

- 仅允许处理状态为 `needs_human` 且来源为 Meegle 的父任务。
- 读取 `humanLoop.childIssue` 中的子任务引用和失败指纹。
- 调用当前任务来源 integration 的 `pullHumanRepairIssues([task])`，只查询该父任务关联的子任务描述。
- 如果子任务描述没有以 `【开发中】` 开头，不恢复父任务。
- 如果满足门禁：
  - 将去掉门禁前缀后的方案正文写入 `metadata.humanLoop.childIssue.solution`，并追加到父任务 instruction 的人工方案段落。
  - 将 `Human guidance: <方案>` 追加到 repair goal constraints。
  - 将 repair goal 状态改回 `repairing`。
  - 更新 `humanLoop.lastChildIssueReply` 和 `seenReplyIds`，`replyId` 使用 `childExternalId + updatedAt + bodyHash`，避免同一描述重复恢复。
  - 父任务从 `needs_human` 迁移到 `queued`。

`ServiceScheduler.runTaskSyncNow` 可以后续选择批量复用该命令，但本次需求的触发时机以显式 API 为准，避免后台轮询在人工尚未准备好时产生噪声或误判。

#### HTTP API

在现有任务命令端点旁新增接口：

- `POST /api/tasks/:id/sync-human-repair-issue`
  - 读取指定父任务关联的 Meegle 子任务描述。
  - 若未以 `【开发中】` 开头，返回 `ready: false`，父任务保持 `needs_human`。
  - 若满足门禁并恢复成功，返回 `ready: true`、`recovered: true`、`childExternalId`、`replyId`、`summary`，父任务进入 `queued`。
  - 若任务不是 `needs_human`、没有 `humanLoop.childIssue`、来源不是 Meegle 或 integration 不支持子 issue 能力，返回 409 或结构化错误。

接口命名沿用现有命令式风格，与 `POST /api/tasks/:id/retry`、`POST /api/tasks/:id/recover` 并列。

#### web console

在 `apps/web/src/App.tsx` 的任务详情 action row 中新增按钮：

- 文案建议为 `检查子任务方案` 或 `Sync child issue`。
- 仅在 `selectedTask.status === "needs_human"` 且 `selectedTask.metadata.humanLoop.childIssue` 存在时启用；其他状态禁用或隐藏。
- 点击后调用 `postJson("/tasks/${id}/sync-human-repair-issue")`，随后刷新任务列表和任务详情。
- 返回 `ready: false` 时在详情区展示“子任务描述尚未以 `【开发中】` 开头”；返回 `recovered: true` 时展示恢复摘要，并刷新状态为 `queued`。

恢复后的下一次 dispatch 会创建新的 execution。为保证“只修失败点”，还需要为执行插件增加 repair-only 执行语义：

- 在 `RepairGoal` 或 `task.metadata.humanLoop` 中标记 `executionMode: "repair_only"`。
- `apps/server/src/titing/plugins/execution.ts` 在 `goal` 存在且 `executionMode` 为 `repair_only` 时，渲染 prompt 时弱化或替换原始 `taskPrompt` 与 `acceptanceCriteria`：
  - `taskPrompt` 改为“不要重新实现完整需求，只基于 repair goal 修复失败检查项”。
  - `acceptanceCriteria` 只保留失败检查项对应的 `repairDoneWhen`。
  - prompt 仍保留仓库路径、分支、工作区等执行上下文。
- `buildRepairDoneWhen` 在该路径下不再追加父任务完整 acceptance criteria，只生成失败检查项。

#### Meegle 插件

在 `MeegleTaskIntegrationPlugin` 中实现子 issue 能力：

- 创建子任务：通过 Meegle CLI 在父 issue 所在项目/节点下创建「任务」类型子任务。标题建议包含 titing 标记、父 issue ID 和失败摘要，例如 `【titing修复方案】<父标题> - <失败检查项>`。
- 复用子任务：查询父 issue 开发节点下已有子任务，根据幂等键匹配；相同失败指纹复用，不同失败指纹新建。
- 查询方案：通过 Meegle CLI 读取子任务 ID、名称、子任务描述。描述以 `【开发中】` 开头时返回方案，其他描述不触发恢复。
- 审计信息：子任务名称或描述中写入 `titing:parent=<parentExternalId>;failure=<failureHash>;request=<requestId>`，作为无隐藏字段时的稳定幂等键；如果项目支持隐藏/自定义字段，则优先写入结构化字段。

幂等规则：

- 幂等键语义为 `parentExternalId + failureHash`，实际存储建议使用 `sha256(parentExternalId + "\\0" + failureHash)`，避免拼接歧义和字段长度问题。
- 查询范围为父 issue 开发节点下的「任务」子任务。
- 如果查到多个同一幂等键子任务，选择更新时间最新且未取消的子任务，并记录 `goal.child_issue_duplicate_detected`。
- 如果子任务创建成功但保存父任务 metadata 失败，下一次失败处理应先按幂等键查询并复用已创建子任务。

### 关键决策

- 子 issue 模型不新增 titing 任务记录；它是外部看板上的人工方案载体，父任务仍是 titing 内部唯一执行单元。
- `【开发中】` 是强门禁，必须从描述首字符开始匹配；不忽略前置空白，避免误触发。
- 相同失败指纹复用子任务，失败指纹沿用 `buildFailureHash(result, evalChecks)`。
- 覆盖所有 quality failed 路径。`handleRetryableExecutionFailure`、`handleEnvironmentFailure`、workflow prompt failure 暂不接入子 issue。
- 子任务必须来自父 issue 开发节点下的「任务」类型；若 Meegle CLI 查询不到该节点或子任务关系，Meegle 父任务 fail closed，不自动 repair。
- 兼容旧评论式闭环：非 Meegle integration 不支持子 issue 能力时，继续使用现有 `reportNeedsHuman` / `pullHumanReplies`。

### 测试策略

- core execution：quality failed 时调用 `openHumanRepairIssue`，父任务进入 `needs_human`，repair goal 为 `needs_human`，不进入自动 repair。
- core execution：首轮低风险 quality failed 且 `stopReason === null` 时也必须创建或复用子 issue，不进入 repair loop。
- core execution：`openHumanRepairIssue` 抛错、开发节点不可查询、任务类型不可用或 Meegle 子 issue 能力不可用时，不得自动 repair 父任务；应进入 `needs_human` 或 `blocked` 并记录失败事件。
- core execution：相同 `failureHash` 时使用 integration 返回的复用子 issue；不同 `failureHash` 时可创建新引用。
- core scheduler：子任务描述不以 `【开发中】` 开头时不恢复父任务。
- core scheduler：子任务描述以 `【开发中】` 开头时恢复父任务到 `queued`，repair goal 回到 `repairing`，constraints 包含人工方案。
- core scheduler：相同 `replyId` 不重复恢复。
- HTTP API：`POST /api/tasks/:id/sync-human-repair-issue` 对未准备好的子任务返回 `ready: false`，对准备好的子任务恢复父任务，对不合法状态或缺少 childIssue 返回 409。
- web console：`needs_human` 且存在 child issue 的任务显示“检查子任务方案”按钮；点击后调用接口并刷新详情。
- fallback：非 Meegle integration 不支持子 issue 能力时保持现有评论式 needs_human loop 行为；Meegle 子 issue 能力失败时 fail closed，不自动 repair。
- execution prompt：`repair_only` 模式下 prompt 不再要求完整重跑父任务 acceptance criteria，只渲染失败检查项和人工方案。
- Meegle 插件：用 CLI fixture 覆盖子任务创建、查询、描述字段解析、幂等复用、重复子任务选择和 `【开发中】` 前缀门禁。

### 风险与约束

- Meegle CLI 子任务创建和查询命令形态需要以当前 CLI 实际能力为准；若 CLI 仅支持 workitem 通用创建/查询，需要在插件内封装字段映射。
- 如果子任务描述字段名在不同项目中不同，需要新增配置项，例如 `MEEGLE_CHILD_TASK_DESCRIPTION_FIELD`。
- 如果子任务创建成功但 titing 保存 metadata 失败，需要通过失败指纹和外部查询保证幂等复用。
- 如果人工多次修改描述，titing 应使用子任务 ID + 描述摘要或更新时间去重，避免同一方案重复恢复。
- 父任务 `needs_human` 期间 workspace 保留有助于定向修复，但长期等待可能占用磁盘；后续可增加 TTL 或快照恢复策略。

### Open Questions（供 Code Review 阶段补充）

- Meegle CLI 创建父 issue 下「任务」子任务的准确命令、字段名和返回结构需要在实现前用测试 fixture 固化；若 CLI 能力不足，应先补 adapter fixture 再写 core 实现。
- 是否需要将子 issue URL 暴露到 API/UI 的任务详情中，本次设计先放入 metadata 和 execution log。
