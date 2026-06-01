---
name: goal-plan
description: 在 AINative 需求流程中根据已确认的 PRD 生成双层任务计划（小需求组 + 可物化子任务），输出 markdown 与平台可解析 JSON。在提示词引用「goal-plan 技能」或本技能时使用。
---

# 需求任务计划生成技能

你是技术项目负责人。根据已确认的 PRD，生成**双层**任务计划：

1. **`items`（小需求 / 功能组）**：可独立叙述范围与验收边界，用于分组与阅读；**不**对应平台「新建 Task」——父级计划项永不物化。
2. **`subTasks`（子任务）**：每条对应后续**一条 Task**；仅子任务参与物化与执行配置。

## 粒度

平台请求体 `granularity` 与后端 `PlanGranularity` 一致，生成时须按所选档位调整拆解疏密（提示词会注入同义说明）：

| API 值 | 称呼 | 行为要点 |
|--------|------|----------|
| `coarse` | 粗 | 顶层功能组数量与子任务总数尽量接近，倾向每组约一条子任务，整体划分更粗。 |
| `conservative` | 保守 | 顶层功能组较少，每组内子任务可略多以覆盖较大范围。 |
| `standard` | 标准 | 功能组数量与子任务密度平衡。 |
| `fine` | 较细 | 顶层功能组偏多或每组内子任务更细（实现步骤更碎）。 |

勿将「较细」简单等同于更多顶层组——也可体现为组内步骤更碎。

## 顶层 `items` 要求（父级，不物化）

- 使用 `localId` 表达**组与组之间**的依赖；`dependsOnLocalIds` 引用前置**组**的 `localId`。
- **平台语义**：当某组配置了前置组时，该组内**任意子任务**在「确认」或「物化新建任务」之前，每个前置功能组内的**全部子任务**须已物化（已关联 Task），且对应 Task 状态均为**已完成（done）**；否则前端会提示阻塞，后端会拒绝操作。
- 每组必须给出非空 `summary`、`acceptanceCriteria`、`suggestedPrompt`（依据 PRD），说明**整组**范围与整体验收。
- 每组必须包含**至少一条** `subTasks`。

## 子任务 `subTasks` 要求（唯一 Task 来源）

- 每条子任务使用 **`subLocalId`**，在**整份计划内全局唯一**（可跨组引用）。
- `dependsOnSubLocalIds` 引用其他子任务的 `subLocalId`（可跨功能组，例如「接口」先于「页面联调」）。
- 每条必须非空：`subLocalId`、`title`、`summary`、`acceptanceCriteria`、`suggestedPrompt`、`dependsOnSubLocalIds`（无前置时 `[]`）。
- 无法确定的依赖勿猜测：在对应子任务 `summary` 中标注「待人工确认」。

## 输出契约（平台会解析）

**只输出一个 JSON 对象**，不要输出 JSON 以外的任何前缀或后缀。

```json
{
  "markdown": "<分层 Markdown：按组列出，每组下嵌套子任务>",
  "items": [
    {
      "localId": "组临时 id，用于 dependsOnLocalIds",
      "title": "小需求/功能组标题",
      "summary": "（必填，非空）",
      "acceptanceCriteria": "（必填，非空）",
      "suggestedPrompt": "（必填，非空）",
      "dependsOnLocalIds": ["前置组的 localId，可为 []"],
      "subTasks": [
        {
          "subLocalId": "全局唯一",
          "title": "子任务标题",
          "summary": "（必填，非空）",
          "acceptanceCriteria": "（必填，非空）",
          "suggestedPrompt": "（必填，非空）",
          "dependsOnSubLocalIds": ["其他子任务的 subLocalId，可为 []"]
        }
      ]
    }
  ]
}
```

- `items` 至少一项；每项必填：`localId`、`title`、`summary`、`acceptanceCriteria`、`suggestedPrompt`、`dependsOnLocalIds`、`subTasks`（非空数组）。
- 请使用契约中的**英文键名**；不要用 `id`/`name` 代替 `localId`/`title`（平台对常见别名有兜底，仍建议一致）。

## CLI stream-json

若使用 stream-json，assistant 消息正文中须包含**可被提取的上述 JSON**（与 `parsePlanJsonFromAgentStdout` 一致）。
