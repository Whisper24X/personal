---
name: improve-execute
description: 按 improveAnalyzeResult.md 中的 issues 修复代码，并回写 JSON 中各条目的 status。
---

# ExecuteCodeImprovement - 执行代码改进

根据 `improveAnalyzeResult.md` 中的 `issues` 列表，按优先级逐一修复，并在**同一文件**内将对应条目的 `status` 更新为 `resolved`（可选增加 `resolution_note` 字段）。

## 输出规范（强制）

> **重要**：执行结果必须写入文件，不是输出到终端。

**文档路径**：输入/输出路径**必须**从节点 Prompt 获取（工作流 v2 ImproveCode）；示例：`docs/{{gitBranch}}/improveAnalyzeResult.md`、`docs/{{gitBranch}}/improveExecuteResult.md`。

| 项目         | 规范                                            |
| ------------ | ----------------------------------------------- |
| **输入文件** | `docs/{{gitBranch}}/improveAnalyzeResult.md`（分析结果，含 issues） |
| **结果文件** | `docs/{{gitBranch}}/improveExecuteResult.md`             |
| **回写文件** | `docs/{{gitBranch}}/improveAnalyzeResult.md`（每修复一项更新 issues[].status） |
| **文件格式** | 执行结果固定两行：第一行状态，第二行原因                |
| **状态值**   | `执行成功` / `执行失败`（二选一）               |

## 执行步骤

### 1. 读取输入

1. **读取分析结果** `docs/{{gitBranch}}/improveAnalyzeResult.md`
   - 解析 JSON，获取 `issues` 列表
   - 筛选 `status === "pending"` 的问题
   - 按 `priority` 排序：high → medium → low

若文件不存在或无法解析为合法 JSON，输出 `执行失败` 并结束。

### 2. 逐一修复问题

按优先级顺序处理每个待解决问题：

**修复流程**：

1. **定位问题**：根据问题描述找到相关的源代码文件和位置
2. **分析根因**：理解问题的根本原因
3. **实施修复**：
   - Bug 修复：修正逻辑错误、处理边界条件、完善错误处理
   - 性能优化：减少不必要的计算、优化数据查询、改善资源使用
   - 代码质量：提升可读性、消除重复代码、改善命名
   - 用户体验：改进交互反馈、优化界面布局、完善提示信息
4. **验证修复**：确保修复没有引入新问题

**修复原则**：

- 只修复问题点，不做大范围重构
- 保持代码风格与项目一致
- 确保修复后代码可编译、可运行
- 每个修复尽量原子化，便于追踪

### 3. 回写 JSON（重要）

每修复一个问题后，**必须**将 `improveAnalyzeResult.md` 中对应 `issue` 的 `status` 设为 `resolved`，并可增加 `resolution_note`（简短说明）。

- 若问题无法修复，保持 `pending`，不修改该项
- **cursor-agent -p 是无状态的**，每次执行都是全新上下文，必须通过**回写 JSON** 避免重复修复同一项

### 4. 输出执行结果

将结果写入 `docs/{{gitBranch}}/improveExecuteResult.md`。

**确保 `docs/{{gitBranch}}/` 目录存在**，不存在则先创建。

### 示例 - 执行成功

```
执行成功
修复了 3 个问题：登录失败处理（high）、列表加载性能（medium）、变量命名规范（low）
```

### 示例 - 执行成功（部分修复）

```
执行成功
修复了 3 个问题中的 2 个，"数据库连接池优化"因需要修改基础设施配置暂未修复
```

### 示例 - 执行失败

```
执行失败
无法读取分析结果文件 docs/{{gitBranch}}/improveAnalyzeResult.md
```

## 重要提醒

1. **必须写入文件**：结果必须写入 `docs/{{gitBranch}}/improveExecuteResult.md`，不是输出到终端
2. **文件格式固定**：只有两行，第一行是状态，第二行是原因
3. **确保目录存在**：如果 `docs/{{gitBranch}}/` 目录不存在，需要先创建
4. **必须回写 JSON**：每修复一个问题，必须在 `improveAnalyzeResult.md` 中更新对应 `issue` 的 `status`
5. **不删除 improveAnalyzeResult.md**：删除由 improve-verify 在全部完成后执行
6. **每次覆盖写入**：每次执行都覆盖 `improveExecuteResult.md`（不是追加）
7. **代码完整性**：修复的代码必须完整，禁止 TODO/占位符/空实现/伪代码
