---
name: improve-analyze
description: 分析代码改进需求。读取 ImproveCode.md 和 improveReviewResult.md，合并排序后输出改进任务描述。无状态分析工具，由 ImproveCode Action 调用。
---

# AnalyzeImprovementNeeds - 分析改进需求

读取 `docs/code/ImproveCode.md`（用户/QA 问题）和 `docs/code/improveReviewResult.md`（Code Review 发现），合并去重后按优先级排序，为 improve-execute 提供结构化的任务描述。

## 输出规范（强制）

> **重要**：分析结果必须写入文件，不是输出到终端。

| 项目         | 规范                                                                               |
| ------------ | ---------------------------------------------------------------------------------- |
| **输入文件** | `docs/code/ImproveCode.md`（可选，用户/QA 问题）                                   |
| **输入文件** | `docs/code/improveReviewResult.md`（可选，Code Review 发现）                       |
| **结果文件** | `docs/code/improveAnalyzeResult.md`                                                |
| **更新文件** | `docs/code/ImproveCode.md`（写入合并后的完整问题列表，供 improve-execute 标记 ✅） |
| **文件格式** | JSON 格式，包含 result、reason、issues 字段                                        |
| **状态值**   | `有待改进` / `无需改进` / `分析失败`（三选一）                                     |

## 执行步骤

### 1. 读取输入文件

**读取 `docs/code/ImproveCode.md`**（若存在），获取：

- QA 测试报告中的 Bug 清单
- 用户提交的改进建议
- 性能优化需求
- 代码质量改进项

**读取 `docs/code/improveReviewResult.md`**（若存在），获取：

- Code Review 发现的问题（SOLID、安全、质量、移除候选）
- 每项包含 title、priority、type、location

**若两个文件都不存在或都为空**，输出 `分析失败` 并结束。

### 2. 解析与合并问题清单

**从 ImproveCode.md 解析**（若存在）：

| 标记               | 状态   | 说明                 |
| ------------------ | ------ | -------------------- |
| 包含 `✅ 已解决`   | 已解决 | 之前的改进循环已修复 |
| 不包含 `✅ 已解决` | 待解决 | 需要本次改进处理     |

**从 improveReviewResult.md 解析**（若存在）：

- 所有 issues 的 status 均为 `pending`（待解决）
- priority 已为 high/medium/low

**合并与去重**：

- 将两个来源的问题合并为统一列表
- 去重规则：若 title + location 相同，视为同一问题，保留一条
- 统一优先级：high > medium > low

**类型与优先级映射**（ImproveCode.md 中的问题）：

| 类型            | 优先级 | 说明                 |
| --------------- | ------ | -------------------- |
| 功能缺陷（Bug） | high   | 影响核心功能的错误   |
| 运行时错误      | high   | 导致崩溃或异常的问题 |
| 性能问题        | medium | 响应慢、资源占用高   |
| 用户体验问题    | medium | 交互不合理、界面问题 |
| 代码质量        | low    | 可读性、可维护性改进 |
| 代码规范        | low    | 编码风格、最佳实践   |

### 3. 选择待解决问题

- 过滤出所有状态为"待解决"的问题
- 按优先级排序：high > medium > low
- 如果合并后无待解决问题，result 设为 `无需改进`

### 4. 输出分析结果

将结果以 JSON 格式写入 `docs/code/improveAnalyzeResult.md`。

**确保 `docs/code/` 目录存在**，不存在则先创建。

### 5. 更新 ImproveCode.md（重要）

将**合并后的完整问题列表**写入 `docs/code/ImproveCode.md`，采用以下 Markdown 格式，供 improve-execute 读取并标记 ✅：

```markdown
# 代码改进需求

## 问题 1: [标题]

- 类型: [bug|performance|quality|security|solid|...]
- 位置: [文件路径:行号]（若有）
- 描述: ...

## 问题 2: [标题]

...
```

- 若 ImproveCode.md 不存在，则创建
- 若已存在，则覆盖为合并后的列表
- improve-execute 依赖此文件标记 `✅ 已解决`

### 示例 - 有待改进

```json
{
  "result": "有待改进",
  "reason": "发现 3 个待解决问题（1 high, 1 medium, 1 low），2 个已解决",
  "issues": [
    { "id": 1, "title": "登录失败时未显示错误提示", "priority": "high", "status": "pending", "type": "bug" },
    { "id": 2, "title": "列表加载超过 3 秒", "priority": "medium", "status": "pending", "type": "performance" },
    { "id": 3, "title": "变量命名不规范", "priority": "low", "status": "pending", "type": "quality" },
    { "id": 4, "title": "按钮样式不一致", "priority": "low", "status": "resolved", "type": "ux" },
    { "id": 5, "title": "接口超时未提示用户", "priority": "medium", "status": "resolved", "type": "bug" }
  ]
}
```

### 示例 - 无需改进

```json
{
  "result": "无需改进",
  "reason": "所有 5 个问题已标记为 ✅ 已解决",
  "issues": [
    { "id": 1, "title": "登录失败处理不正确", "priority": "high", "status": "resolved", "type": "bug" },
    { "id": 2, "title": "列表分页性能差", "priority": "medium", "status": "resolved", "type": "performance" }
  ]
}
```

### 示例 - 分析失败

```json
{
  "result": "分析失败",
  "reason": "ImproveCode.md 和 improveReviewResult.md 均不存在或内容为空"
}
```

## 重要提醒

1. **必须写入文件**：结果必须写入 `docs/code/improveAnalyzeResult.md`，不是输出到终端
2. **必须更新 ImproveCode.md**：将合并后的问题列表写入 ImproveCode.md，供 improve-execute 标记 ✅
3. **JSON 格式严格**：确保输出的是合法 JSON，可被程序解析
4. **确保目录存在**：如果 `docs/code/` 目录不存在，需要先创建
5. **不执行代码改进**：此 Skill 仅做分析和合并，不执行实际的代码修改（由 improve-execute 负责）
6. **每次覆盖写入**：每次执行都覆盖 `improveAnalyzeResult.md` 和 `ImproveCode.md`（不是追加）
