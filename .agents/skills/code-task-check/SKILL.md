---
name: code-task-check
description: 检查 openspec/changes/*/tasks.md 文件中的任务完成状态。将结果写入 prompt 指定的 taskResult.md 文件（两行：状态+原因）。无状态验证工具，由 WriteCode Action 循环调用。
---

# Code Task Check Validator

检查 `openspec/changes/*/tasks.md` 文件中的任务是否全部执行完成，并将结果写入文件。

## 输出规范

**文档路径**：输出路径**必须**从 prompt 获取（如 `docs/{{gitBranch}}/taskResult.md`）。

## 完成判断规则

**只有标记为 `- [x]` 的任务才算完成，其他一律不算完成。**

- `- [x]` → 已完成
- `- [ ]` → 未完成（无论描述中写了什么）

## 输出方式

**必须将结果写入文件**（路径由 prompt 指定，如 `docs/{{gitBranch}}/taskResult.md`），文件内容固定两行：

```
{状态}
{原因}
```

其中 `{状态}` 必须是：`已完成` | `未完成` | `未找到`（三选一）

## 检查步骤

1. 使用 glob 查找 `openspec/changes/*/tasks.md` 文件
2. 如果文件不存在 → 写入"未找到"状态
3. 读取文件内容，统计 `- [x]` 和 `- [ ]` 任务数量
4. 将结果写入 prompt 指定的路径

## 写入示例

写入 taskResult.md 的内容示例：

```
已完成
所有 23 个任务已标记为 [x]
```

```
未完成
3 个任务未标记为 [x]：任务 2.1、3.4、3.6
```

```
未找到
openspec/changes/ 目录不存在
```

## 重要提醒

1. **必须写入文件**：结果必须写入 prompt 指定的路径，不是输出到终端
2. **文件格式固定**：只有两行，第一行是状态，第二行是原因
3. **确保目录存在**：若输出目录不存在，需先创建
