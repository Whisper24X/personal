---
name: improve-execute
description: 按 improveAnalyzeResult.md（Markdown）中的 issues 修复代码；对需根因类问题先按 systematic-debugging 再改码；回写同文件中对应 Issue 的状态与根因字段。
---

# ExecuteCodeImprovement - 执行代码改进

根据 `improveAnalyzeResult.md`（Markdown 结构化文档）中 `## Issues` 下的各 `### Issue N` 列表，按优先级逐一修复，并在**同一文件**内将对应条目的 `**status**` 更新为 `resolved`，同时写入 `**resolution_note**` 及（对适用类型）`**root_cause_summary**` / `**evidence**`。

**融合技能**：对下列 issue 在**实施任何代码修改之前**，必须先阅读并遵循 **`systematic-debugging`**（`.agents/skills/systematic-debugging/SKILL.md`）。铁律：**未完成 Phase 1（根因调查）不得提出修复**。多组件场景可结合同目录下的 `root-cause-tracing.md` 做数据流追溯。

## 输出规范（强制）

> **重要**：执行结果必须写入文件，不是输出到终端。

**文档路径**：输入/输出路径**必须**从节点 Prompt 获取（工作流 v2 ImproveCode）；示例：`docs/{{gitBranch}}/improveAnalyzeResult.md`、`docs/{{gitBranch}}/improveExecuteResult.md`。

| 项目         | 规范                                            |
| ------------ | ----------------------------------------------- |
| **输入文件** | `docs/{{gitBranch}}/improveAnalyzeResult.md`（分析结果，Markdown 结构化文档，含 `## Issues`） |
| **结果文件** | `docs/{{gitBranch}}/improveExecuteResult.md`             |
| **回写文件** | `docs/{{gitBranch}}/improveAnalyzeResult.md`（每修复一项，在对应 `### Issue N` 下更新 `**status**`、写入 `**resolution_note**`，适用时填写 `**root_cause_summary**`、`**evidence**`） |
| **文件格式** | 执行结果固定两行：第一行状态，第二行原因                |
| **状态值**   | `执行成功` / `执行失败`（二选一）               |

## 执行步骤

### 1. 读取输入

1. **读取分析结果** `docs/{{gitBranch}}/improveAnalyzeResult.md`
   - 该文件为 Markdown 结构化文档，从 `## Issues` 下各 `### Issue N` 中提取字段
   - 筛选 `**status**: pending` 的问题
   - 按 `**priority**` 排序：high → medium → low

若文件不存在或缺少 `## Summary` / `## Issues` 章节，输出 `执行失败` 并结束。

### 2. 逐一修复问题

按优先级顺序处理每个待解决问题。

#### 2.1 何时必须完整执行 systematic-debugging（Phase 1～4）

对 **`type` 为 `bug`、`security`、`performance` 的 issue**，必须走完整流程（含 **Phase 4**：必要时先补最小复现/测试，再单点修改）。

若 **`requires_deep_debug`** 为 `true`（由 improve-review 可选填入），一律按完整流程执行。

对 **`type` 为 `quality`、`solid` 的 issue**（小范围命名/风格/单一职责调整）：至少完成 **Phase 1** 中与该 issue 相关的「读代码、对照 diff、确认修改点」；不强制书面假设实验，但仍禁止未理解就改。

#### 2.2 Phase 1～3 完成标准（在实施修复之前）

在未写修复代码前，你必须能在心里或笔记中明确回答（**对 bug/security/performance 须在 `resolution_note` / `root_cause_summary` 中留下对应文字**）：

| Phase | 内容 | 完成标准 |
| ----- | ---- | -------- |
| **1 根因调查** | 读错信息、复现路径、近期变更、多组件时边界证据 | 能说明**坏结果从哪一层/哪条路径产生**，而非只描述界面现象 |
| **2 模式分析** | 库内相似正确实现、参考实现差异 | 已对比「工作 vs 失效」的关键差异 |
| **3 假设与验证** | 单一假设、最小验证 | 有一个可检验的因果陈述；必要时用最小日志/一次实验验证 |

**禁止**：跳过 Phase 1 直接「先试改一行」、同一 issue 并行多个不相关修改。

#### 2.3 修复流程（每条 issue）

1. **定位**：根据 `location`、`title` 找到源码与调用关系。
2. **根因与假设（systematic-debugging 1～3）**：按上表完成；多组件时在边界打点收集证据（见 systematic-debugging 原文）。
3. **实施修复（Phase 4）**：
   - Bug：修正逻辑、边界、错误处理（修根因处，不只抹平症状）
   - 安全：消除注入/XSS/权限等根因
   - 性能：针对已定位热点优化
   - 质量/架构：小步、与现有风格一致
4. **验证**：单测或本地运行；**一次只合并解决一个根因**；无新 TODO/占位符。

#### 2.4 回写字段（修复后填写到 `improveAnalyzeResult.md` 对应 Issue 小节）

将对应 `### Issue N` 下的 `**status**` 改为 `resolved` 时，必须在**同一小节内**追加以下字段行：

**必填**：
- **`resolution_note`**：可含多句，建议结构化——根因结论（What + Why）、证据（可选）、修复策略

**对 `type` ∈ { `bug`, `security`, `performance` } 额外必填**：
- **`root_cause_summary`**：一句人话概括根因，供 improve-verify 审计

**可选**：
- **`evidence`**：关键命令输出、断言失败摘要等；多条时换行用 `  - 条目` 列表

**多行内容约定**：字段值需多行时，用 `>` 引用块或紧接下一行缩进，确保不会破坏后续 `- **key**` 的解析。

示例（单条 Issue 回写后的完整小节）：

```markdown
### Issue 1

- **id**: 1
- **title**: 登录失败时未显示错误提示
- **priority**: high
- **status**: resolved
- **type**: bug
- **location**: src/auth/login.ts:40
- **requires_deep_debug**: false
- **root_cause_summary**: 错误响应在 axios 拦截器中被统一吞掉，未向 UI 层传递 message
- **evidence**:
  - Network 200 但 response.data.error 未映射到 store
- **resolution_note**: 根因：拦截器 return 了空对象导致上层拿不到 error。证据：在拦截器打印 response 与下游 store。策略：在 reject 分支抛出带 message 的 Error，与现有错误边界一致。
```

**修复原则**：

- 只修复问题点，不做大范围重构
- 保持代码风格与项目一致
- 确保修复后代码可编译、可运行
- 每个修复尽量原子化，便于追踪

### 3. 回写 Markdown（重要）

每修复一个问题后，**必须**在 `improveAnalyzeResult.md` 中找到对应 `### Issue N` 小节，将 `**status**` 改为 `resolved`，并写入 **`resolution_note`**。

- 对 **`type` ∈ { `bug`, `security`, `performance` }**：必须同时写入 **`root_cause_summary`**；建议写入 **`evidence`**（若有）
- 若问题无法修复，保持 `**status**: pending`，不修改该项
- **cursor-agent -p 是无状态的**，每次执行都是全新上下文，必须通过**回写 Markdown** 避免重复修复同一项

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
4. **必须回写 Markdown**：每修复一个问题，必须在 `improveAnalyzeResult.md` 对应 `### Issue N` 下更新 `**status**` 与相关字段
5. **不删除 improveAnalyzeResult.md**：删除由 improve-verify 在全部完成后执行
6. **每次覆盖写入**：每次执行都覆盖 `improveExecuteResult.md`（不是追加）
7. **代码完整性**：修复的代码必须完整，禁止 TODO/占位符/空实现/伪代码
8. **systematic-debugging**：对 bug/security/performance 未作根因分析不得标记为 `resolved`；`root_cause_summary` 不得为空或仅重复 title
