---
name: improve-analyze
description: 读取 improveReviewResult.md（Markdown），整理排序后写入 improveAnalyzeResult.md（Markdown）。
---

# AnalyzeImprovementNeeds - 分析改进需求

读取 `improveReviewResult.md`（Markdown 结构化文档），筛选 `pending` 项并按优先级排序后写入 `improveAnalyzeResult.md`（同样为 Markdown 结构化文档），供 improve-execute 使用。

## 输出规范（强制）

> **重要**：分析结果必须写入文件，不是输出到终端。
> **禁止**输出裸 JSON。输入和输出均为 Markdown 结构化文档。

**文档路径**：输入/输出路径**必须**从节点 Prompt 获取（工作流 v2 ImproveCode）；示例：`docs/{{gitBranch}}/improveReviewResult.md`、`docs/{{gitBranch}}/improveAnalyzeResult.md`。

| 项目         | 规范                                                                               |
| ------------ | ---------------------------------------------------------------------------------- |
| **输入文件** | `docs/{{gitBranch}}/improveReviewResult.md`（improve-review 产出，Markdown） |
| **结果文件** | `docs/{{gitBranch}}/improveAnalyzeResult.md`（问题清单，Markdown） |
| **文件格式** | Markdown 结构化文档（`# 标题` + `## Summary` + `## Issues` + 分条 `### Issue N`）；须**原样保留**每条 issue 的全部字段（含 `requires_deep_debug`、`location` 等），勿丢弃 |
| **状态值**   | Summary 中 `**result**` 的值：`有待改进` / `无需改进` / `分析失败`（三选一） |

## 执行步骤

### 1. 读取输入文件

**读取 `docs/{{gitBranch}}/improveReviewResult.md`**：

- 该文件为 Markdown 结构化文档，含 `## Summary` 与 `## Issues` 两个主要章节
- 从 `## Issues` 下的各 `### Issue N` 小节中提取每条 issue 的字段（`- **字段名**: 值`）
- 必要字段：`id`、`title`、`priority`、`status`、`type`、`location`

**若文件不存在、缺少 `## Summary` / `## Issues`、或无法提取任何 issue**，输出 `分析失败` 并结束。

### 2. 解析与排序

- 将 `status` 为 `pending` 的项视为待改进
- 按优先级排序：high > medium > low；若 `requires_deep_debug` 为 `true` 的 issue 与同级并存，可将其排在同优先级内更前（可选，便于先处理难项）
- 若所有 issue 均无 `pending` 状态（或无 issue），result 设为 `无需改进`

### 3. 输出分析结果

将结果以 **Markdown 结构化格式** 写入 `docs/{{gitBranch}}/improveAnalyzeResult.md`。

**确保 `docs/{{gitBranch}}/` 目录存在**，不存在则先创建。

输出时对每条 issue **保留输入中的全部字段**，仅调整排序和更新顶层 Summary。

### 示例 - 有待改进

```markdown
# Improve Analyze Result

## Summary

- **result**: 有待改进
- **reason**: 发现 3 个待解决问题（1 high, 1 medium, 1 low）

## Issues

### Issue 1

- **id**: 1
- **title**: 登录失败时未显示错误提示
- **priority**: high
- **status**: pending
- **type**: bug
- **location**: src/auth/login.ts:40
- **requires_deep_debug**: false

### Issue 2

- **id**: 2
- **title**: 列表加载超过 3 秒
- **priority**: medium
- **status**: pending
- **type**: performance
- **location**: src/views/List.vue

### Issue 3

- **id**: 3
- **title**: 变量命名不规范
- **priority**: low
- **status**: pending
- **type**: quality
- **location**: src/utils/format.ts
```

### 示例 - 无需改进

```markdown
# Improve Analyze Result

## Summary

- **result**: 无需改进
- **reason**: Code Review 未发现待处理 issue

## Issues

（无）
```

### 示例 - 分析失败

```markdown
# Improve Analyze Result

## Summary

- **result**: 分析失败
- **reason**: improveReviewResult.md 不存在、无法解析或缺少 Issues 章节
```

## 重要提醒

1. **必须写入文件**：结果必须写入 `docs/{{gitBranch}}/improveAnalyzeResult.md`，不是输出到终端
2. **Markdown 结构严格**：必须包含 `#` 标题、`## Summary`、`## Issues`（或 `（无）`）；禁止输出裸 JSON
3. **确保目录存在**：如果 `docs/{{gitBranch}}/` 目录不存在，需要先创建
4. **不执行代码改进**：此 Skill 仅做整理与输出，不执行实际的代码修改（由 improve-execute 负责）
5. **每次覆盖写入**：每次执行都覆盖 `improveAnalyzeResult.md`（不是追加）
6. **字段贯通**：从 `improveReviewResult` 生成 `improveAnalyzeResult` 时，对每条 issue **保留输入中的全部字段**（含 `requires_deep_debug` 等），勿删除；后续由 improve-execute 在同一文件上追加 `root_cause_summary` / `evidence` / `resolution_note`
