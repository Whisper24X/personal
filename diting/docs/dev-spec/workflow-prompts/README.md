# 工作流提示词（WORKFLOW_PROMPTS）

执行器在 **spec 工作区根目录** 解析可选的工作流节点顺序、模板与本地循环上限。diting 宿主仓库内的说明与模板如下。

## spec 工作区文件路径（可选）

- `knowledge/WORKFLOW_PROMPTS.md`
- `WORKFLOW_PROMPTS.md`

同一工作区内按文档声明的顺序执行各节点；若未提供 `WORKFLOW_PROMPTS.md`，执行器使用内置 Superpowers 默认 workflow。

## 本仓库模板

- 骨架与变量示例：[`docs/templates/WORKFLOW_PROMPTS.example.md`](../../templates/WORKFLOW_PROMPTS.example.md)

请按项目实际节点、技能与产物路径替换占位内容，勿直接照搬示例中的节点名或输出文件名。

## 常用变量示例

文档中可使用占位符，例如：`{{taskId}}`、`{{taskTitle}}`、`{{gitBranch}}`、`{{gitWorktreePath}}` 等（完整列表见模板）。

## 相关说明

- 根 [`README.md`](../../../README.md) — Workflow Prompt System 概述
- 执行编排规范：[`openspec/specs/execution-orchestration/spec.md`](../../../openspec/specs/execution-orchestration/spec.md)
