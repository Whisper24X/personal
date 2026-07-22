# Tasks

- [x] 1. 新增失败修复编排模型与纯函数
  - 在 `packages/core/src/diting/failure-repair-service.ts` 或 `service-shared.ts` 定义 `FailureKind`、`FailureRepairStrategy`、`FailureRepairDecision`
  - 编写失败测试覆盖 strategy 分流、failure hash、repair plan 生成、history 最近 10 条裁剪
  - 实现 `recordFailure` 所需的 metadata 构造与日志 payload 构造
  - 明确 retryable execution failure 与可自动修复 execution failure 的分类规则
  - 运行相关 core 单测

- [x] 2. 接入 quality failed 与 Meegle 子 issue 路径
  - 先在 `packages/core/src/diting/services.spec.ts` 写失败测试，证明 quality failed 写入 `metadata.failureRepair.lastFailure`
  - 确保普通 quality failed 仍进入 repair loop
  - 确保 Meegle quality failed 仍优先进入 child repair issue 闭环，并同时保留统一失败记录
  - 运行 `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts -t "failure repair"`

- [x] 3. 接入 completion gate failed
  - 写失败测试覆盖 completion gate failed 写 `failure.recorded` 与 `failure.auto_repair_invoked`
  - 保持 completion gate failed 不创建 `EvalResult`
  - 保持 repair goal metadata 中 `repairSource: "completion-gate"`
  - 运行 completion gate 相关 services 单测

- [x] 4. 接入 execution failed 与无 quality repair
  - 写失败测试覆盖无 quality 时 execution failed 生成统一 failure repair metadata
  - 写失败测试覆盖 retryable execution failure 先遵循 retry policy，且不会立即创建 repair goal
  - 写失败测试覆盖重试预算耗尽后按失败性质进入 `blocked` 或 `auto_repair`
  - 实现 stdout/stderr/errorCategory/timeoutCategory 摘要进入 failure detail
  - 运行 execution retry 相关 services 单测

- [x] 5. 修改 workflow prompt failed 为记录并跳过
  - 写失败测试证明 workflow prompt failed 不再使任务进入 `failed` 或 `blocked`
  - 记录 `failure.workflow_prompt_skipped` 和 `strategy: "skip_with_record"`
  - fallback 到内置默认 workflow 或无 workflow 模式继续执行
  - 如果无法安全 fallback，必须把终止原因重新归类为 `execution` 或 `unknown`
  - 如果 fallback 后执行仍失败，按普通 execution failure 处理
  - 更新既有 “workflow prompts are missing or invalid” 测试预期

- [x] 6. 接入 environment、preflight、pull request 和 unknown exception
  - environment/preflight failed 写统一失败信息并保持 `blocked`
  - 覆盖入队前 preflight 与执行前 preflight；无 execution 时 `executionId` 为 `null`
  - pull request failed 写统一失败信息并进入 `needs_human` 或 `blocked`
  - unknown exception 写统一失败信息并进入 `needs_human`
  - 更新 `state-machine.ts` 和 `state-machine.spec.ts`，补齐 `running -> needs_human`、`evaluating -> blocked`、`repairing -> blocked` 等合法迁移
  - 所有路径必须通过状态机迁移，不得因缺少迁移静默降级为 `failed`
  - 运行相关 services/server 单测

- [x] 7. 更新观测输出与前端兼容
  - 确认 `GET /api/tasks/:id/observability` 可返回 task metadata 中的 `failureRepair` 或兼容的顶层 `failureRepair` 摘要字段
  - 如前端已有任务详情 metadata 展示，补充可读字段；否则只保证 API 不破坏现有响应
  - 写测试覆盖 `failure.*` 日志映射或 metadata 可见性

- [x] 8. 全量验证
  - 运行 `npm run test -w apps/server -- packages/core/src/diting/services.spec.ts packages/core/src/diting/run-observability.spec.ts`
  - 运行 `npm run test -w apps/web -- src/App.spec.tsx`
  - 运行 `npm run type-check`
  - 运行 `npm test`
  - 请用户在终端执行 `openspec validate "add-failure-repair-orchestration" --strict`
