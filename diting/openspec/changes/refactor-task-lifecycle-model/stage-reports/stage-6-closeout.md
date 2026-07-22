# Stage 6 — Closeout

## 制品完整性

```
openspec/changes/refactor-task-lifecycle-model/
  proposal.md design.md plan.md tasks.md workflow-state.md
  specs/{task-lifecycle,run-attempt,wait-reason,...}/spec.md
  stage-reports/stage-3-implementation.md … stage-6-closeout.md
  migrations: apps/server/.../007_run_attempts.sql, 008_task_lifecycle_status.sql
```

## validate / archive

- **openspec validate**：需用户在终端执行 `openspec validate "refactor-task-lifecycle-model" --strict`
- **archive**：需用户执行 `openspec archive "refactor-task-lifecycle-model" --yes`

## Git

- 未执行 commit/push（用户未明确要求）

## 假设与风险

- `validated` 存量数据在 SQL 迁移中保守映射为 `draft`，需业务侧 `submitTask()` 重新入队
- 其他活跃 OpenSpec change（7.5）尚未批量对齐旧状态名
- claim 路径仍经仓储原子更新，严格 spec 的 `claimTask` 服务命令待 follow-up
