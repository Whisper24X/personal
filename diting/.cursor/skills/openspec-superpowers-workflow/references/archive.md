# Archive

负责第四大阶段：最终制品检查、OpenSpec validate/archive、可选提交推送和完成声明。该阶段仅在平台明确调度归档或人工要求时执行，不属于编码 Agent 或质检 Agent 的默认职责。

## 输入

必须读取：

- `openspec/changes/<change-id>/workflow-state.md`
- `openspec/changes/<change-id>/tasks.md`
- `openspec/changes/<change-id>/proposal.md`
- `openspec/changes/<change-id>/design.md`
- `openspec/changes/<change-id>/plan.md`
- `openspec/changes/<change-id>/stage-reports/stage-3-verification-review.md`
- `artifacts/code-review-report.json`

## 进入闸门

阶段 3 未完成时不得归档。缺阶段 3 报告，或 `workflow-state.md` 未勾选 `phase-3-verification-review`、`phase-3-api-automation`、`phase-3-ui-automation`、`phase-3-code-review`、`phase-3-report` 时，停止并写入 `docs/feature/{{gitBranch}}/taskResult.md`。

还必须确认阶段 3 报告结论为允许归档；若存在 CRITICAL / IMPORTANT 未处理、基础验证失败、适用 API/UI 自动化失败，不得进入归档。

## 最终检查

确认：

- OpenSpec 制品完整。
- `tasks.md` 勾选与验证结论一致。
- 人工任务有明确 manual/human 标记。
- `stage-reports/` 包含阶段 1、2、3 报告。
- API/UI 自动化适用时，阶段 3 报告引用对应报告路径。
- `workflow-state.md` 以文件证据更新，不靠聊天摘要。
- `openspec/specs/<change-id>/spec.md` 的 Requirements / Scenarios 格式仍有效。
- `proposal.md`、`design.md`、`plan.md` 与最终实现没有明显冲突。
- 真实凭据、token、账号密码、生产环境敏感配置未进入 OpenSpec 制品、飞书附件或 git。

## Validate / Archive

标准模式由用户终端或 Diting 平台执行：

```bash
openspec validate "<change-id>" --strict
openspec archive "<change-id>" --yes
```

Agent 负责修复或说明格式问题。降级模式下人工检查 `spec.md` 的 Requirements 和 Scenario 格式，并在报告中注明未执行 CLI archive 的原因。

### Validate 失败处理

常见问题：

- `spec.md` 路径不在 `openspec/specs/<change-id>/spec.md`。
- 缺少 `## ADDED/MODIFIED/REMOVED/RENAMED Requirements` 标题。
- Requirement 缺少 `#### Scenario:`。
- Scenario 层级或格式错误。
- `tasks.md` 仍有未完成 autonomous task。

修复后重新请求用户或平台执行 validate。没有 validate 通过或人工等价检查通过，不得声明归档完成。

### Archive 执行

标准模式 archive 由用户终端或 Diting 平台执行。Agent 不假设 archive 成功，必须读取用户输出、平台结果或文件状态证据。

降级模式下不移动 OpenSpec 历史目录，只在阶段报告中声明“未执行 CLI archive，制品保留在 `openspec/changes/<change-id>/`，已完成人工格式检查”。

## Commit / Push

只有用户或任务明确要求时才 commit/push。提交信息必须遵守仓库 Conventional Commits 规范。

禁止：

- force push
- `git reset --hard`
- 回滚用户改动
- 未授权 commit/push

提交前必须检查 git status 和 diff，避免纳入无关用户改动或真实凭据。未明确要求时，只报告建议的提交范围，不执行 commit。

## 阶段报告

写入：

```text
openspec/changes/<change-id>/stage-reports/stage-4-archive.md
```

报告包含：

- 最终制品检查结果。
- `tasks.md` 状态和人工任务说明。
- `workflow-state.md` 状态。
- validate 结果或人工格式检查结论。
- archive 结果或降级说明。
- commit / push 状态。
- 残余风险和后续人工事项。

完成后勾选：

- `phase-4-archive`
- `phase-4-report`

## 完成声明

final 前必须重新读取 `workflow-state.md`：

- 全部 `[x]` 才能声称 workflow 完成。
- 仍有未完成项时，只报告进度、阻断和下一步。
- 若只是 `tasks.md` 全部完成但 `workflow-state.md` 未全勾选，只能声明实现任务完成，不能声明全流程完成。
