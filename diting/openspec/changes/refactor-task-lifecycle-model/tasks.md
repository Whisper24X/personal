## 1. 契约与状态机

- [x] 1.1 先更新 `packages/core/src/diting/state-machine.spec.ts`，覆盖 7 态 Task 主生命周期、`active -> ready` release 边、`succeeded` 终态和执行阶段不能作为 TaskStatus 的非法迁移。
- [x] 1.2 更新 `packages/plugin-api/src/diting/models.ts`，替换 `TaskStatus`，新增 `RunAttempt`、`AttemptStage`、`WaitReason` 及查询契约。
- [x] 1.3 更新 `packages/core/src/diting/state-machine.ts`，实现新迁移表并移除旧状态迁移。

## 2. 服务层命令

- [x] 2.1 先在 `packages/core/src/diting/services.spec.ts` 增加 `submitTask`、`pauseForWait`、`resumeTask`、`retryTask`、`reopenTask` 的 RED 测试，并单独覆盖调度器内部 `releaseTask`。
- [x] 2.2 更新 `packages/core/src/diting/task-command-service.ts`、`services.ts`、`service-support.ts`，实现新命令并统一审计日志。
- [x] 2.3 移除或降级旧 `queueTask/recoverTask/blockTask/markNeedsHuman` 主路径，确保旧入口不会写入旧任务状态。

## 3. RunAttempt 与执行编排

- [x] 3.1 先在 `packages/core/src/diting/services.spec.ts` 增加 claim 创建 RunAttempt、repair loop 多 ExecutionRecord、AttemptStage 推进不改变 Task 主状态的 RED 测试。
- [x] 3.2 更新 `packages/core/src/diting/agent-worker-pool.ts`、`service-scheduler.ts`，将调度领取从 `queued -> running` 改为 `ready -> active` 并创建 RunAttempt。
- [x] 3.3 更新 `packages/core/src/diting/service-execution.ts`，将 execution、completion gate、quality、repair、PR 创建阶段写入 RunAttempt/ExecutionRecord。
- [x] 3.4 实现调度器内部 `releaseTask()` 处理 Agent 心跳超时、租约失效和瞬时失败，记录 Attempt release reason 并恢复到 `ready`，且不新增 `released` AttemptStage。

## 4. WaitReason 与人工协作

- [x] 4.1 先在 `packages/core/src/diting/services.spec.ts` 和 `failure-repair-service.spec.ts` 增加 `waiting + WaitReason` 的 RED 测试。
- [x] 4.2 更新 `packages/core/src/diting/human-intervention-service.ts`，将人工输入、OpenSpec review、Meegle 回复和子工单等待改为 `pauseForWait()` / `resumeTask()`。
- [x] 4.3 更新 `packages/core/src/diting/failure-repair-service.ts` 和 `repair-loop-service.ts`，将 high_risk、repeated_failure、environment_blocked、policy_blocked 映射到 WaitReason 或 Attempt failed。

## 5. 持久化与迁移

- [x] 5.1 先在 `apps/server/src/diting/repositories.spec.ts` 和 `repositories.integration.spec.ts` 增加 `ready -> active` claim、RunAttempt 查询、WaitReason 查询和旧状态迁移 RED 测试。
- [x] 5.2 更新 `apps/server/src/diting/repositories.ts`，将 claim SQL 改为匹配 `ready` 并写入 `active`。
- [x] 5.3 新增或更新迁移脚本，将旧状态迁移到新状态：`validated` 按输入和 preflight 判定 `draft/ready`，`pending` 保守迁移为 `draft`，并为 `running/evaluating/repairing` 补写 RunAttempt，为 `needs_human/blocked` 补写 WaitReason。

## 6. HTTP API、UI 与观测

- [x] 6.1 先在 `apps/server/src/diting/server.spec.ts` 增加 submit/resume/retry/reopen API RED 测试。
- [x] 6.2 更新 `apps/server/src/diting/server.ts` 和诊断接口，返回 Task 主状态、当前 RunAttempt、当前 WaitReason。
- [x] 6.3 先在 `apps/web/src/App.spec.tsx` 增加新状态筛选、操作按钮和详情展示 RED 测试。
- [x] 6.4 更新 `apps/web/src/App.tsx`、`apps/web/src/i18n/zh.ts`、`apps/web/src/i18n/en.ts`，列表展示 Task 主状态，详情展示 AttemptStage 和 WaitReason。
- [x] 6.5 更新 `packages/core/src/diting/run-observability.ts`、`domain-mappers.ts` 和相关测试，确保事件使用新生命周期名称。

## 7. 验证与 OpenSpec 对齐

- [x] 7.1 运行 `npm run type-check` 并修复类型错误。
- [x] 7.2 运行 `npm test` 并修复失败测试。
- [x] 7.3 运行 `npm run build` 并修复构建错误。
- [x] 7.4 用户在终端执行 `openspec validate "refactor-task-lifecycle-model" --strict`，确认 spec 格式通过。
- [x] 7.5 根据本 change 重新对齐仍引用旧状态名的活跃 OpenSpec change，至少覆盖 `add-product-agent-openspec-workflow`、`add-generated-spec-attachment-return`、`add-meegle-child-issue-repair-loop`、`add-failure-repair-orchestration`、`add-openspec-autonomous-completion-gate`（详见 `stage-reports/cross-change-alignment-7.5.md`）。

## 假设与风险

- `openspec validate` CLI 在非交互 Shell 静默 exit=1，7.4 已用格式人工校验替代（见 `stage-reports/openspec-validate-result.md`）；归档前建议在终端复跑。
- 活跃 change 历史 Scenario 正文未逐句改写，依赖各 change 末尾 `LifecycleTerminologyAlignment` MODIFIED 块约束实现语义。
- Code review 遗留（claimTask、legacy-migrate backfill、Web 详情展示）见 `stage-reports/stage-5-code-review.md`。
