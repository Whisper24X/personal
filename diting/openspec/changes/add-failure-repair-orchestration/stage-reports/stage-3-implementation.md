# Stage 3 — Implementation

## 完成项

| Task | 测试 | 实现 |
|------|------|------|
| 1 模型与纯函数 | `failure-repair-service.spec.ts` | `failure-repair-service.ts` |
| 2–6 执行链路接入 | `services.spec.ts` (`failure repair` + workflow fallback) | `service-execution.ts`, `service-support.ts`, `services.ts`, `state-machine.ts` |
| 7 观测 | `run-observability.spec.ts`, `services.spec.ts` | `run-observability.ts`, `getTaskObservability` |

## TDD 摘要

- RED：`failure-repair-service.spec.ts` 与 `services.spec.ts` 新增失败路径测试先行编写
- GREEN：实现 `FailureRepairService` 纯函数、`ServiceSupport.recordFailureRepair` 与各失败分支接入
- REFACTOR：抽取 `resolveFailureTerminalStatus`，状态机补齐 `needs_human` / `blocked` 迁移

## 关键行为

- 所有失败写入 `task.metadata.failureRepair`（含 `lastFailure`、`repairPlan`、`strategy`、`history`≤10）
- 结构化日志：`failure.recorded`、`failure.repair_plan_created`、`failure.auto_repair_invoked`、`failure.workflow_prompt_skipped`、`failure.blocked`、`failure.needs_human`
- workflow prompt 可 fallback 时 `skip_with_record` 并重跑 execution；不可 fallback 时按 execution/needs_human|blocked 终止
- preflight 双入口（queue + before environment）均记录且 `executionId: null`
- unknown exception 优先 `needs_human`（`repairing -> needs_human` 等）

## tasks.md

全部 8 项已勾选 `[x]`。
