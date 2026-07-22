# Stage 5 — Code Review

## 输入

- Change: `add-failure-repair-orchestration`
- Reviewer: code-reviewer subagent

## 发现与处理

| 级别 | 问题 | 处理 |
|------|------|------|
| CRITICAL | 执行前 preflight 抛错后被 catch 记为 unknown | 新增 `PreflightBlockedError`，catch 直接 return |
| CRITICAL | workflow 不可 fallback 时 strategy 与终态不一致 | 改用 `kind: workflow_prompt` + `canFallback: false` → blocked |
| IMPORTANT | failureHash 与 repair goal 算法不一致 | execution/quality 路径复用 `buildFailureHash` |
| IMPORTANT | repair goal 与 repairPlan 字段略有不一致 | 保留现有 repair 文案生成（行为未变） |
| SUGGESTION | workflow skip 日志字段 | 补充 `fallbackMode` 到 failure detail |

## 结论

CRITICAL/IMPORTANT 已修复并复测通过；repairPlan 与 goal 完全对齐留作后续优化。
