---
name: code-doc
description: 扫描未提交改动，按模板生成 apiChanges.md 与 moduleChanges.md；路径由节点 Prompt 约定（示例 docs/{{gitBranch}}/）。
---

# 代码变更清单生成

## 输出规范（强制）

**文档路径**：两个输出文件的目录**必须**从节点 Prompt 获取；示例：`docs/{{gitBranch}}/apiChanges.md`、`docs/{{gitBranch}}/moduleChanges.md`。

| 项目           | 规范                                                    |
| -------------- | ------------------------------------------------------- |
| **输出文件名** | `apiChanges.md` 和 `moduleChanges.md`，不可使用其他名称 |
| **文件数量**   | 必须同时生成 2 个文件                                   |
| **输出路径**   | prompt 指定目录（如 `docs/{{gitBranch}}/`）             |

## 执行步骤

### Step 1：读取模板

读取以下两个模板文件，了解输出格式要求：

- [api-doc-template.md](references/api-doc-template.md)
- [module-doc-template.md](references/module-doc-template.md)

### Step 2：获取变更文件

执行 `git status --porcelain` 获取当前工作空间所有未提交的改动文件。

### Step 3：分析改动代码

读取变更文件的实际内容，分析：

- 哪些文件涉及接口定义（HTTP 接口、RPC 接口、类型定义等）
- 这些改动属于哪些功能模块

### Step 4：按模板生成两份文件

- 将接口分析结果按 `api-doc-template.md` 的结构填充，输出到 prompt 指定路径（如 `docs/{{gitBranch}}/apiChanges.md`）
- 将功能变更分析结果按 `module-doc-template.md` 的结构填充，输出到 prompt 指定路径（如 `docs/{{gitBranch}}/moduleChanges.md`）
- 删除模板中的"填写说明"章节，不得保留占位符
- **生成时间**必须填写当前实际执行时间（精确到秒），不得使用模板中的示例值或占位符
- `moduleChanges.md` 只列出用户可见或测试可验证的功能变更；纯代码重构、工具函数调整、内部模块导出等对用户无感知的改动**不列入**

## 禁止事项

- ❌ 不得只生成其中一个文件
- ❌ 不得保留模板中的占位符或"填写说明"章节
- ❌ 不得输出到节点 Prompt 约定目录以外
