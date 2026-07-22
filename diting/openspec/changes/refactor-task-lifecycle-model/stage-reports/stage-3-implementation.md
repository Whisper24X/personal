# Stage 3 — Implementation

## 完成 Tasks（1–6）

| 区块 | 关键产物 |
|------|----------|
| 1 契约 | `models.ts` 7 态 + RunAttempt/WaitReason；`state-machine.ts/spec.ts` |
| 2 命令 | `submitTask/pauseForWait/resumeTask/retryTask/reopenTask/releaseTask/completeTask/failTask` |
| 3 编排 | `ready→active` claim + RunAttempt；`service-execution` AttemptStage |
| 4 等待 | WaitReason 结构化；human/failure/repair 服务迁移 |
| 5 持久化 | `007_run_attempts.sql`、`008_task_lifecycle_status.sql`；claim SQL |
| 6 HTTP/UI | `/submit|/resume|/retry|/reopen`；Web 7 态筛选与 i18n |

## TDD 摘要

- **RED→GREEN**：`state-machine.spec.ts`（3 tests）、`services.spec.ts` lifecycle 命令与 attempt 测试（98 tests）、`failure-repair-service.spec.ts`（8 tests）
- **实现文件**：见 `packages/core`、`packages/plugin-api`、`apps/server`、`apps/web` 对应模块

## tasks.md

- 1.1–6.5 已全部勾选 `[x]`

## 例外 / 替代验证

- `claimQueued` 仍保留仓储名，SQL 已改为 `ready→active`（见 tasks 5.2 注释）
