# OpenSpec 开发规范索引

OpenSpec 相关约束的真源在 [`openspec/specs/openspec-maintenance/spec.md`](../../../openspec/specs/openspec-maintenance/spec.md)；本目录提供工作流摘要与链接。

## 文档

- [workflow.md](./workflow.md) — change 流程、校验命令、AI 读档顺序

## 真源与配置

| 路径 | 用途 |
| --- | --- |
| [`openspec/specs/`](../../../openspec/specs/) | 已实现行为的 SHALL/MUST 规范 |
| [`openspec/design/`](../../../openspec/design/) | 目标架构、runtime gaps |
| [`openspec/config.yaml`](../../../openspec/config.yaml) | AI context、spec 撰写规则 |
| [`openspec/changes/`](../../../openspec/changes/) | 进行中的变更提案与 delta |

## CLI 与 skills

- 校验：`openspec validate --specs --all`（合并涉及 spec 变更的 PR 前）
- 归档：`openspec archive` + skill `openspec-archive-change`
- 归档后叙事同步：skill `openspec-archive-sync-docs`（见 `.cursor/skills/openspec-archive-sync-docs/SKILL.md`）
