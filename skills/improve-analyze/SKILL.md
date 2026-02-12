---
name: improve-analyze
description: 分析代码改进需求。读取 ImproveCode.md，解析问题清单和优先级，区分已解决和待解决问题，输出改进任务描述。无状态分析工具，由 ImproveCode Action 调用。触发场景：(1) 改进需求分析 (2) 问题优先级排序 (3) 改进任务规划
---

# AnalyzeImprovementNeeds - 分析改进需求

读取 `docs/code/ImproveCode.md` 文件，解析其中的问题清单，识别优先级和解决状态，为后续的代码改进执行提供结构化的任务描述。

## 输出规范（强制）

> **重要**：分析结果必须写入文件，不是输出到终端。

| 项目         | 规范                                           |
| ------------ | ---------------------------------------------- |
| **输入文件** | `docs/code/ImproveCode.md`（必须存在）         |
| **结果文件** | `docs/code/improveAnalyzeResult.md`            |
| **文件格式** | JSON 格式，包含 result、reason、issues 字段    |
| **状态值**   | `有待改进` / `无需改进` / `分析失败`（三选一） |

## 执行步骤

### 1. 读取改进文件

读取 `docs/code/ImproveCode.md` 文件，获取：

- QA 测试报告中的 Bug 清单
- 用户提交的改进建议
- 性能优化需求
- 代码质量改进项

如果文件不存在，输出 `分析失败` 并结束。

### 2. 解析问题清单

逐条分析文件中的问题描述：

**问题状态识别**：

| 标记               | 状态   | 说明                 |
| ------------------ | ------ | -------------------- |
| 包含 `✅ 已解决`   | 已解决 | 之前的改进循环已修复 |
| 不包含 `✅ 已解决` | 待解决 | 需要本次改进处理     |

**优先级判定**：

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
- 如果所有问题都已解决，result 设为 `无需改进`

### 4. 输出分析结果

将结果以 JSON 格式写入 `docs/code/improveAnalyzeResult.md`。

**确保 `docs/code/` 目录存在**，不存在则先创建。

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
  "reason": "docs/code/ImproveCode.md 文件不存在或内容为空"
}
```

## 重要提醒

1. **必须写入文件**：结果必须写入 `docs/code/improveAnalyzeResult.md`，不是输出到终端
2. **JSON 格式严格**：确保输出的是合法 JSON，可被程序解析
3. **确保目录存在**：如果 `docs/code/` 目录不存在，需要先创建
4. **不修改源文件**：此 Skill 只读取 `ImproveCode.md`，不修改它（修改由 improve-execute 负责）
5. **不执行代码改进**：此 Skill 仅做分析，不执行实际的代码修改
6. **每次覆盖写入**：每次执行都覆盖 `improveAnalyzeResult.md`（不是追加）
