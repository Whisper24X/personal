# Tasks

- [x] 1. 扩展 plugin-api completion gate 契约
  - 先在 `packages/core/src/titing/plugin-runtime.spec.ts` 写失败测试，覆盖 completion gate 插件按 priority 选择和禁用后返回 null
  - 修改 `packages/plugin-api/src/titing/models.ts`，新增 `PluginKind: "completion-gate"`、`RunStageKey: "completion_gate"`、`RepairGoal.metadata`
  - 修改 `packages/plugin-api/src/titing/plugins.ts`，新增 `CompletionGateInput`、`CompletionGateCheck`、`CompletionGateResult`、`CompletionGatePlugin`
  - 修改 `packages/core/src/titing/plugin-runtime.ts`，新增 `getCompletionGatePlugins()` 与 `getPrimaryCompletionGatePlugin()`
  - 运行 `npm run test -w apps/server -- packages/core/src/titing/plugin-runtime.spec.ts -t "completion gate"`

- [x] 2. 持久化 `RepairGoal.metadata`
  - 先在 `apps/server/src/titing/repositories.spec.ts` 写失败测试，覆盖 repair goal metadata envelope 写入和 round-trip
  - 修改 `apps/server/src/titing/migrations/001_initial.sql`，为 `repair_goals` 增加 `metadata_json`
  - 新增 `apps/server/src/titing/migrations/006_repair_goal_metadata.sql`
  - 修改 `apps/server/src/titing/repositories.ts`，读写 `metadata_json` 并兼容旧行 fallback `{}`
  - 补齐所有 `RepairGoal` 创建点的 `metadata`
  - 运行 `npm run test -w apps/server -- apps/server/src/titing/repositories.spec.ts -t "repair goals"`

- [x] 3. 实现默认 OpenSpec completion gate parser
  - 先在 `apps/server/src/titing/plugins.spec.ts` 写失败测试，覆盖全部自动化任务已完成、未完成自动化任务、人工门禁豁免、`openspec validate` 误判防护、多 change fail-closed
  - 新增 `apps/server/src/titing/plugins/completion-gate.ts`
  - 实现 `DefaultOpenSpecCompletionGatePlugin`，按 `metadata.openspecChangeId`、workspace artifact、单一 active change 定位 change
  - 解析 `tasks.md` checkbox 与人工介入规则，输出 `CompletionGateResult`
  - 运行 `npm run test -w apps/server -- apps/server/src/titing/plugins.spec.ts -t "completion gate"`

- [x] 4. 注册内置和外部 completion gate 插件
  - 先在 `apps/server/src/titing/external-plugins.spec.ts` 写失败测试，覆盖外置 completion gate 替换和缺少 `evaluate()` 被拒绝
  - 先在 `apps/server/src/titing/config.spec.ts` 写失败测试，覆盖 `TITING_PLUGIN_COMPLETION_GATE_PACKAGE`
  - 修改 `apps/server/src/titing/plugins/index.ts`，在 execution 与 quality 之间注册内置 completion gate
  - 修改 `apps/server/src/titing/external-plugins.ts`，支持 `"completion-gate"` kind、装配顺序和契约校验
  - 修改 `apps/server/src/titing/config.ts` 和 `.env.example`，加入 completion gate package 配置
  - 运行 `npm run test -w apps/server -- apps/server/src/titing/external-plugins.spec.ts apps/server/src/titing/config.spec.ts -t "completion gate"`

- [x] 5. 在 `ServiceExecution` 中插入 quality 前闸门
  - 先在 `packages/core/src/titing/services.spec.ts` 写失败测试，覆盖 gate 先于 quality、gate failed 不调用 quality、gate repair loop、OpenSpec 无 gate fail-closed、非 OpenSpec skip
  - 修改 `packages/core/src/titing/service-execution.ts`，execution 成功后先调用 completion gate
  - gate failed 时创建/更新 `RepairGoal`，写入 `metadata.repairSource = "completion-gate"` 和 incomplete tasks
  - gate passed 后才继续 `QualityPlugin.evaluate`
  - 运行 `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "completion gate"`

- [x] 6. 更新 run observability 和前端阶段展示
  - 先在 `packages/core/src/titing/run-observability.spec.ts` 写失败测试，覆盖 `completion_gate` stage 推断和排序
  - 先在 `apps/web/src/App.spec.tsx` 写失败测试，覆盖 run timeline 显示 `completion_gate`
  - 修改 `packages/core/src/titing/run-observability.ts`，将 `completion_gate` 放在 execute 与 quality 之间
  - 修改 `apps/web/src/run-observability.tsx` 或相关类型/fixture，确保前端显示新增 stage
  - 运行 `npm run test -w apps/server -- packages/core/src/titing/run-observability.spec.ts -t "completion gate"`
  - 运行 `npm run test -w apps/web -- src/App.spec.tsx -t "completion_gate"`

- [x] 7. 更新 workflow skill phase-3.5
  - 先按 skill TDD 派发压力场景，记录当前 skill 是否会在自动化 task 未完成时跳过到阶段 4
  - 使用 `rg "phase-3\\.5-completion-gate|stage-3\\.5-completion-gate|不得进入阶段 4" .claude/skills/openspec-superpowers-workflow/SKILL.md` 验证 RED
  - 修改 `.claude/skills/openspec-superpowers-workflow/SKILL.md`，新增 phase-3.5、阶段报告和 final 护栏
  - 重新运行 `rg` 验证锚点存在，并重新派发压力场景确认不会进入阶段 4

- [x] 8. 全量验证
  - 运行 `npm run test -w apps/server -- packages/core/src/titing/plugin-runtime.spec.ts apps/server/src/titing/repositories.spec.ts apps/server/src/titing/plugins.spec.ts apps/server/src/titing/external-plugins.spec.ts packages/core/src/titing/services.spec.ts packages/core/src/titing/run-observability.spec.ts`
  - 运行 `npm run test -w apps/web -- src/App.spec.tsx`
  - 运行 `npm run type-check`
  - 运行 `npm test`
  - 使用 ReadLints 检查所有修改的 TypeScript / TSX 文件
  - 请用户执行 `openspec validate "add-openspec-autonomous-completion-gate" --strict`
