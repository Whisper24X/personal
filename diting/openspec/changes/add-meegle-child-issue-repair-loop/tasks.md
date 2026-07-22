# Tasks

- [x] 1. 扩展 plugin-api child repair issue 契约
  - 先在 `packages/core/src/titing/services.spec.ts` 写失败测试，证明 task-integration 可声明 `openHumanRepairIssue` 与 `pullHumanRepairIssues`
  - 在 `packages/plugin-api/src/titing/plugins.ts` 新增 `HumanRepairIssueRequest`、`HumanRepairIssueRef`、`HumanRepairIssueReply`
  - 扩展 `TaskIntegrationPlugin` 可选方法
  - 运行 `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "accepts task integrations with child repair issue capabilities"`

- [x] 2. 增加 child issue metadata 与门禁 helper
  - 先写失败测试覆盖 `【开发中】` 精确前缀与幂等键生成
  - 在 `packages/core/src/titing/service-shared.ts` 增加 `readReadyChildRepairDescription` 与 `buildChildRepairIssueIdempotencyKey`
  - 运行 `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "child repair"`

- [x] 3. 在 Meegle quality failed 时创建或复用子 issue
  - 先写失败测试覆盖首轮低风险 quality failed 且 `stopReason === null`
  - 修改 `packages/core/src/titing/service-execution.ts`，在自动 repair 前处理 Meegle child issue 分支
  - 父任务进入 `needs_human`，repair goal 进入 `needs_human`，不得写入 `goal.iteration_started`
  - 运行 `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "opens a Meegle child repair issue"`

- [x] 4. 实现 Meegle child issue fail-closed
  - 先写失败测试覆盖 `openHumanRepairIssue` 抛错、开发节点不可查、任务类型不可用
  - 修改 `packages/core/src/titing/service-execution.ts` 记录 `goal.child_issue_open_failed`
  - 确保 Meegle 父任务不得回到自动 repair
  - 运行 `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "fails closed when Meegle child repair issue creation is unavailable"`

- [x] 5. 增加显式同步子任务方案命令
  - 先写失败测试覆盖子任务描述未 ready 不恢复、ready 后恢复到 `queued`
  - 在 `packages/core/src/titing/services.ts` 暴露 `syncHumanRepairIssue`
  - 在 `packages/core/src/titing/service-scheduler.ts` 或等价 service 中实现单任务同步逻辑
  - 在 `packages/core/src/titing/task-command-service.ts` 增加 facade 方法
  - 运行 `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts -t "child repair issue description"`

- [x] 6. 增加 HTTP API
  - 先写失败测试覆盖 `POST /api/tasks/:id/sync-human-repair-issue` 成功与 409
  - 在 `apps/server/src/titing/server.ts` 增加命令端点
  - 对非法状态、非 Meegle 来源、缺少 childIssue metadata 返回 409
  - 运行 `npm run test -w apps/server -- apps/server/src/titing/server.spec.ts -t "child repair issue"`

- [x] 7. 实现 Meegle CLI 子任务 adapter
  - 先写 CLI fixture 测试覆盖创建、复用、查询、描述前缀门禁
  - 修改 `apps/server/src/titing/plugins/meegle.ts` 实现 `openHumanRepairIssue` 与 `pullHumanRepairIssues`
  - 修改 `apps/server/src/titing/plugins/shared.ts` 增加子任务 payload parser 与文案 builder
  - 运行 `npm run test -w apps/server -- apps/server/src/titing/plugins.spec.ts -t "child repair issue"`

- [x] 8. 实现 repair-only execution prompt
  - 先写失败测试证明 repair-only prompt 不包含完整父需求与完整 acceptance criteria
  - 修改 `apps/server/src/titing/plugins/execution.ts`，在 repair-only 模式替换 `taskPrompt` 与 `acceptanceCriteria`
  - 运行 `npm run test -w apps/server -- apps/server/src/titing/plugins.spec.ts -t "repair-only prompts"`

- [x] 9. 增加前端控制台按钮
  - 先写失败测试覆盖 `needs_human` 且有 child issue metadata 时显示 `检查子任务方案`
  - 修改 `apps/web/src/App.tsx`，增加 metadata 类型、按钮、API 调用与反馈文案
  - 点击后调用 `postJson("/tasks/${id}/sync-human-repair-issue")` 并刷新列表和详情
  - 运行 `npm run test -w apps/web -- src/App.spec.tsx -t "child issue sync"`

- [x] 10. 全量验证
  - 运行 `npm run test -w apps/server -- packages/core/src/titing/services.spec.ts apps/server/src/titing/server.spec.ts apps/server/src/titing/plugins.spec.ts`
  - 运行 `npm run test -w apps/web -- src/App.spec.tsx`
  - 运行 `npm run type-check`
  - 运行 `npm test`
  - 使用 ReadLints 检查所有修改的 TypeScript 文件
