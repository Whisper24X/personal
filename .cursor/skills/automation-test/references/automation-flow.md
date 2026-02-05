# 自动化测试四步流程说明

本文档描述 AutomationEngineer 四步流程的输入、输出与文件路径，供 [SKILL.md](../SKILL.md) 引用。

## 流程总览

```
TEST.md / TEST_REVIEW.md
        |
        v
+-------------------+     auto/*.ts（仅通过 Stagehand 验证的用例）
| AutomationPlanning| --> (docs/test/auto/)
+-------------------+     不产出 AUTOMATION_PLAN.md
        |
        v
+---------------------+   执行报告
| AutomationExecution |
+---------------------+
        |
        v
+------------------------+  覆盖率与质量自检（仅内存/API，不落盘）
| CoverageQualityCheck   |
+------------------------+
        |
        v
+---------------+   QA 结论（仅内存/API，不落盘）
| QAConclusion  |
+---------------+
```

## 每步输入输出

| 步骤 | Action               | 输入                                                  | 输出文件/产物                                                      |
| ---- | -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| 1    | AutomationPlanning   | docs/test/TEST.md 或 TEST_REVIEW.md、workspace 内代码 | docs/test/auto/\*.ts（Stagehand 脚本，仅可自动化且通过验证的用例） |
| 2    | AutomationExecution  | docs/test/auto/\*.ts                                  | 执行报告（控制台与后端保存路径见实现）                             |
| 3    | CoverageQualityCheck | 测试用例文档、执行结果                                | 覆盖率与质量自检（返回 content/data，不写入文件）                  |
| 4    | QAConclusion         | 上述所有产出                                          | 最终 QA 结论（返回 content/data，不写入文件）                      |

## 文件路径约定（workspace 内）

- 基础目录：`{workspace}/ainative-workspace/docs/test/`
- Stagehand 脚本：`docs/test/auto/<用例相关>.ts`（必须且仅使用 Stagehand 框架，由 AutomationPlanning 统一生成）

上述路径相对于当前版本 workspace 根目录。AUTOMATION_PLAN.md、COVERAGE_REPORT.md、QUALITY_CHECK.md、QA_CONCLUSION.md 已不再写入。
