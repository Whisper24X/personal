# AINative Workspace

Monorepo 全栈应用：移动端 + 管理后台 + Go 后端。

## 🤖 AI 开发指南

**如果你是 AI Agent,请优先阅读**:
- **[AI 开发入口指南](docs/dev-spec/AI-GUIDE.md)** - AI 工作流快速开始
- **[AI 工作流详细指南](docs/dev-spec/AI-WORKFLOW-GUIDE.md)** - 完整的 AI 开发流程

### 可用 AI Skills

| Skill | 用途 |
|-------|------|
| [创建小程序页面](.cursor/skills/create-ainative-app-page/SKILL.md) | 在 ainative-app 中创建新页面 |
| [创建管理后台页面](.cursor/skills/create-ainative-shadow-page/SKILL.md) | 在 ainative-shadow 中创建新页面 |
| [创建后端 API](.cursor/skills/create-ainative-backend-api/SKILL.md) | 在 ainative-backend 中创建新接口 |
| [调试项目问题](.cursor/skills/debug-ainative-projects/SKILL.md) | 问题排查和调试 |
| [代码规范检查](.cursor/skills/code-review-ainative/SKILL.md) | 代码质量检查和优化 |

## 📚 人工开发指南

| 子项目 | 入口 |
|--------|------|
| ainative-app | [开发指南](docs/dev-spec/ainative-app/README.md) |
| ainative-pc | [开发指南](docs/dev-spec/ainative-pc/README.md) |
| ainative-shadow | [开发指南](docs/dev-spec/ainative-shadow/README.md) |
| ainative-backend | [开发指南](docs/dev-spec/ainative-backend/README.md) |

详细导航见 [docs/dev-spec/readme.md](docs/dev-spec/readme.md)

---

<!-- OPENSPEC:START -->
# OpenSpec Instructions

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
