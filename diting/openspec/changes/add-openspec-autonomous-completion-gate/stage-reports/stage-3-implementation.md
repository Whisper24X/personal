# 阶段 3 实现报告

## 完成范围

- Task 1：扩展 `plugin-api` completion gate 契约，新增 `completion-gate` plugin kind、`completion_gate` run stage、`CompletionGatePlugin` 输入输出契约和 runtime 选择方法。
- Task 2：持久化 `RepairGoal.metadata`，新增 `metadata_json` migration，repository 写入和读取 JSON envelope。
- Task 3：实现 `DefaultOpenSpecCompletionGatePlugin`，支持 OpenSpec change 定位、`tasks.md` checkbox 解析、人工介入任务豁免和多 change fail-closed。
- Task 4：注册内置和外部 completion gate 插件，新增 `TITING_PLUGIN_COMPLETION_GATE_PACKAGE` 配置。
- Task 5：在 `ServiceExecution` 中插入 quality 前 completion gate，失败时创建 `repairSource = "completion-gate"` 的 repair goal 并进入 repair loop。
- Task 6：更新 run observability 与前端 timeline，展示 `completion_gate` 阶段。
- Task 7：更新 `.claude/skills/openspec-superpowers-workflow/SKILL.md`，新增 phase-3.5 护栏。

## TDD 摘要

- RED：新增 plugin runtime、repository metadata、completion gate parser、external config、service orchestration、observability、web timeline 和 workflow skill 锚点测试，均先观察到失败或未命中。
- GREEN：补齐最小实现后，聚焦测试全部通过。
- REFACTOR：修正测试命名确保 `-t` 命中，补齐既有 fixture 的 `metadata` 字段和外部插件顺序预期。

## 测试文件

- `packages/core/src/titing/plugin-runtime.spec.ts`
- `apps/server/src/titing/repositories.spec.ts`
- `apps/server/src/titing/plugins.spec.ts`
- `apps/server/src/titing/external-plugins.spec.ts`
- `apps/server/src/titing/config.spec.ts`
- `packages/core/src/titing/services.spec.ts`
- `packages/core/src/titing/run-observability.spec.ts`
- `apps/web/src/App.spec.tsx`

## Tasks 状态

`tasks.md` 中 8 个顶层任务均已完成。`openspec validate --strict` 为用户终端执行项，已在收尾说明中列出。
