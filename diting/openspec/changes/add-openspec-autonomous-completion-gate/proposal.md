# Proposal: add OpenSpec autonomous completion gate

## 目标

在 `execution` 完成后、`quality` 执行前增加强制完成度闸门，检查 OpenSpec change 中所有无需人工介入的任务是否已经完成。若仍有自动化任务未完成，系统必须继续开发/修复循环；只有全部完成后才允许进入质量检测。

## 方案

- 新增 `completion-gate` runtime 插件 kind，并提供内置 `DefaultOpenSpecCompletionGatePlugin`。
- 默认插件解析 OpenSpec `tasks.md` / `workflow-state.md`，识别无需人工介入的未完成任务，返回结构化 `CompletionGateResult`。
- `ServiceExecution` 在 quality 前调用 completion gate；OpenSpec 任务没有可用 gate 或 gate failed 时 fail-closed，不得调用 `QualityPlugin`。
- completion gate failed 时复用现有 repair loop，并通过 `RepairGoal.metadata` 标识 `repairSource: "completion-gate"`、包含未完成任务的 `tasks.md` 文件路径和未完成数量。
- 运行观测新增 `completion_gate` stage，前端 run timeline 显示该阶段。
- `.claude/skills/openspec-superpowers-workflow/SKILL.md` 新增 phase-3.5，手动/半自动 workflow 也必须先检查自动化任务完成度再进入质量检测。

## 影响范围

- `@titing/plugin-api`：新增 completion gate 契约、插件 kind、运行阶段 key、`RepairGoal.metadata`。
- `packages/core`：更新插件选择、执行编排、repair goal 元数据、run observability。
- `apps/server`：新增默认插件、外置插件加载、配置项、SQLite migration 和 repository 映射。
- `apps/web`：展示 `completion_gate` stage。
- `.env.example`：新增 `TITING_PLUGIN_COMPLETION_GATE_PACKAGE`。
- OpenSpec workflow skill：新增阶段账本项、阶段 3.5 报告和护栏。

## 风险与约束

- `tasks.md` 是 Markdown 文本，解析必须保守，只解析 checkbox task 和明确人工介入标记。
- OpenSpec change 定位必须优先使用 `metadata.openspecChangeId`，多 change 无法唯一定位时 fail-closed。
- completion gate failure 不是 quality failure，不创建 `EvalResult`，避免污染质量报表。
- OpenSpec 任务不能通过禁用 completion gate 插件绕过闸门；禁用只允许非 OpenSpec 任务继续原 quality 流程。
