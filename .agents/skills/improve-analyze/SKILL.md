---
name: improve-analyze
description: 读取 improveReviewResult.md，整理排序后写入 improveAnalyzeResult.md（JSON）。
---

# AnalyzeImprovementNeeds - 分析改进需求

读取 `improveReviewResult.md`（JSON），整理后写入 `improveAnalyzeResult.md`（JSON），供 improve-execute 使用。

## 输出规范（强制）

> **重要**：分析结果必须写入文件，不是输出到终端。

**文档路径**：输入/输出路径**必须**从节点 Prompt 获取（工作流 v2 ImproveCode）；示例：`docs/{{gitBranch}}/improveReviewResult.md`、`docs/{{gitBranch}}/improveAnalyzeResult.md`。

| 项目         | 规范                                                                               |
| ------------ | ---------------------------------------------------------------------------------- |
| **输入文件** | `docs/{{gitBranch}}/improveReviewResult.md`（improve-review 产出） |
| **结果文件** | `docs/{{gitBranch}}/improveAnalyzeResult.md`（问题清单，JSON）                                                |
| **文件格式** | JSON 格式，包含 result、reason、issues 字段                                        |
| **状态值**   | `有待改进` / `无需改进` / `分析失败`（三选一）                                     |

## 执行步骤

### 1. 读取输入文件

**读取 `docs/{{gitBranch}}/improveReviewResult.md`**：

- 须为合法 JSON，含 `issues` 数组（与 improve-review 约定一致）
- Code Review 问题含 title、priority、type、location 等

**若文件不存在、无法解析、或 `issues` 缺失**，输出 `分析失败` 并结束。

### 2. 解析与排序

- 将 `issues` 中 `status` 为 `pending` 的项视为待改进
- 按优先级排序：high > medium > low
- 若 `issues` 为空或全部为已处理（无非 pending），result 设为 `无需改进`

### 3. 输出分析结果

将结果以 JSON 格式写入 `docs/{{gitBranch}}/improveAnalyzeResult.md`。

**确保 `docs/{{gitBranch}}/` 目录存在**，不存在则先创建。

### 示例 - 有待改进

```json
{
  "result": "有待改进",
  "reason": "发现 3 个待解决问题（1 high, 1 medium, 1 low）",
  "issues": [
    { "id": 1, "title": "登录失败时未显示错误提示", "priority": "high", "status": "pending", "type": "bug" },
    { "id": 2, "title": "列表加载超过 3 秒", "priority": "medium", "status": "pending", "type": "performance" },
    { "id": 3, "title": "变量命名不规范", "priority": "low", "status": "pending", "type": "quality" }
  ]
}
```

### 示例 - 无需改进

```json
{
  "result": "无需改进",
  "reason": "Code Review 未发现待处理 issue",
  "issues": []
}
```

### 示例 - 分析失败

```json
{
  "result": "分析失败",
  "reason": "improveReviewResult.md 不存在、无法解析或缺少 issues"
}
```

## 重要提醒

1. **必须写入文件**：结果必须写入 `docs/{{gitBranch}}/improveAnalyzeResult.md`，不是输出到终端
2. **JSON 格式严格**：确保输出的是合法 JSON，可被程序解析
3. **确保目录存在**：如果 `docs/{{gitBranch}}/` 目录不存在，需要先创建
4. **不执行代码改进**：此 Skill 仅做整理与输出，不执行实际的代码修改（由 improve-execute 负责）
5. **每次覆盖写入**：每次执行都覆盖 `improveAnalyzeResult.md`（不是追加）
