# OpenSpec Autonomous Completion Gate 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 execution 之后、quality 之前增加可替换的 `completion-gate` 插件闸门，确保 OpenSpec change 中所有无需人工介入的任务完成后才进入质量检测。

**Architecture:** 新增 `CompletionGatePlugin` 契约和内置 `DefaultOpenSpecCompletionGatePlugin`，由 `ServiceExecution` 在 quality 前强制调用。默认插件解析 OpenSpec `tasks.md` / `workflow-state.md`，未完成自动化任务会转入现有 repair loop；观测层新增 `completion_gate` stage，workflow skill 新增 phase-3.5。

**Tech Stack:** TypeScript monorepo，npm workspaces，Vitest/Testing Library。

---

## Task 1: 扩展 plugin-api 契约

**Files:**
- Modify: `packages/plugin-api/src/titing/models.ts`
- Modify: `packages/plugin-api/src/titing/plugins.ts`
- Modify: `packages/core/src/titing/plugin-runtime.spec.ts`
- Modify: `packages/core/src/titing/plugin-runtime.ts`

- [ ] **Step 1: Write the failing test**
  - 在 `plugin-runtime.spec.ts` 增加 `selects the highest-priority completion gate plugin`。
  - 增加 `returns null when no completion gate plugin is enabled`。
  - 测试 helper 新增 `createCompletionGatePlugin`，其 `kind` 为 `"completion-gate"` 并实现 `evaluate()`。

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -w apps/server -- packages/core/src/titing/plugin-runtime.spec.ts -t "completion gate"
```

Expected: FAIL，因为 `CompletionGatePlugin` 与 runtime 选择方法不存在。

- [ ] **Step 3: Write minimal implementation**
  - `PluginKind` 增加 `"completion-gate"`。
  - `RunStageKey` 增加 `"completion_gate"`。
  - `RepairGoal` 增加 `metadata: Record<string, unknown>`。
  - `plugins.ts` 新增 `CompletionGateInput`、`CompletionGateCheck`、`CompletionGateResult`、`CompletionGatePlugin`。
  - `PluginRuntime` 新增 `getCompletionGatePlugins()` 和 `getPrimaryCompletionGatePlugin()`。

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -w apps/server -- packages/core/src/titing/plugin-runtime.spec.ts -t "completion gate"
```

Expected: PASS.

## Task 2: 持久化 `RepairGoal.metadata`

**Files:**
- Modify: `apps/server/src/titing/repositories.spec.ts`
- Modify: `apps/server/src/titing/repositories.integration.spec.ts`
- Modify: `apps/server/src/titing/repositories.ts`
- Modify: `apps/server/src/titing/migrations/001_initial.sql`
- Create: `apps/server/src/titing/migrations/006_repair_goal_metadata.sql`

- [ ] **Step 1: Write the failing test**
  - 在 repository JSON envelope 测试中断言 repair goal 写入 `metadata_json`。
  - 在读取测试中加入 `metadata_json: { schemaVersion: "2026-05-11", data: { repairSource: "completion-gate" } }`。
  - 断言 `goal.metadata` round-trip。

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -w apps/server -- apps/server/src/titing/repositories.spec.ts -t "repair goals"
```

Expected: FAIL，因为 `RepairGoal.metadata` 尚未映射。

- [ ] **Step 3: Write minimal implementation**
  - `repair_goals` 表增加 `metadata_json`，默认 `{}` envelope。
  - 新增 `006_repair_goal_metadata.sql`。
  - `PgRepairGoalRepository.upsert` 写入/更新 `metadata_json`。
  - `mapRepairGoal` 兼容旧库缺列并 fallback `{}`。
  - 所有创建 `RepairGoal` 的位置补 `metadata`。

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -w apps/server -- apps/server/src/titing/repositories.spec.ts -t "repair goals"
```

Expected: PASS.

## Task 3: 实现默认 OpenSpec completion gate parser

**Files:**
- Create: `apps/server/src/titing/plugins/completion-gate.ts`
- Modify: `apps/server/src/titing/plugins.spec.ts`

- [ ] **Step 1: Write the failing tests**
  - `passes when all autonomous OpenSpec tasks are checked`
  - `fails with repair objective when an autonomous task is unchecked`
  - `ignores explicit human/manual gate tasks`
  - `does not treat agent-run openspec validate as manual unless user-terminal/manual is present`
  - `fails closed when multiple changes exist and no openspecChangeId is available`

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -w apps/server -- apps/server/src/titing/plugins.spec.ts -t "completion gate"
```

Expected: FAIL，因为默认插件尚不存在。

- [ ] **Step 3: Write minimal implementation**
  - 新增 `DefaultOpenSpecCompletionGatePlugin`。
  - 按 `task.metadata.openspecChangeId` → artifact active metadata → single active change fallback 定位 change。
  - 解析 `tasks.md` checkbox 与缩进层级。
  - 仅显式 human/manual 或“用户在终端执行 openspec validate/archive”视为人工任务。
  - 未完成自动化任务返回 `passed=false`、`repairObjective` 和 `repairDoneWhen`。

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -w apps/server -- apps/server/src/titing/plugins.spec.ts -t "completion gate"
```

Expected: PASS.

## Task 4: 注册内置和外部 completion gate 插件

**Files:**
- Modify: `apps/server/src/titing/plugins/index.ts`
- Modify: `apps/server/src/titing/external-plugins.ts`
- Modify: `apps/server/src/titing/external-plugins.spec.ts`
- Modify: `apps/server/src/titing/config.ts`
- Modify: `apps/server/src/titing/config.spec.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write the failing tests**
  - `external-plugins.spec.ts` 覆盖外置 completion gate 替换内置组。
  - 覆盖缺少 `evaluate()` 的外置 completion gate 被拒绝。
  - `config.spec.ts` 覆盖 `TITING_PLUGIN_COMPLETION_GATE_PACKAGE`。

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -w apps/server -- apps/server/src/titing/external-plugins.spec.ts apps/server/src/titing/config.spec.ts -t "completion gate"
```

Expected: FAIL，因为配置与 external loader 尚不认识该 kind。

- [ ] **Step 3: Write minimal implementation**
  - `BuiltinPluginGroups` 增加 `"completion-gate"`。
  - 内置装配顺序改为 `log → task-integration → environment → execution → completion-gate → quality → observability-governance`。
  - `ServerConfig.plugins.completionGate.packageName`、`CONFIG_DEFAULTS`、`readConfig` 和 `.env.example` 增加配置。
  - external loader 支持 completion gate kind 并校验 `evaluate()`。

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -w apps/server -- apps/server/src/titing/external-plugins.spec.ts apps/server/src/titing/config.spec.ts -t "completion gate"
```

Expected: PASS.

## Task 5: 在 `ServiceExecution` 中插入 quality 前闸门

**Files:**
- Modify: `packages/core/src/titing/services.spec.ts`
- Modify: `packages/core/src/titing/service-execution.ts`
- Modify: `packages/core/src/titing/service-shared.ts`（如需 helper）

- [ ] **Step 1: Write the failing tests**
  - `runs completion gate before quality`
  - `does not call quality when completion gate reports incomplete autonomous tasks`
  - `continues repair loop from completion gate failure`
  - `fails closed for OpenSpec tasks when no completion gate plugin is available`
  - `skips completion gate for non-OpenSpec tasks and continues quality`

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "completion gate"
```

Expected: FAIL，因为服务当前 execution 后直接进入 quality。

- [ ] **Step 3: Write minimal implementation**
  - 在 plugin selection 中选择 `completionGatePlugin`。
  - execution 成功后、quality 前调用 completion gate。
  - OpenSpec 任务无 gate 时 fail-closed，不调用 quality。
  - gate failed 时创建/更新 `RepairGoal`，`metadata.repairSource = "completion-gate"`，任务转 `repairing` 并记录 `completion_gate.iteration_started`。
  - gate passed 时记录 `completion_gate.completed` 后继续 quality。

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "completion gate"
```

Expected: PASS.

## Task 6: 更新 run observability 和前端阶段展示

**Files:**
- Modify: `packages/core/src/titing/run-observability.spec.ts`
- Modify: `packages/core/src/titing/run-observability.ts`
- Modify: `apps/web/src/App.spec.tsx`
- Modify: `apps/web/src/run-observability.tsx`

- [ ] **Step 1: Write the failing tests**
  - `maps completion gate logs to completion_gate stage`
  - `orders completion_gate between execute and quality`
  - 前端断言 stage progress 中出现 `completion_gate`。

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -w apps/server -- packages/core/src/titing/run-observability.spec.ts -t "completion gate"
npm run test -w apps/web -- src/App.spec.tsx -t "completion_gate"
```

Expected: FAIL，因为 stage key 尚未识别。

- [ ] **Step 3: Write minimal implementation**
  - `STAGE_ORDER` 插入 `"completion_gate"`。
  - `STAGE_LABELS.completion_gate = "Completion Gate"`。
  - `inferRunStage` 优先匹配 `completion_gate`。
  - 同步 API 类型/前端 fixture。

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -w apps/server -- packages/core/src/titing/run-observability.spec.ts -t "completion gate"
npm run test -w apps/web -- src/App.spec.tsx -t "completion_gate"
```

Expected: PASS.

## Task 7: 更新 workflow skill phase-3.5（按 skill TDD）

**Files:**
- Modify: `.claude/skills/openspec-superpowers-workflow/SKILL.md`

- [ ] **Step 1: RED pressure scenario without the new skill text**
  - 派发只读 subagent，场景为：stage-3 report 已写入，但 `tasks.md` 仍有一个未标记 `[x]` 的自动化任务，用户说“继续做质量检测”。
  - 记录 baseline 是否会跳过 completion gate。

- [ ] **Step 2: Write the failing documentation assertion**

```bash
rg "phase-3\\.5-completion-gate|stage-3\\.5-completion-gate|不得进入阶段 4" .claude/skills/openspec-superpowers-workflow/SKILL.md
```

Expected: FAIL / no matches before edit.

- [ ] **Step 3: Write minimal skill update**
  - 阶段账本模板增加 `phase-3.5-completion-gate` 与 `phase-3.5-report`。
  - 阶段 3 后、阶段 4 前新增“阶段 3.5：自动化任务完成度闸门”。
  - 若仍有未完成的无需人工介入任务，必须回到阶段 3，不得进入阶段 4。
  - 阶段报告目录增加 `stage-3.5-completion-gate.md`。

- [ ] **Step 4: Verify the skill text and rerun pressure scenario**

```bash
rg "phase-3\\.5-completion-gate|stage-3\\.5-completion-gate|不得进入阶段 4" .claude/skills/openspec-superpowers-workflow/SKILL.md
```

Expected: PASS；更新后的 subagent 压力场景必须要求检查 `tasks.md` / `workflow-state.md` 并阻止进入阶段 4。

## Task 8: 全量验证

**Files:**
- Modify: `openspec/changes/add-openspec-autonomous-completion-gate/*`

- [ ] **Step 1: Run focused server tests**

```bash
npm run test -w apps/server -- packages/core/src/titing/plugin-runtime.spec.ts apps/server/src/titing/repositories.spec.ts apps/server/src/titing/plugins.spec.ts apps/server/src/titing/external-plugins.spec.ts packages/core/src/titing/services.spec.ts packages/core/src/titing/run-observability.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused web tests**

```bash
npm run test -w apps/web -- src/App.spec.tsx
```

Expected: PASS.

- [ ] **Step 3: Run typecheck and full tests**

```bash
npm run type-check
npm test
```

Expected: PASS.

- [ ] **Step 4: Run lints and OpenSpec validation**
  - 使用 `ReadLints` 检查修改的 TypeScript 文件。
  - 请用户执行：

```bash
openspec validate "add-openspec-autonomous-completion-gate" --strict
```

Expected: PASS.

## Self-Review

- Spec coverage: 覆盖插件契约、默认插件、运行时选择、service 编排、repair metadata、observability、外置插件配置、workflow skill phase-3.5 和验证。
- Placeholder scan: 未发现待填占位。
- Type consistency: `completion-gate` 用于 `PluginKind`，`completion_gate` 用于 `RunStageKey`，`DefaultOpenSpecCompletionGatePlugin` 用于内置类，`RepairGoal.metadata` 贯穿持久化与 repair 恢复。
