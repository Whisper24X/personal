---
name: automation-test
description: 当用户或工作流需要自动化测试规划、自动化脚本生成、自动化执行、覆盖率与质量检查或 QA 结论时使用此 skill。指导 Agent 何时触发、如何配合后端 AutomationEngineer 四步流程。
---

# 自动化测试流程与规范

基于 TEST.md（或 TEST_REVIEW.md）执行自动化测试规划、脚本生成、执行、覆盖率检查与 QA 结论，由后端 AutomationEngineer 角色按固定四步顺序执行。

## 执行前必读（强制）

**前置条件**：

1. **TEST.md 已存在**：自动化测试以测试用例文档为输入，必须先有 `docs/test/TEST.md`（由 test skill 或 WriteTest 生成）。若有 `TEST_REVIEW.md`，后端会优先使用评审后的版本。
2. **执行主体**：自动化测试由后端 **AutomationEngineer** 四步流程执行，本 skill 用于指导 Agent 何时触发、如何配合、如何回答用户关于自动化测试的问题。
3. **触发方式**：工作流在 QAEngineer 完成 TestReview 后自动触发 AutomationEngineer；或通过 API 调用对应角色/动作执行。Agent 若在对话中被要求“做自动化测试”，应说明需通过工作流或 API 执行，并确认 TEST.md 已就绪。

## 自动化测试流程（四步顺序）

| 步骤   | 动作                 | 输入                     | 输出                                                 |
| ------ | -------------------- | ------------------------ | ---------------------------------------------------- |
| Step 1 | AutomationPlanning   | TEST.md / TEST_REVIEW.md | `auto/*.ts`（仅对通过 Stagehand 验证的用例生成脚本） |
| Step 2 | AutomationExecution  | auto/\*.ts 脚本          | 执行报告（通过/失败、日志）                          |
| Step 3 | CoverageQualityCheck | 测试用例与执行结果       | 覆盖率与质量自检（仅内存/API，不落盘）               |
| Step 4 | QAConclusion         | 上述所有产出             | 通过 / 阻断 / 需修改 结论（仅内存/API，不落盘）      |

流程不可跳步、不可逆序；由 AutomationEngineer 在单次运行中依次执行上述四步。

## 与工作流的衔接

- **自动触发**：工作流配置中，在 TestReview 完成后会触发 AutomationEngineer，无需手动传入测试用例内容；后端从当前 workspace 的 `docs/test/` 下读取 TEST.md（或 TEST_REVIEW.md）。
- **API 触发**：可通过项目/版本维度的 API 触发工作流或单独执行 AutomationPlanning 等动作，需携带正确的 applicationId、projectId、versionId（或等价 workspace 信息）。
- **Agent 指引**：当用户问“如何做自动化测试”或“自动化测试流程”时，Agent 应依据本 skill 回答前置条件（TEST.md 已就绪）、四步流程与产物位置，并提示通过工作流或 API 执行。

## 输出与位置

脚本类产出在当前版本 workspace 的 **docs/test/** 目录下（与 TEST.md 同目录）：

| 产出           | 路径/说明                                                              |
| -------------- | ---------------------------------------------------------------------- |
| Stagehand 脚本 | `auto/*.ts`（仅对通过 Stagehand 验证的用例生成，每个用例一个脚本文件） |
| 执行报告       | 由 AutomationExecution 写入，具体文件名见后端实现                      |

覆盖率与质量自检、QA 结论由 CoverageQualityCheck / QAConclusion 在内存中生成并随 API 返回，不再写入 COVERAGE_REPORT.md、QUALITY_CHECK.md、QA_CONCLUSION.md。

**脚本规范**：`auto/*.ts` 必须且仅使用 Stagehand 自动化测试框架编写，由 AutomationPlanning 统一生成，不得手写非 Stagehand 实现。

## 注意事项

- **ENABLE_BROWSER**：若需使用 Stagehand 生成/执行浏览器自动化脚本，需设置环境变量 `ENABLE_BROWSER=true`，并确保运行环境具备浏览器与 Stagehand 依赖。
- **Stagehand**：Step 1 在启用 Stagehand 时会从 TEST.md 解析用例、用 Stagehand 验证第一步可行性，仅对通过验证的用例生成 `auto/*.ts`；脚本必须且仅使用 Stagehand 框架。若未启用或验证失败，不生成脚本。
- **其他角色与 action**：本 skill 仅描述自动化测试流程，不改变 WriteTest、TestReview、Engineer 等其它角色与动作的行为；自动化测试与功能测试用例编写（test skill）互为上下游，不互相覆盖。

## 参考

- 四步流程与每步输入输出的详细列表见 [automation-flow.md](references/automation-flow.md)。
