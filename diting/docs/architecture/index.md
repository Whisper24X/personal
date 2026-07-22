# diting 架构文档索引

本文档为 **双轨导航**：保留 [`README.md`](../../README.md) 中的叙事文档入口，并指向 OpenSpec 工程规范。

## 文档分工

| 层级 | 路径 | 用途 |
| --- | --- | --- |
| 开发规范导航 | [docs/dev-spec/README.md](../dev-spec/README.md) | Git、OpenSpec、文档、插件、工作流、测试等索引与短文 |
| 叙事/参考 | `docs/architecture/diting-*.md` | 人类阅读、详细 API/Schema/运维步骤 |
| 规范约束 | `openspec/specs/<capability>/spec.md` | SHALL/MUST + Scenario，供 AI 与代码审查 |
| 目标/差距 | `openspec/design/*.md` | 目标架构摘要、runtime gaps |
| 待办 | [diting-open-tasks.md](./diting-open-tasks.md) | P0/P1 实现清单 |
| 方案（已实现） | [diting-multi-repo-spec-workflow.md](./diting-multi-repo-spec-workflow.md) | 多仓 + spec 文档 + 预检 + PR 工作流 |

与 spec 不一致时，以 **openspec/specs** 为工程约束真源。

归档 OpenSpec change 并合并 spec 后，使用 skill **`openspec-archive-sync-docs`** 同步本目录下 `diting-*.md` 与根目录 `README.md`（见 `.cursor/skills/openspec-archive-sync-docs/SKILL.md`）。

## 原文档 ↔ OpenSpec 对照

| 参考文档 | OpenSpec Spec | Design 摘要 |
| --- | --- | --- |
| [diting-architecture-description.md](./diting-architecture-description.md) | [overview](../../openspec/specs/overview/spec.md) | [target-architecture.md](../../openspec/design/target-architecture.md) |
| [diting-product-plan.md](./diting-product-plan.md) | — | Agent 层实施计划 |
| [diting-technical-design.md](./diting-technical-design.md) | 见下表各 capability | [runtime-gaps.md](../../openspec/design/runtime-gaps.md)、[module-map.md](../../openspec/design/module-map.md) |
| [diting-api.md](./diting-api.md) | [http-api](../../openspec/specs/http-api/spec.md) | target-architecture §10 |
| [diting-database-schema.md](./diting-database-schema.md) | [persistence](../../openspec/specs/persistence/spec.md) | target-architecture §9 |
| [diting-config.md](./diting-config.md) | [configuration](../../openspec/specs/configuration/spec.md) | — |
| [diting-plugin-development.md](./diting-plugin-development.md) | [plugins](../../openspec/specs/plugins/spec.md) | target-architecture §5.11 |
| [diting-agent-architecture.md](./diting-agent-architecture.md) | — | Agent 层重构方案 |
| [diting-product-agent-usage.md](./diting-product-agent-usage.md) | [configuration](../../openspec/specs/configuration/spec.md)、[task-lifecycle](../../openspec/specs/task-lifecycle/spec.md)、[human-intervention](../../openspec/specs/human-intervention/spec.md) | 产品 Agent 使用手册 |
| — | [task-lifecycle](../../openspec/specs/task-lifecycle/spec.md) | target-architecture §7.3 |
| — | [scheduler](../../openspec/specs/scheduler/spec.md) | target-architecture §7.4–7.5 |
| — | [execution-orchestration](../../openspec/specs/execution-orchestration/spec.md) | target-architecture §7.7 |
| — | [repair-loop](../../openspec/specs/repair-loop/spec.md) | target-architecture §7.9 |
| — | [human-intervention](../../openspec/specs/human-intervention/spec.md) | target-architecture §7.10 |
| — | [observability](../../openspec/specs/observability/spec.md) | target-architecture §7.12 |
| — | [governance](../../openspec/specs/governance/spec.md) | target-architecture §7.13 |
| — | [openspec-maintenance](../../openspec/specs/openspec-maintenance/spec.md) | — |

## 运维与开发（无独立 spec）

| 文档 | 说明 |
| --- | --- |
| [diting-local-dev.md](./diting-local-dev.md) | 本地开发与联调 |
| [diting-workspace-git-management.md](./diting-workspace-git-management.md) | 使用 diting 开发多项目时的 workspace Git 管理方案 |
| [diting-deployment.md](./diting-deployment.md) | 生产部署 |
| [diting-ops.md](./diting-ops.md) | 运维与排障 |
| [diting-open-tasks.md](./diting-open-tasks.md) | 未完成任务清单 |
