## 1. Agent kind 与调度基础

- [x] 1.1 为 `agentKind=quality` 默认 `driverId=quality-orchestrator`、`runtimeProviderId=codex/cursor` 写失败测试。
- [x] 1.2 实现 `normalizeAgentRequest` 的 quality 默认 driver/runtime 推断。
- [x] 1.3 为 `quality-agent-*` 只 claim `agentKind=quality` 的 ready task 写失败测试。
- [x] 1.4 扩展 worker pool supported agent kinds，保留 programming legacy 兼容。

## 2. Handoff schema 与 artifact 持久化

- [x] 2.1 新增 `quality-handoff.ts` 与单测，覆盖 implementation handoff、repair handoff 和必填字段。
- [x] 2.2 实现 repo anchor schema：每个 repo 必须包含 `key/url/path/baseSha/headSha`。
- [x] 2.3 实现 `validateHandoffAnchors`，覆盖空 repos、repo 缺失、URL/path 不一致、base/head commit 缺失或不一致 fail closed。
- [x] 2.4 新增 `quality-artifacts.ts` 与单测，覆盖四类 artifact 写入：implementation handoff、quality report、quality repair handoff、code review report。

## 3. Programming -> Quality handoff

- [x] 3.1 写失败测试：编程成功后不直接跑 quality，而是写 `artifacts/implementation-handoff.json`。
- [x] 3.2 实现 programming success 分支写 `implementationHandoff`、`implementationHandoffPath`。
- [x] 3.3 通过状态迁移审计将 task 从 `active(programming)` 切到 `ready(quality)`。
- [x] 3.4 记录 `programming.completed_for_quality` log/event，并确保不调用 `QualityPlugin.evaluate`。

## 4. Quality orchestration pass 与 fail closed

- [x] 4.1 写失败测试：quality task 执行 completion gate、`QualityPlugin.evaluate`、写 `quality-report.json` 后转 `succeeded`。
- [x] 4.2 实现 `isQualityOrchestrationTask` 与 `runQualityOrchestration` skeleton。
- [x] 4.3 写失败测试：handoff 缺失、空 repos、repo anchor 不一致、workspace commit 缺失时进入 `waiting`。
- [x] 4.4 写失败测试：必需 artifact 写入失败时进入 `waiting`。
- [x] 4.5 实现 quality fail closed 分支，确保不调用 completion gate 或 quality plugin，并记录 `quality.fail_closed`。

## 5. API/UI evidence 与 code review gate

- [x] 5.1 新增 `quality-evidence.ts` 与单测，覆盖 API/UI evidence pass、N/A、missing evidence。
- [x] 5.2 覆盖 code review CRITICAL/IMPORTANT finding 阻断。
- [x] 5.3 覆盖 `code-review-report.json` 缺失时 fail closed。
- [x] 5.4 在 quality orchestration 中执行只读 review runtime，写 `artifacts/code-review-report.json`。
- [x] 5.5 将 review artifact path/id 写入 `quality-report.json` 与 repair handoff。

## 6. Quality failure -> Programming repair handoff

- [x] 6.1 写失败测试：quality failure 写 `quality-report.json` 和 `quality-repair-handoff.json`。
- [x] 6.2 复用 FailureRepairService / `repair_goals` 记录 failure，避免第二套 repair 协议。
- [x] 6.3 未达到停止条件时通过 transition 审计切回 `ready(programming)`。
- [ ] 6.4 覆盖 budget limited -> `failed`、repeated failure / no effective diff 不回到 programming。
- [ ] 6.5 覆盖 Meegle child repair issue 可用时仍写现有 `failureRepair` metadata。

## 7. Quality runtime provider 与插件装配

- [x] 7.1 为 `selectAgentPluginForTask` 选择 `quality-orchestrator` 写 runtime selection 测试。
- [x] 7.2 注册 Codex/Cursor quality orchestrator agent plugin，能力包含 `quality`、`review` 和 runtime provider。
- [x] 7.3 更新 server plugin assembly 测试，确保 quality orchestrator agent plugin 存在。

## 8. Observability 与 diagnose

- [x] 8.1 为 `programming.completed_for_quality`、`quality.started`、`quality.passed`、`quality.failed_for_repair`、`repair.returned_to_programming` 写 observability 测试。
- [x] 8.2 实现 quality / repair stage 事件映射。
- [x] 8.3 更新 diagnose 输出，展示 `implementationHandoffPath`、`qualityReportPath`、`qualityRepairHandoffPath`。

## 9. 文档与验证

- [x] 9.1 更新 `docs/architecture/diting-technical-design.md` 中 Agent kind 与 Quality Evaluation 边界。
- [x] 9.2 更新 `docs/architecture/diting-open-tasks.md` 的质量闭环状态。
- [x] 9.3 运行聚焦测试：`npm run test -w apps/server -- packages/core/src/diting/quality-handoff.spec.ts packages/core/src/diting/quality-artifacts.spec.ts packages/core/src/diting/quality-evidence.spec.ts packages/core/src/diting/plugin-runtime.spec.ts packages/core/src/diting/run-observability.spec.ts packages/core/src/diting/services.spec.ts apps/server/src/diting/plugins.spec.ts apps/server/src/diting/diagnose-task.spec.ts --runInBand`。
- [ ] 9.4 运行全量验证：`npm test -- --runInBand`、`npm run type-check`、`npm run build`。
