# OpenSpec Autonomous Completion Gate 设计文档

## 澄清问题及结论

- 目标是在开发任务完成后、质量检测前增加一个强制环节：检查 OpenSpec change 中所有不需要人工介入的任务是否已经完成。
- 如果仍有未完成的自动化任务，系统不能进入质量检测，而是继续开发/修复循环，直到自动化任务全部完成。
- 用户确认采用方案 A：同时新增服务端 runtime 插件，并同步更新 `openspec-superpowers-workflow` skill 阶段定义。
- 推荐 change-id 为 `add-openspec-autonomous-completion-gate`。
- 技术栈 Profile：TypeScript monorepo，使用 npm workspaces；测试以 `npm run test -w apps/server -- ...`、`npm run test -w apps/web -- ...`、`npm run type-check` 为主。

## 候选方案对比

### 方案 A：新增 `completion-gate` runtime 插件并更新 workflow skill（已确认）

在 `@titing/plugin-api` 中新增 `CompletionGatePlugin` 与 `completion-gate` kind。服务端 `ServiceExecution` 在 `ExecutionPlugin` 成功返回后、`QualityPlugin` 执行前调用默认插件。默认插件读取 workspace 内 OpenSpec change 的 `tasks.md` / `workflow-state.md`，识别无需人工介入的未完成任务；若存在未完成项，则生成 completion repair goal 并进入既有 repair loop；若全部完成，才继续 quality。

优点：
- quality 前有服务端硬闸门，不依赖 Agent 自觉。
- 插件 kind 可被外部包替换，后续可支持不同任务系统或更复杂的 completion policy。
- workflow skill 同步记录 phase-3.5，人工执行与自动化执行的语义一致。

缺点：
- 涉及 `plugin-api`、core runtime、server built-in plugins、run observability、workflow skill 文档和测试，改动面较大。
- 需要谨慎设计未完成任务到 repair goal 的映射，避免与 quality repair 混淆。

### 方案 B：复用 `QualityPlugin`

把 OpenSpec 任务未完成视为一个 quality check failure，由现有 `DefaultQualityPlugin` 返回 failed。

优点：
- 改动较少，可复用现有 evaluation 和 repair 逻辑。

缺点：
- “开发任务尚未完成”不是质量失败，混入 quality score/risk 会让观测和人工判断变得含糊。
- 无法保证它一定在其他 quality scripts 前执行。

### 方案 C：仅扩展 `WORKFLOW_PROMPTS.md` 节点循环

通过默认 prompt 要求 Agent 在结束前检查 OpenSpec tasks，并配置 `loopEnabled` / `maxLoops`。

优点：
- 实现轻量，不需要新增插件 kind。

缺点：
- 缺少服务端硬约束，Agent 可误报完成后进入 quality。
- 不适合未来接入不同 completion policy。

## 最终选择及理由

采用方案 A。这个需求的核心是“quality 前必须阻断”，因此应由服务端编排管线保证，而不是只写在 prompt 或 skill 文档里。新增 `completion-gate` kind 可以把 OpenSpec 任务完成度检查从 quality 中分离出来，保留质量检测语义，同时保持插件可替换。同步更新 `openspec-superpowers-workflow` 是为了让手动/半自动执行流程的阶段账本与 runtime 行为保持一致。

## 技术设计

### 架构分层

#### plugin-api

新增类型：
- `PluginKind` 增加 `"completion-gate"`。
- `RunStageKey` 增加 `"completion_gate"`，用于运行观测。
- `CompletionGateCheck`：单个检查项，包含 `name`、`passed`、`detail`、可选 `taskRef`。
- `CompletionGateResult`：包含 `passed`、`checks`、`incompleteTasks`、`repairObjective`、`repairDoneWhen`、`metadata`。
- `CompletionGatePlugin`：继承 `RuntimePlugin`，`kind: "completion-gate"`，提供 `evaluate(input)`。
- `RepairGoal` 增加 `metadata: Record<string, unknown>`，用于区分 repair 来源并持久化 completion gate 上下文。

`evaluate` 输入包含：
- `task: TitingTask`
- `workspace: PreparedWorkspace`
- `execution: ExecutionResult`
- `repairGoal: RepairGoal | null`

#### 默认 completion gate 插件

新增 `DefaultOpenSpecCompletionGatePlugin`，放在 `apps/server/src/titing/plugins/completion-gate.ts`。

职责：
- 定位 workspace repo 中的 OpenSpec change 目录。
- 读取 `tasks.md`，提取任务 checkbox。
- 排除需要人工介入的任务。
- 判断自动化任务是否全部完成。
- 返回结构化 result，供 `ServiceExecution` 决定是否进入 quality 或继续 repair。

OpenSpec change 定位规则：
- 优先读取 `task.metadata.openspecChangeId`。
- 其次读取 workspace artifact 中由环境准备阶段写入的 active change metadata。
- 若 `openspec/changes/` 下只有一个未归档 change，可作为 fallback。
- 若无法定位或存在多个候选 change，则 fail-closed，阻止 quality 并给出可执行 repair objective：补充任务 metadata 或明确 active change。

`openspecChangeId` 写入责任：
- task 创建 API 接受并持久化 `metadata.openspecChangeId`。
- Meegle task adapter 若能从需求描述、标签或字段解析 OpenSpec change-id，必须写入该 metadata。
- 环境准备阶段在 workspace artifact 写入 active change metadata，供 execution 和 completion gate 共享。
- 如果外部任务无法提供 change-id，默认插件只能在单一 active change 时 fallback；多 change 时必须 fail-closed 并要求补充 metadata。

人工介入任务的识别规则：
- 任务文本含明确人工门禁词：`等待用户确认`、`人工确认`、`User Review Gate`、`用户在终端执行`、`用户在终端执行 openspec validate`、`用户在终端执行 openspec archive`。
- 任务或其子项标注 `manual` / `human` / `需要人工`。
- `workflow-state.md` 中属于强制人工卡点的阶段，例如 `phase-2.4-user-confirmation`。

checkbox 层级规则：
- 父 task 标注为人工介入时，其未完成状态不阻塞 completion gate；子项若显式标注为自动化任务，仍需单独完成。
- 自动化父 task 下的人工子项只豁免该子项，不豁免父 task 的其他自动化子项。
- 父 task 未勾选但所有自动化子项已完成时，仍视为父 task 未完成，除非父 task 本身匹配人工介入规则。
- 子项未勾选且未匹配人工介入规则时，视为未完成自动化任务，并进入 repair objective。

无需人工介入任务的识别规则：
- `tasks.md` 中普通 `- [ ]` / `- [x]` task。
- 不匹配人工介入规则。
- 包含代码、测试、文档、插件实现、stage report 写入等可由 Agent 完成的任务。

#### core runtime

`PluginRuntime` 增加：
- `getCompletionGatePlugins()`
- `getPrimaryCompletionGatePlugin()`

`ServiceExecution.runTask` 调整执行顺序：

1. environment
2. execution
3. completion gate
4. quality
5. pull request / done 或 repair

强制策略：
- 对已定位到 OpenSpec change 的任务，completion gate 是强制闸门；若没有启用任何 `completion-gate` 插件，任务 fail-closed，不得进入 quality。
- 对非 OpenSpec 任务，允许记录 `completion_gate.skipped` 并继续原有 quality 流程。
- 插件配置可以替换默认实现或调整优先级，但不能让 OpenSpec 任务绕过 completion gate。

当 completion gate passed：
- 记录 `completion_gate.completed`。
- 继续 quality。

当 completion gate failed：
- 不创建 `EvalResult`，不调用 `QualityPlugin`。
- 创建或更新 `RepairGoal`，`objective` 来自插件返回的 `repairObjective`。
- `doneWhen` 来自插件返回的 `tasks.md` 文件路径引用，避免逐项列出 checkbox 文案导致提示词过长。
- `currentIteration`、`task.repairCount` 与现有 repair loop 共享预算计数；`lastFailureHash` 使用 incomplete task refs 和 gate plugin id 计算。
- 若同一 incomplete task 列表重复失败并达到 `maxRepairIterations`，任务进入 `failed` 或按现有 needs-human 策略转入 `needs_human`，但不得静默继续 quality。
- 任务转为 `repairing`，记录 `completion_gate.iteration_started`。
- 下一轮继续调用 execution plugin，直到 gate passed 或达到 repair 预算。

为避免与 quality repair 混淆，completion gate 的 repair metadata 需要带上：
- `repairSource: "completion-gate"`
- `completionGatePluginId`
- `incompleteTasks`

`RepairGoal.metadata` 持久化要求：
- 数据库 `repair_goals` 表增加 metadata JSON 字段，默认 `{}`。
- repair goal repository 读写时映射该字段。
- 现有 quality repair 创建/更新 goal 时写入 `repairSource: "quality"` 或保持空对象，并保证向后兼容。
- run observability / trace 输出读取 metadata，用于区分 completion gate repair 与 quality repair。
- 测试覆盖 migration/default、repository round-trip、completion gate metadata 写入和 repair 恢复读取。

#### server built-in plugins

`createBuiltinPluginGroups` 增加 `"completion-gate"` 组，并默认注册 `DefaultOpenSpecCompletionGatePlugin`。

同时同步所有插件 kind 硬编码位置：
- `PluginKind`、`PLUGIN_CONTRACT_KINDS` 或等价 kind 列表。
- server plugin config API 的 kind 校验。
- external plugin package 校验与加载分支。
- `.env.example`、插件配置文档和测试 fixture。

#### run observability

运行视图新增 `completion_gate` stage，位于 `execute` 与 `quality` 之间。

相关日志事件：
- `completion_gate.started`
- `completion_gate.completed`
- `completion_gate.failed`
- `completion_gate.skipped`
- `completion_gate.iteration_started`

需要同步更新所有固定 stage 推断点：
- `RunStageKey`
- stage order / label / fallback inference
- raw log 到 stage 的映射
- server/web 运行时间线测试
- 前端运行视图如存在固定 stage 展示，也要显示 `completion_gate`

#### workflow skill

更新 `.claude/skills/openspec-superpowers-workflow/SKILL.md`：
- 阶段账本模板增加：
  - `phase-3.5-completion-gate`
  - `phase-3.5-report`
- 阶段 3 与阶段 4 之间新增“阶段 3.5：自动化任务完成度闸门”。
- 阶段 3.5 要求读取 `tasks.md`、`workflow-state.md`、`stage-reports/stage-3-implementation.md`，检查所有无需人工介入的 task 是否完成。
- 若未完成，回到阶段 3 继续 TDD 实现；不得进入阶段 4。
- 写入 `stage-reports/stage-3.5-completion-gate.md` 后才勾选对应账本项。

阶段 3.5 只检查 quality 前应完成的阶段：
- 必须要求 `phase-3-implementation` 与 `phase-3-report` 完成。
- 不得要求 `phase-4`、`phase-5`、`phase-6` 完成，因为这些阶段本来就在 quality/check/review 之后。

### 关键决策

- `completion-gate` 不复用 `quality`，因为它检查的是“是否完成实现范围”，不是“实现质量是否达标”。
- 默认插件以 OpenSpec `tasks.md` 为事实来源，`workflow-state.md` 用于阶段级状态补充。
- 未完成任务不直接进入 `needs_human`。只有任务本身匹配人工介入规则时才允许跳过或等待人工；其他未完成项都应推动自动 repair。
- completion gate failure 不创建 `EvalResult`，避免质量报表出现“尚未完成”导致的假 quality failure。
- repair 预算复用现有 `maxRepairIterations`，但 failure hash 需要包含 incomplete task 列表，避免重复无效循环无法识别。
- OpenSpec 任务的 completion gate 不可通过禁用插件绕过；禁用只对非 OpenSpec 任务等价于 skip。

### 风险与约束

- `tasks.md` 是 Markdown 文本，解析应保持保守：只解析 checkbox task，不尝试理解任意自然语言结构。
- 人工介入识别规则必须可测试，避免把真正可自动完成的任务误判为人工任务。
- 如果找不到 OpenSpec change 或 `tasks.md`，默认插件按定位规则 fail-closed 或 skip：已知 OpenSpec 任务 fail-closed；明确非 OpenSpec 任务 skip。
- 多 change 同时存在时，优先从 task metadata、workspace artifacts 或单一 active change 推导；无法唯一确定时 fail-closed。
- 修改 workflow skill 属于 process documentation，也需要按 skill TDD 思路先设计压力场景，避免只改文档但未来 Agent 仍跳过 phase-3.5。
- 实现计划必须覆盖测试矩阵：parser 单测、人工识别单测、多 change/fail-closed、gate failed 不调用 `QualityPlugin`、gate passed 才进入 quality、repair 预算耗尽、observability stage、外部插件注册与禁用策略、workflow skill phase-3.5 压力场景。

### Open Questions（供 Code Review 阶段补充）

- completion gate 失败时是否需要单独的 `RepairGoal.status` 或仅用 metadata 区分来源。
