# Stage 5 — Code Review

## 范围

- change-id: `refactor-task-lifecycle-model`
- 审查方式: code-reviewer subagent + 本地修复

## 结论摘要

| 级别 | 数量 | 处理 |
|------|------|------|
| CRITICAL | 3 | 部分修复（scheduler/services 统一 `resumeTask`）；claim 层仍待后续 |
| IMPORTANT | 8 | 已修复 `isTerminalTaskStatus`、`diagnose-task` waiting 判断；其余记入 Open Questions |
| SUGGESTION | 3 | 记录 |

## 已处理

- `service-scheduler.ts` / `services.syncHumanRepairIssue`：`waiting→ready` 改走 `resumeTask` 并清理 WaitReason
- `service-shared.isTerminalTaskStatus`：对齐 7 态
- `diagnose-task.ts`：`needs_human` → `waiting`

## 保留（Open Questions）

- 仓储 `claimQueued` 直接写 status，未暴露 `claimTask` 服务命令
- `legacy-migrate.ts` 未补 RunAttempt/WaitReason backfill
- AttemptStage 未覆盖 executing/completion_checking/creating_pr 全阶段
- Web 详情卡片未渲染 currentAttempt/waitReason 正文
- HTTP `/block`、`/needs-human` 仍可用（非 410）

## 测试回归

修复后 `services.spec.ts` 98/98 pass；全量 jest 301/306（plugins PR mock 5 失败见 stage-4）
