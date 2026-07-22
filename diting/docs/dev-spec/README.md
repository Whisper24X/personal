# 开发规范（Dev Specs）

本目录是 diting 仓库**开发约束的导航入口**：按领域拆分为独立文档，各子目录的 `README.md` 作为索引。规范真源与长文参考仍保留在 `openspec/specs/`、`docs/architecture/` 等路径，此处提供索引与可独立阅读的短文。

## 领域

| 领域 | 索引 | 说明 |
| --- | --- | --- |
| 仓库与 Git | [repo/README.md](./repo/README.md) | `husky`、`commitlint`、根 `quality-gate` |
| OpenSpec | [openspec/README.md](./openspec/README.md) | change 流程、校验、AI 读档顺序 |
| 文档维护 | [documentation/README.md](./documentation/README.md) | 双轨文档分工与 PR 同步义务 |
| 插件 | [plugins/README.md](./plugins/README.md) | 实现侧最小约束（真源见 spec + 架构长文） |
| 工作流提示词 | [workflow-prompts/README.md](./workflow-prompts/README.md) | spec 工作区可选 `WORKFLOW_PROMPTS` 约定 |
| 测试与门禁 | [testing/README.md](./testing/README.md) | 本地 `npm test` 与提交前校验 |

## 不在此目录的真源

- **已实现行为**：[`openspec/specs/`](../../openspec/specs/)（SHALL/MUST + Scenario）
- **叙事与运维**：[`docs/architecture/`](../architecture/index.md)
- **目标与差距**：[`openspec/design/`](../../openspec/design/)、[`diting-open-tasks.md`](../architecture/diting-open-tasks.md)
- **Agent 操作手册**：`.cursor/skills/openspec-*`（执行步骤，非规范正文）

与 spec 冲突时，以 **openspec/specs** 为工程约束优先。
