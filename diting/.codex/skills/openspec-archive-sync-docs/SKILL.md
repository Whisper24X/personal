---
name: openspec-archive-sync-docs
description: >-
  After OpenSpec archive or main-spec sync, update docs/architecture narrative
  docs and README to match merged specs. Use when archiving a change, syncing
  delta specs to openspec/specs, or when the user asks to align diting-*.md
  with specs after /opsx:archive.
license: MIT
compatibility: Requires openspec CLI; Titing dual-track docs layout.
metadata:
  author: diting
  version: "1.0"
---

# OpenSpec 归档后同步叙事文档

在 **main spec 已合并**（archive 前 sync delta，或 archive 后手动改 spec）之后执行。将 `openspec/specs/` 中的行为约束反映到 `docs/architecture/diting-*.md` 与 `README.md`，保持双轨一致。

**不要**把 SHALL/Scenario 全文粘贴进叙事文档；叙事层用说明性中文 + 表格/列表，专有名词与路径保留英文。

## 何时执行

- `openspec-archive-change` 在 spec sync 完成后 **必须** 调用本 skill（除非用户明确跳过叙事同步）
- 用户单独要求「归档后更新架构文档 / README」

## 输入

- `change-name`：已归档或即将归档的 change 名（用于读 `openspec/changes/<name>/` 或 `openspec/changes/archive/YYYY-MM-DD-<name>/`）
- **受影响 capability 列表**：来自 delta spec 目录、`proposal.md` 的 Capabilities 节，或 `git diff openspec/specs/` 的目录名

若无法确定受影响范围，读取 change 的 `proposal.md`、`design.md` 与 `openspec/changes/<name>/specs/`（或 archive 路径）。

## Capability → 叙事文档映射

| Capability | 优先更新的叙事文档 |
| --- | --- |
| `overview` | `diting-architecture-description.md`（§2–3 摘录）、`README.md`（定位/Changelog） |
| `http-api` | `diting-api.md` |
| `persistence` | `diting-database-schema.md` |
| `configuration` | `diting-config.md` |
| `plugins` | `diting-plugin-development.md`、`diting-technical-design.md`（Plugin 节） |
| `task-lifecycle` | `diting-technical-design.md`（State Model） |
| `scheduler` | `diting-technical-design.md`、`diting-api.md`（Agents） |
| `execution-orchestration` | `diting-technical-design.md`（Goal Loop、Workflow） |
| `repair-loop` | `diting-technical-design.md`（Goal Loop stop conditions） |
| `human-intervention` | `diting-api.md`（needs-human/recover） |
| `observability` | `diting-api.md`、`diting-config.md`（日志落盘） |
| `governance` | `diting-config.md`（治理 env） |
| `openspec-maintenance` | `docs/architecture/index.md`（仅当分工或索引变化） |

运维类（无 spec）：`diting-local-dev.md`、`diting-deployment.md`、`diting-ops.md` — 仅当 change 的 `design.md` / `tasks.md` 明确涉及运维步骤时更新。

完整对照见 [docs/architecture/index.md](../../docs/architecture/index.md)。

## 工作流

### 1. 收集变更事实

1. 读取每个受影响 capability 的 `openspec/specs/<capability>/spec.md`（合并后的真源）。
2. 若有 change 目录，对比 delta spec 与 `proposal.md` 的 **What Changes**，列出 ADDED/MODIFIED/REMOVED 要点。
3. 必要时 `git diff` 实现代码，确认叙事与实现一致。

### 2. 更新 docs/architecture

对每个映射到的 `diting-*.md`：

1. **定位章节**：用文档内标题搜索相关主题（API 路径、env 表、状态名、插件 kind）。
2. **增量编辑**：只改与本次 capability 相关的段落；更新「更新日期」为当天（`YYYY-MM-DD`）。
3. **风格**：正文中文；`GET /api/...`、环境变量、代码路径保持英文；API 示例 JSON 保持有效。
4. **冲突**：叙事与 spec 不一致时 **以 spec 为准** 改叙事。
5. **open-tasks**：若 `tasks.md` 中已完成项对应 open-tasks 条目，在 `diting-open-tasks.md` 将 `- [ ]` 改为 `- [x]`（仅明确完成的项）。
6. **runtime-gaps**：若本次 change 关闭 `openspec/design/runtime-gaps.md` 中的差距，删除或标注「已关闭」并链到 change/archive 名。
7. **不删除文件**；不重命名 `diting-*.md`。

### 3. 更新 README.md

仅在**用户可感知**变更时修改（不要为内部重构改 README）：

| 变更类型 | README 位置 |
| --- | --- |
| 新/改 HTTP API、SSE | 「文档」链接说明或 Changelog |
| 新环境变量、默认值 | Changelog；必要时「如何新增插件」旁注 |
| 新 npm 脚本、迁移命令 | 「常用命令」或 Changelog |
| 插件栈、技术栈、定位 | 文首概要、内置插件表、Changelog |
| 新文档路径 | 「文档」列表（**保留**现有 `docs/architecture/` 链接，只追加） |

Changelog 格式（与现有 README 一致）：

```markdown
### YYYY-MM-DD
- **<领域>**：<一句话说明>
```

可选：在「文档」小节末尾追加一行工程规范入口（不替换原链接）：

```markdown
工程规范（OpenSpec）：见 [架构索引](./docs/architecture/index.md) 与 `openspec/specs/`。
```

### 4. 校验

```bash
openspec validate --specs --all
```

人工检查：

- [ ] 受影响 `diting-*.md` 已更新且日期刷新
- [ ] README Changelog 或命令/文档列表已反映对外变更
- [ ] `docs/architecture/index.md` 对照表仍正确（仅索引结构变化时改）
- [ ] 未把未实现能力写成「已实现」（仍应在 open-tasks 或 runtime-gaps）

### 5. 输出摘要

```
## 叙事文档同步完成

**Change:** <change-name>
**Specs touched:** <capability list>

**Updated:**
- docs/architecture/diting-*.md: ...
- README.md: Changelog / 文档 / 命令（或无变更）

**Skipped:** <文件> — <原因>
```

## 与 archive 的衔接

在 `openspec-archive-change` 中，用户选择 **Sync specs** 且合并完成后：

1. 立即执行本 skill（同一会话，无需用户二次发起）。
2. 若用户选择 **Archive without syncing specs**，询问是否仍同步叙事文档（通常 **否**，除非 main spec 已在别处置更新）。

Archive **之后** change 目录位于 `openspec/changes/archive/YYYY-MM-DD-<name>/`，仍可读取 proposal/design/tasks 做同步。

## 禁止事项

- 不要修改 `openspec/specs/` 来迁就错误的叙事文档（spec 优先）
- 不要把 `diting-open-tasks.md` 中未完成项标为 `[x]`
- 不要删除或移动 `docs/architecture/diting-*.md`
- 不要编辑 plan 文件（`.cursor/plans/`）

## 延伸阅读

- 双轨分工：`openspec/specs/openspec-maintenance/spec.md`
- 能力映射详表：[reference.md](reference.md)
