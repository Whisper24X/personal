# AINative Workspace

Monorepo 全栈应用：小程序 + 管理后台 + Go 后端。

## 文档导航

| 文档 | 说明 |
|------|------|
| [ARCHITECTURE](knowledge/ARCHITECTURE.md) | 分层架构与依赖流向 |
| [DESIGN](knowledge/DESIGN.md) | 设计原则与模式 |
| [PLANS](knowledge/PLANS.md) | 执行计划 |
| [PRODUCT_SENSE](knowledge/PRODUCT_SENSE.md) | 产品意图与用户旅程 |
| [QUALITY_SCORE](knowledge/QUALITY_SCORE.md) | 质量评分标准 |
| [RELIABILITY](knowledge/RELIABILITY.md) | 可靠性要求 |
| [SECURITY](knowledge/SECURITY.md) | 安全约束 |
| [SKILLS](knowledge/SKILLS.md) | AI Skills 完整列表 |
| [MEMORY](knowledge/MEMORY.md) | 项目记忆与学习约定 |

子目录覆盖规则见 [AGENTS.override.md](AGENTS.override.md)。

## 人工开发指南

详见 [docs/dev-spec/README.md](docs/dev-spec/README.md)：ainative-app、ainative-shadow、ainative-backend 开发入口。

---

<!-- OPENSPEC:START -->
## OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->
