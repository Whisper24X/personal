---
name: prototype-to-prd
description: >-
  将用户提供的原型文件夹（HTML、TSX/JSX 等页面组件）和可选的 Markdown 补充说明整理成结构化 PRD.md。
  当用户提供原型页面并希望生成 PRD、提到"原型转 PRD"、"prototype to PRD"、"把原型整理成需求文档"时使用此 skill。
  输入可以是任意结构的项目文件夹，不要求统一命名规范。
---

# 原型转 PRD

将原型文件夹中的页面结构、交互元素和补充文档，整理为一份与 `prd` skill 输出习惯一致、可被下游设计/测试/研发流程消费的 `PRD.md`。

## 输出规范（强制）

| 项目 | 规范 |
| --- | --- |
| **输出文件名** | `PRD.md`（固定，不可更改） |
| **输出位置** | `<root>/PRD.md`，`<root>` 为用户指定的根目录 |
| **文件数量** | 只生成 1 个文件 |
| **文档结构** | 严格按照 [references/prd-v1-template.md](references/prd-v1-template.md) 的 7 节结构 |

## 处理流程

### Step 1：扫描目录，建立文件清单

> 文件夹内部结构和命名没有统一规定，必须先扫描再判断，不可假设路径。

用 Glob 列出 `<root>` 下所有文件（含子目录），按扩展名分为两类候选：

- **原型候选**：`.html`、`.tsx`、`.jsx`
- **上下文候选**：`.md`、`.txt`

将扫描结果作为后续步骤的输入清单。

### Step 2：选取原型文件并解析

从原型候选中按以下优先级选取（命中即停止向下）：

1. 路径含 `prototype/` 的 `.html` — 明确标注为原型的静态文件
2. `client/index.html` + 路径含 `pages/` 的 `.tsx/.jsx` — 全栈应用页面
3. 其余 `.html`，按路径深度排序，浅层优先
4. 若无 HTML，读取所有 `pages/` 下 `.tsx/.jsx`，从 JSX 结构推断页面信息

**HTML 静态解析提取优先级**（不执行 JavaScript）：

1. `<title>`、`<h1>`–`<h3>`、`<nav>` → 页面/模块名称和导航结构
2. `<button>`、`<a>`、`<input>`、`<form>` → 操作入口、表单字段
3. 空态文案、错误提示文字、`<dialog>` / `.modal` 内容 → 状态与异常处理
4. 样式和脚本内容默认降权，不参与提取
5. 语义化弱时，基于可见文案做有限推断，推断结论写入"假设与待确认项"

### Step 3：选取并融合上下文文档

从上下文候选中，按优先级叠加读取（不互斥，可全部读取）：

1. 路径含 `prototype/` 的 `.md` — 最高优先级，专用补充说明
2. 根目录 `AGENTS.md` — 设计规范、目标用户、交互原则
3. 根目录 `README.md`
4. 路径含 `specs/`、`docs/`、`spec` 关键词的 `.md` — 技术方案、业务规则
5. 其余 `.md`，按路径深度排序，浅层优先

**冲突处理规则**：
- 业务规则以上下文文档（上方优先级高的）为准
- 页面结构和交互入口以 HTML/TSX 为准
- 若两者冲突，**不可静默覆盖**，必须在"假设与待确认项"中显式列出
- 缺失信息只做最小必要假设，并在"假设与待确认项"中注明

### Step 4：读取模板，生成 PRD.md

读取 [references/prd-v1-template.md](references/prd-v1-template.md) 获取完整的 7 节结构和填写规范，然后生成 `<root>/PRD.md`。

填写要求：
- 每节内容来源于 Step 2–3 的提取结果
- 上下文文档中额外的业务规则、术语或限制条件，以小节形式补充到对应章节，不强制独立成章
- 状态与异常处理内嵌在"功能需求明细"或"关键交互流程"中，不单独成章
- 不确定的内容只能出现在第 7 节"假设与待确认项"

## 禁止事项

1. 跳过 Step 1 的目录扫描，直接假设文件路径
2. 执行 HTML 中的 JavaScript
3. 静默覆盖冲突信息（冲突必须写入第 7 节）
4. 使用 `PRD.md` 以外的文件名
5. 生成多个输出文件
6. 在第 7 节以外的位置写 TBD 或待确认内容

## AINative Goal PRD 生成（平台集成，与上文「写 PRD.md 文件」二选一）

当提示词引用 **prototype-to-prd 技能**且场景为 **AINative Goal 生成 PRD**（Agent 在项目仓库根目录执行、平台从 stdout 解析 JSON）时，**不得**在项目内写入 `<root>/PRD.md`；必须按下列约定执行。

### 输入根目录

- **固定路径**（相对仓库根目录）：`docs/goals/<goalId>/input`
- `<goalId>` 由提示词给出。须先 **Glob / 列出** 该目录下全部文件（含子目录，如 `…/input/<uuid>-unpacked/...`），再按上文 Step 1–3 的规则选取原型与上下文文档。
- 若目录为空或无可读原型/上下文文件，仅基于 Goal 标题与摘要做最小推导，并在第 7 节与 `uncertainPoints` 中标注假设。

### 文档结构

- 与上文一致：按 [references/prd-v1-template.md](references/prd-v1-template.md) 的章节结构生成 PRD 正文（写入 `markdown` 字符串）。

### 输出契约（平台解析 stdout）

**只输出一个 JSON 对象**，不要输出 JSON 以外的任何前缀或后缀（不要使用 Markdown 代码块包裹整段 JSON，除非平台另有说明）。须与 stream-json / `parsePrdJsonFromAgentStdout` 可抽取格式兼容。

```json
{
  "markdown": "<完整 PRD Markdown 正文>",
  "uncertainPoints": ["待人工确认项1", "待人工确认项2"]
}
```

- `markdown`：字符串，内含完整 PRD。
- `uncertainPoints`：字符串数组，可为空数组；与模板第 7 节「假设与待确认项」一致。

### 与「本地写 PRD.md」的差别小结

| 场景 | 输出方式 |
| --- | --- |
| 本地/通用：用户指定 `<root>` 且需落盘 | 写入 `<root>/PRD.md` |
| AINative Goal | **仅** stdout 输出上述 JSON，**不写文件** |

## 与下游流程衔接

| 下游 Skill | 读取章节 | 期望内容 |
| --- | --- | --- |
| design | 3（模块概览）、4（功能需求）、5（交互流程） | 页面入口清晰、P0 功能完整 |
| test | 4（功能需求 AC 部分）、6（范围界定） | 每个功能有可测试验收标准 |
| prd（升级） | 全文 | 可作为完整 MRD → PRD 流程的前置输入 |
