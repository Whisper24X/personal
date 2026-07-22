---
name: ui-automation-repair
description: Use when ui-automation-master routes to UI automation Repair for pending issue analysis, minimal fixes, local verification, or final UI archive.
---

# UI Automation Repair

## 作用

把 `run` 阶段产出的可修复问题，转成最小修复并验证，但不越过 UI 重跑直接宣称完成。
这是子 skill 执行层，只在 `ui-automation-master` 路由到 `Repair` 时使用。

## 负责范围

- 转写 `Improve Review Bridge` -> `improveReviewResult.md`
- 生成 `improveAnalyzeResult.md`
- 进行根因分析
- 执行最小代码修复
- 写回 `resolution_note` / `root_cause_summary` / `evidence`
- 本地验证修复是否成立
- 把结果交回 `ui-automation-run` 做 UI 重跑和指标重算
- 保持 improve 链所需的结构化文件格式与字段贯通

## 核心约束

- 不直接跑 UI 自动化；UI 重跑必须交回 `ui-automation-master` 路由到 `ui-automation-run`
- 先做 `systematic-debugging` 的根因调查，再动代码
- 只修复一个根因，不做大范围重构
- `repair` 只做本地修复验证，不能把最终归档校验当成 UI 重跑前的最终通过
- 没有 `run` 的 UI 重跑证据时，不能宣布最终完成
- `repair` 是最终收口 / 归档的唯一责任方；`run` 只提供 UI 重跑证据和指标结果
- `improveReviewResult.md` / `improveAnalyzeResult.md` / `improveExecuteResult.md` / `improveVerifyResult.md` 的顺序不能断，这些文件都由 repair 直接生成
- bug/security/performance 类 issue 必须同时写 `resolution_note` 与 `root_cause_summary`

## 输入

- `testReview.md`
- `improveReviewResult.md`
- `improveAnalyzeResult.md`
- `improveExecuteResult.md`
- 必要时读取上一轮 `testExecutionReport.md` / `TEST-EXECUTION-RECORD.md`
- 系统调试参考：
  - `skills/ui-automation-repair/references/systematic-debugging.md`
  - `skills/ui-automation-repair/references/root-cause-tracing.md`
  - `skills/ui-automation-repair/references/condition-based-waiting.md`
  - `skills/ui-automation-repair/references/defense-in-depth.md`

## 必须继承的协议

- 分析阶段必须保留 pending issue 的全部字段并排序，写入 `improveAnalyzeResult.md`
- 执行阶段必须先做根因调查，再回写 `resolution_note` / `root_cause_summary` / `evidence`，写入 `improveExecuteResult.md`
- `improveExecuteResult.md` 必须显式写入状态标记 `本地修复完成，等待 run 重跑`
- 本地验证阶段必须校验是否还有 pending、代码质量、根因记录；若 UI 重跑证据尚未回来，只能给出“待 run 验证”的中间结论，写入 `improveVerifyResult.md`
- `improveVerifyResult.md` 必须显式写入状态标记 `待 run 验证`
- 当 `run` 返回通过且完成归档后，`improveVerifyResult.md` 必须更新为 `run 验证通过，归档完成`
- `systematic-debugging` 必须保留四阶段根因流程
- repair 不得绕过 run 的重跑证据直接收口
- improvement 文件顺序必须是 `improveReviewResult.md -> improveAnalyzeResult.md -> improveExecuteResult.md -> improveVerifyResult.md`
- 对 UI 自动化 FAIL 的修复必须给出可直接交给 run 的 rerun scope

## 输出

- `improveReviewResult.md`
- `improveAnalyzeResult.md`
- `improveExecuteResult.md`
- `improveVerifyResult.md`
- 修复后的代码
- 本地验证结论
- 若全部完成，后续由 `ui-automation-run` 的重跑通过结果触发 `repair` 的最终收口 / 归档，不在 repair 中擅自删除

## 流程

1. 读取 bridge / review
2. 生成 `improveReviewResult.md` 并保留完整章节结构
3. 基于 review 直接完成分析，生成 `improveAnalyzeResult.md`
4. 对 bug / security / performance 先走 `systematic-debugging`
5. 基于根因分析直接做最小修复并回写根因字段，生成/更新 `improveExecuteResult.md`
6. 运行本地验证（单测、lint、静态检查，必要时补最小回归），生成/更新 `improveVerifyResult.md`，先写入 `待 run 验证`
7. 本地验证通过后，把任务交回 `ui-automation-run`
8. 等待 `run` 的 UI 重跑和指标结果
9. 只有当 `run` 返回通过，才做最终收口 / 归档：重新读取 `testExecutionResult.md`、`uiAutomationMetrics.json`、`testReview.md`、`improveVerifyResult.md`，确认 rerun scope 已覆盖且没有新的 pending repair 事项，然后把 `improveVerifyResult.md` 更新为 `run 验证通过，归档完成` 并归档历史文件
10. 完成后交回 `ui-automation-master` 判断 UI 自动化是否收口完成

