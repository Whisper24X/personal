# Capability 同步参考

## Delta → 叙事章节速查

| Delta 关键词 | 建议更新的 diting-*.md 章节 |
| --- | --- |
| `/api/`、endpoint、SSE | `diting-api.md` 对应 ## 节 |
| `DATABASE_`、`schema`、`migration` | `diting-database-schema.md` |
| `DITING_`、`env`、校验 | `diting-config.md` |
| `plugin`、`createPlugin`、`kind` | `diting-plugin-development.md` |
| `status`、`transition`、`queue` | `diting-technical-design.md` § State Model |
| `scheduler`、`agent`、`heartbeat` | `diting-technical-design.md` + `diting-api.md` § Agents |
| `Goal Loop`、`repair`、`WORKFLOW_PROMPTS` | `diting-technical-design.md` |
| `needs_human`、`recover`、`blocked` | `diting-api.md` § Tasks |
| `logs/`、observability、trace | `diting-api.md` + `diting-config.md` § 日志落盘 |
| `GOVERNANCE_`、脱敏、diff 阈值 | `diting-config.md` § 治理 |

## README 章节锚点

| README 小节 | 典型同步内容 |
| --- | --- |
| 文首段落 | 定位、默认库路径、技术栈一句 |
| 内置插件栈表格 | 插件 id/kind/说明变更 |
| 文档 | 仅追加链接，不删 `docs/architecture/diting-*.md` |
| 常用命令 | 新 npm script |
| Changelog | 每次 archive 对外可见变更 |

## design.md 触发 openspec/design 更新

若 change 的 `design.md` 标明目标架构或差距变化：

- 关闭差距 → 编辑 `openspec/design/runtime-gaps.md`
- 模块/协作变化 → 编辑 `openspec/design/module-map.md`
- 目标态摘要变化 → 编辑 `openspec/design/target-architecture.md`

不自动改 `diting-architecture-description.md` 全文（1200+ 行）；仅当 overview capability 有 MODIFIED 且涉及 §2–3 时摘录更新该文档相应小节。
