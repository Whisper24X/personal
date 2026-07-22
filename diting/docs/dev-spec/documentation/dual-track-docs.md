# 双轨文档维护

本文用 procedural 写法归纳 [`openspec-maintenance`](../../../openspec/specs/openspec-maintenance/spec.md) 的核心义务。条文冲突时以 spec 为准。

## 分工

| 层级 | 路径 | 用途 |
| --- | --- | --- |
| 规范约束 | `openspec/specs/<capability>/spec.md` | 已实现行为的 SHALL/MUST + Scenario |
| 叙事/参考 | `docs/architecture/diting-*.md` | 人类阅读、API/Schema/运维步骤 |
| 目标/差距 | `openspec/design/`、`docs/architecture/diting-open-tasks.md` | 未实现能力、roadmap |
| 开发规范导航 | `docs/dev-spec/` | 索引与短文（本目录） |

**冲突优先级**：与 spec 不一致时，以 **openspec/specs** 为工程约束优先。

## 贡献者义务

### 新增或修改已实现行为

1. 在对应 `openspec/specs/<capability>/spec.md` 中编写或更新 Requirement（含至少一个 `#### Scenario`）。
2. 评估是否同步更新对应的 `docs/architecture/diting-*.md`（可在同 PR 或后续 PR）。
3. 合并前若变更了 spec 结构，运行 `openspec validate --specs --all`。

### 仅规划、未实现的能力

- 写入 `openspec/design/` 或 `diting-open-tasks.md`。
- **不得** 以 SHALL/MUST 写入 main spec。

### OpenSpec change 归档

- 完成 `openspec/changes/<name>/` 并 archive 时，评估 delta 是否合并到 `openspec/specs/`。
- main spec 已合并后，使用 skill **`openspec-archive-sync-docs`** 同步 `docs/architecture/diting-*.md` 与根 `README.md` Changelog（用户明确跳过除外）。

### README 链接

- 根 `README.md` 继续指向 `docs/architecture/diting-*.md` 作为叙事入口；工程规范入口见 [`docs/dev-spec/README.md`](../README.md)。

## 对照表

各 capability 与 architecture 文档的对照见 [`docs/architecture/index.md`](../../architecture/index.md) 中「原文档 ↔ OpenSpec 对照」一节。
