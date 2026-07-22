# 阶段 5 Code Review 报告

## 审查范围

- `completion-gate` 插件契约、默认 OpenSpec parser、外部插件装配和配置。
- `ServiceExecution` 中 execution 后、quality 前的 completion gate 编排与 repair loop。
- `RepairGoal.metadata` 持久化、run observability、前端 timeline 和 workflow skill phase-3.5。
- OpenSpec change `add-openspec-autonomous-completion-gate` 的 delta specs 与任务制品。

## 第一轮审查结果

发现 1 个 Critical 和若干 Important / Minor：

- Critical：`ServiceExecution` 只在 `task.metadata.openspecChangeId` 存在时调用 completion gate，导致默认插件的 workspace artifact / 单一 active change fallback 无法生效。
- Important：completion gate 观测事件未使用 `completion_gate.completed` / `failed` / `skipped` / `iteration_started` 契约。
- Important：默认 parser 未支持父级 manual/human checkbox 下的子项继承人工豁免。
- Important：前端 API `RunStageKey` 缺少 `completion_gate`。
- Minor：server plugin config kind union 缺少 `completion-gate`。

## 修复动作

- 调整 `ServiceExecution`：只要 completion gate 插件存在就调用，由插件返回 passed/failed/skipped；缺插件时仅对显式 OpenSpec 任务 fail-closed。
- 新增服务层回归测试，覆盖无 metadata 但 gate 从 workspace/single active change 解析失败时仍阻止 quality 并进入 repair loop。
- 将观测事件改为 `completion_gate.completed`、`completion_gate.failed`、`completion_gate.skipped`，失败 repair 记录 `completion_gate.iteration_started`。
- 调整 run observability 聚合，未恢复的 failed step 优先于 skipped。
- 改造默认 parser 为缩进感知，父级 manual/human checkbox 的子项继承人工豁免。
- 补齐 `apps/web/src/api.ts` 和 `apps/server/src/titing/server.ts` 的 completion gate 类型。

## 复核结果

复核审查结论：未发现阻塞性问题。

## 后续语义调整

用户最终确认 completion gate 不应把 `tasks.md` 子项展开成独立 `TitingTask`，也不应在一次 repair 后 skipped/done。当前语义调整为：completion gate 仍在当前 `TitingTask` 下汇总未完成自动化子项；repair 后仍失败时继续当前 task 的下一轮 repair，直到 completion gate 通过或 repair 预算耗尽。

同时保留默认 completion gate 的多 active changes 扫描能力：当 workspace 存在多个 active OpenSpec changes 且当前任务未提供 `openspecChangeId` 时，不再返回 `Unable to resolve a unique OpenSpec change`；默认插件会扫描所有 active changes 的 `tasks.md`，并以 `tasks.md` 文件路径汇总包含未完成自动化子项的文件。

为避免 OpenSpec 任务过多导致 repair prompt 超过上限，默认 completion gate 不再逐项列出未完成 checkbox 文案；`incompleteTasks`、`repairObjective` 与 `repairDoneWhen` 仅包含对应 `tasks.md` 文件路径，未完成 checkbox 数量记录到 `metadata.incompleteTaskCount`。

补充验证：
- `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "completion gate"`：通过，6 tests
- `npm run test -w apps/server -- apps/server/src/titing/plugins.spec.ts -t "completion gate"`：通过，6 tests
- `npm run test -w apps/server -- apps/server/src/titing/config.spec.ts`：通过，6 tests
- `npm run type-check`：通过
- `openspec validate "add-openspec-autonomous-completion-gate" --strict`：通过

残余风险：
- 默认 gate 对无 metadata 任务会尝试 workspace artifact / 单一 active change fallback；这符合本次设计，但在同仓库存在单一 active change 的非 OpenSpec 任务上可能触发 gate 约束。后续可增加显式 skip metadata 或更细粒度任务来源开关。
- manual/human 匹配仍是启发式规则；后续可引入结构化标记降低误豁免风险。

## 验证

- `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "completion gate"`：通过
- `npm run test -w apps/server -- apps/server/src/titing/plugins.spec.ts -t "completion gate"`：通过
- `npm run test -w apps/server -- packages/core/src/titing/run-observability.spec.ts -t "completion gate"`：通过
- `npm run type-check`：通过
- `npm test`：通过，server 15 suites / 216 tests，web 18 tests
- `ReadLints`：无错误
