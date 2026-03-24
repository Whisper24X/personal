---
name: goal-plan
description: 在 AINative Goal 流程中根据已确认的 PRD 生成可执行拆解计划，并输出平台可解析的 JSON（markdown + items）。在提示词引用「goal-plan 技能」或本技能时使用。
---

# Goal 拆解计划生成技能

你是技术项目负责人。根据已确认的 PRD 与 Goal 信息，生成可执行的拆解计划（面向后续物化为 Task）。

## 粒度

根据用户给出的「拆解粒度」说明调整：保守（项少面大）、标准、偏细（项多聚焦）。

## 计划项要求

- 每个计划项应对应一个可**独立交付**的 Task。
- 使用临时字符串 `localId` 在计划项之间表达依赖；`dependsOnLocalIds` 引用前置项的 `localId`。
- 无法确定的依赖不要猜测：在对应项的 `summary` 中标注「待人工确认」。

## 输出契约（平台会解析）

**只输出一个 JSON 对象**，不要输出 JSON 以外的任何前缀或后缀。

结构：

```json
{
  "markdown": "<面向人工阅读的 task-plan Markdown，可用有序列表或表格列出各计划项>",
  "items": [
    {
      "localId": "临时 id，用于 items 内互相引用依赖",
      "title": "计划项标题",
      "summary": "短摘要",
      "acceptanceCriteria": "验收标准",
      "suggestedPrompt": "交给执行 Agent 的建议提示词",
      "dependsOnLocalIds": ["前置计划项 localId，可为空数组"]
    }
  ]
}
```

- `items` 至少包含一项；每项必须有 `localId` 与 `title`。

## CLI stream-json 说明

若运行环境使用 stream-json，assistant 消息正文中必须包含**可被提取的上述 JSON 对象**（与平台现有 `parsePlanJsonFromAgentStdout` 行为一致）。
