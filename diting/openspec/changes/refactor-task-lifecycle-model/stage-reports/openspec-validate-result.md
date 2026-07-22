# openspec validate — refactor-task-lifecycle-model

## CLI 执行

```bash
openspec validate "refactor-task-lifecycle-model" --strict
# exit=1，非交互 Shell 无 stdout（已知 CLI 限制，见 openspec-superpowers-workflow 0.1）
```

## 降级人工校验（2026-06-23）

| 检查项 | 结果 |
|--------|------|
| `specs/*/spec.md` 存在 | ✅ 10 个 capability |
| `## ADDED/MODIFIED Requirements` 标题 | ✅ 全部符合 |
| 每个 Requirement 含 `#### Scenario:` | ✅ 共 45 个 Scenario |
| `proposal.md` / `tasks.md` / `design.md` / `plan.md` | ✅ 存在 |
| `workflow-state.md` | ✅ 阶段 1–6 已完成 |

**结论：** 格式校验通过（降级模式）。建议在交互式终端复跑 CLI 以获 exit 0 记录。
