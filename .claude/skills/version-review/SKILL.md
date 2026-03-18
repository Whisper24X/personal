---
name: version-review
description: Conducts a 5-round interactive version review to validate version ideas against system knowledge base (business rules, PRD/MRD history, terminology, tech constraints). Generates targeted questions via Cursor CLI, supports frontend API polling and state machine. Use when performing version review, version consistency check, validating version ideas, or when user requests version verification.
---

# 版本评审

通过结构化的 5 轮评审流程，对照系统知识库校验版本想法，识别潜在冲突或不一致。

**重要说明**：

- 问题与文档生成使用 **Cursor CLI 工具**（任意环境可用）
- 用户交互通过 **前端 API 接口** + 轮询机制完成
- 评审状态由状态机管理并持久化到数据库

## Quick Reference

- 知识库检索：见 [references/knowledge-types.md](references/knowledge-types.md)
- 问题模板：见 [references/question-templates.md](references/question-templates.md)
- API 集成：见 [references/api-integration.md](references/api-integration.md)
- 检查清单：见 [references/checklist.md](references/checklist.md)
- 示例：见 [examples.md](examples.md)

---

## 输出规范（强制）

> **重要**：以下规范必须严格遵守，不可违反。

| 项目         | 规范                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| **增量文件** | `{versionName}-review.md`（每轮问答即时写入，保留完整问答进度）                                      |
| **总结文件** | `{versionName}-review-summary.md`（5 轮完成后**新建**，汇总全部问答与评审结论，**不覆盖**增量文件）  |
| **输出目录** | `docs/version-review/`（相对于版本工作区）                                                           |
| **文件数量** | 总结步骤只生成 1 个新文件，禁止覆盖增量文件或创建额外拆分文件                                        |
| **文档结构** | 必须严格按照文档结构模板（版本信息、问答记录、评审结论、冲突分析、建议、行动项）                     |
| **问答轮数** | 必须完成全部 5 轮问答，禁止跳过任何一轮                                                              |
| **知识引用** | 问题中引用知识库内容时，必须使用格式：> 📚 来源：业务规则 - 文档名称（使用中文知识类型，见下方映射） |

---

## 快速开始

1. 前端调用 `POST /api/projects/:id/versions/:versionId/review/start` 启动评审
2. 前端轮询 `GET /api/projects/:id/versions/:versionId/review/status` 获取状态
3. 当状态为 `waiting_answer` 时，前端展示问题并等待用户输入
4. 前端调用 `POST /api/projects/:id/versions/:versionId/review/answer` 提交回答
5. 系统自动生成下一题或评审文档
6. 重复步骤 2-5，直到 5 轮结束

---

## 评审流程

### Step 0: 前置条件检查

- **版本想法**：用户描述要做的内容
- **项目 ID**：用于检索知识库
- **知识库**：包含业务规则、历史 PRD/MRD、术语与技术约束

### Step 1: 知识库检索

在评审开始前，必须检索结构化知识上下文。详见 [references/knowledge-types.md](references/knowledge-types.md)。

### 状态机

- `pending`：未开始
- `generating_question`：通过 CLI 生成问题
- `waiting_answer`：问题已生成，等待用户回答
- `generating_document`：问题完成，生成评审文档
- `completed`：评审完成，文档已生成
- `failed`：评审过程发生错误

```
pending → generating_question → waiting_answer → generating_question → ... → generating_document → completed
                                                                                    ↓
                                                                                 failed
```

### Step 2-6: 5 轮评审执行

必须**按顺序**执行，并使用前一轮回答影响下一轮问题。每轮详细问题模板见 [references/question-templates.md](references/question-templates.md)。

#### Step 2: 第 1 轮 - 业务规则冲突检查

**Focus**：

- 检查版本想法是否与现有业务规则冲突
- 识别具体冲突的业务规则
- 询问用户是否需要调整想法以符合规则

**Question generation**：

1. 指出可能冲突的业务规则
2. 询问用户是否需要调整想法以符合业务规则
3. 提供具体的冲突示例（如有）

#### Step 3: 第 2 轮 - 功能冲突检查

**Focus**：

- 检查版本想法是否与现有功能重复或冲突
- 识别功能重叠
- 询问功能范围是否需要调整

**Question generation**：

1. 指出可能重复或冲突的功能
2. 询问用户是否需要调整功能范围
3. 提供具体的功能对比（如有）

#### Step 4: 第 3 轮 - 术语一致性检查

**Focus**：

- 检查版本想法中使用的术语是否与系统定义一致
- 列出可能不一致的术语
- 询问术语是否需要统一

**Question generation**：

1. 列出可能不一致的术语
2. 询问用户是否需要统一术语使用
3. 提供术语词典中的标准定义（如有）

#### Step 5: 第 4 轮 - 业务数据与系统兼容性检查

**Focus**：

- 检查版本想法是否涉及业务数据或信息结构的改动
- 识别潜在的系统限制
- 询问需求是否需要调整以符合开发标准
- **必须用业务可读语言**，不得使用技术术语

**Question generation**：

1. 指出可能的业务数据或信息结构改动
2. 指出可能的系统限制
3. 询问用户是否需要调整需求以符合开发标准

#### Step 6: 第 5 轮 - 最终确认

**Focus**：

- 汇总前四轮讨论的关键点
- 询问版本想法是否需要基于评审结果进行调整
- 如需调整，询问具体的调整方向

**Question generation**：

1. 总结前面讨论的关键点
2. 询问是否需要基于讨论结果调整版本想法
3. 如用户需要调整，询问具体的调整方向

### Step 7: 评审文档生成

5 轮全部完成后，必须**汇总全部 5 轮问答结果**，生成**新的**结构化总结文档：

- **保存位置**：`docs/version-review/{versionName}-review-summary.md`（相对于版本工作区）
- **不覆盖**：生成新文件，**禁止覆盖**增量文件 `{versionName}-review.md`
- **文档必须包含**：版本信息、5 轮完整问答记录、评审结论（冲突分析、建议、行动项）
- **语言要求**：冲突分析、建议、行动项必须用业务语言撰写，非技术人员能直接读懂

---

## 问题生成规范

### 业务可读性（强制）

**所有生成的问题和评审文档必须让非技术人员能直接读懂。**

- **原则**：用通俗语言转述知识库内容，不得照抄技术术语
- **引用格式**：`> 📚 来源：业务规则 - 文档名称`（禁止使用 BUSINESS_RULES 等英文代码）

**术语对照表**：

| 禁止/避免使用   | 改用                                     |
| --------------- | ---------------------------------------- |
| 数据模型        | 业务数据、信息结构                       |
| 数据模型变更    | 数据字段或表格结构改动                   |
| 技术约束        | 系统限制、实现要求                       |
| 技术规范        | 开发标准                                 |
| 技术实现风险    | 实现难度或风险                           |
| PRD             | 产品需求文档                             |
| MRD             | 市场调研文档                             |
| 架构、接口、API | 系统结构、对接方式（或具体说明业务含义） |
| 字段、表结构    | 数据项、信息项                           |

**知识类型中文映射**：BUSINESS_RULES→业务规则，HISTORY_PRD→历史需求文档，TERMINOLOGY→术语词典，TECH_CONSTRAINTS→系统限制，DEV_SPEC→开发规范

### 原则

1. **知识驱动**：问题必须基于真实知识库内容，不做臆测
2. **具体可执行**：问题要具体，不要抽象
3. **聚焦冲突**：优先识别不一致与冲突
4. **明确建议**：给出清晰的修改建议
5. **引用规范**：引用知识库内容时必须使用标准格式（中文知识类型）

### 问题格式

- 直截了当、清晰明确
- **必须引用具体知识库内容**，使用 `> 📚 来源：[中文知识类型] - 文档名称`
- 第 2-6 轮需包含前序 Q&A 上下文
- 可用简短回答回应
- 明确指出冲突点或潜在问题

---

## 文档结构

```markdown
# 版本评审：[版本名称]

## 版本信息

- 版本名称：[name]
- 版本想法：[idea]
- 评审日期：[date]

## 问答记录

### 第 1 轮：业务规则冲突检查

**问题：** [question]
**回答：** [answer]

### 第 2 轮：功能冲突检查

...

### 第 3 轮：术语一致性检查

...

### 第 4 轮：业务数据与系统兼容性检查

...

### 第 5 轮：最终确认

...

## 评审结论

### 冲突分析

[基于 Q&A 与知识库的分析]

### 建议

[针对每项冲突的具体建议]

### 行动项

- [ ] Action item 1
- [ ] Action item 2
```

---

## Review Document Generation

5 轮问答全部完成后，基于问答记录与知识库生成**新的**完整评审总结文档，保存到 `docs/version-review/{versionName}-review-summary.md`。**禁止覆盖**增量文件 `{versionName}-review.md`。

### 文档结构要求

1. **版本信息**：版本名称、版本想法、评审日期
2. **问答记录**：5 轮问题与用户回答的完整记录，每轮标注类型（业务规则冲突检查、功能冲突检查、术语一致性检查、业务数据与系统兼容性检查、最终确认）
3. **评审结论**：
   - **冲突分析**：基于 Q&A 与知识库，逐维度分析是否存在冲突
   - **建议**：针对每项冲突或潜在问题给出具体修改建议
   - **行动项**：可执行的 checklist 清单

### 业务可读性要求

- 冲突分析、建议、行动项必须用**业务语言**撰写，非技术人员能直接读懂
- 禁止使用：数据模型、技术约束、PRD、MRD、架构、接口、API 等术语
- 改用：业务数据、系统限制、产品需求文档、系统结构、对接方式等通俗表述

### 输出路径

- 完整路径：`docs/version-review/{versionName}-review-summary.md`（相对于版本工作区，**新建文件**，不覆盖增量文件）
- 版本名称中的非法文件名字符需替换为下划线（如 `<>:"/\|?*` → `_`）

---

## 禁止事项

1. ❌ 总结文档使用非 `{versionName}-review-summary.md` 格式，或覆盖增量文件 `{versionName}-review.md`，或保存到非 `docs/version-review/` 目录
2. ❌ 创建多个文件
3. ❌ 跳过任何一轮评审
4. ❌ 使用非标准格式的问题（必须引用知识库内容）
5. ❌ 在问题中使用臆测内容
6. ❌ 省略知识库引用格式
7. ❌ 在评审文档中使用占位符或空泛描述
8. ❌ 省略文档结构中的任何章节
9. ❌ 第 2-6 轮问题不包含前序 Q&A 上下文
10. ❌ 使用知识库外的术语定义
11. ❌ 使用「数据模型」「技术约束」「PRD」「MRD」等非业务可读术语

---

## 集成说明

- `RAGService`：知识检索
- `CLIExecutor`：通过 Cursor CLI 生成问题与文档
- `ProjectVersionRepository`：评审状态持久化到数据库元数据
- 前端 API：用户交互

评审过程为**异步**：问题与文档异步生成，需要前端轮询。API 详情与错误处理见 [references/api-integration.md](references/api-integration.md)。

**增量写入**：每轮问答完成后会**即时**将 Q&A 追加到 `docs/version-review/{versionName}-review.md`；5 轮全部完成后，**新建**总结文件 `docs/version-review/{versionName}-review-summary.md`（含评审结论、冲突分析、建议、行动项），**不覆盖**增量文件。
