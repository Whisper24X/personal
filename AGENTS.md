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

**需求与设计**

| Skill | 用途 |
|-------|------|
| [MRD 文档生成](.cursor/skills/mrd/SKILL.md) | 将需求想法转化为市场需求文档 |
| [PRD 文档生成](.cursor/skills/prd/SKILL.md) | 将 MRD 转换为产品需求文档 |
| [系统设计](.cursor/skills/design/SKILL.md) | 将 PRD 转换为系统设计文档 |
| [原型生成](.cursor/skills/prototype/SKILL.md) | 创建单文件 HTML 原型 |
| [测试计划](.cursor/skills/test/SKILL.md) | 基于 PRD/Design 生成测试计划和用例 |

**后端开发**

| Skill | 用途 |
|-------|------|
| [后端完整流程](.cursor/skills/backend-dev/SKILL.md) | 自动编排 Step 0-7 完整后端开发流程 |
| [前置审计](.cursor/skills/backend-audit/SKILL.md) | 验证开发前置条件、审计工件状态 |
| [数据库表设计](.cursor/skills/backend-database/SKILL.md) | PostgreSQL 表创建/修改/关系设计 |
| [GORM 代码生成](.cursor/skills/backend-gorm/SKILL.md) | 从数据库表生成 GORM 模型、DAO、Repo |
| [Proto 文件生成](.cursor/skills/backend-proto-gen/SKILL.md) | 基于 sqltopb 从表自动生成 Proto |
| [Proto 文件编辑](.cursor/skills/backend-proto-edit/SKILL.md) | 修改 Proto 添加过滤器/验证/业务 RPC |
| [API 代码生成](.cursor/skills/backend-api-gen/SKILL.md) | 从 Proto 生成 Go 代码 |
| [业务逻辑开发](.cursor/skills/backend-codeing/SKILL.md) | Biz/Data/Service/Server 各层实现 |
| [代码质量检查](.cursor/skills/backend-quality/SKILL.md) | Wire、格式化、Lint 检查 |

**前端开发**

| Skill | 用途 |
|-------|------|
| [小程序开发](.cursor/skills/app-dev/SKILL.md) | ainative-app Taro + Vue3 开发规范 |
| [管理后台开发](.cursor/skills/shadow-dev/SKILL.md) | ainative-shadow Vue3 + Element Plus 开发规范 |
| [创建小程序页面](.cursor/skills/create-ainative-app-page/SKILL.md) | 在 ainative-app 中创建新页面 |
| [创建管理后台页面](.cursor/skills/create-ainative-shadow-page/SKILL.md) | 在 ainative-shadow 中创建新页面 |

**构建与部署**

| Skill | 用途 |
|-------|------|
| [小程序构建部署](.cursor/skills/app-build-deploy/SKILL.md) | ainative-app 多环境编译打包部署 |
| [后端构建部署](.cursor/skills/backend-build-deploy/SKILL.md) | ainative-backend Go 服务构建部署 |
| [管理后台构建部署](.cursor/skills/shadow-build-deploy/SKILL.md) | ainative-shadow 管理后台构建部署 |
| [沙箱环境管理](.cursor/skills/sandbox-manage/SKILL.md) | 沙箱环境配置、端口映射、多实例、服务架构、故障排查 |
| [部署环境准备](.cursor/skills/deploy-prepare/SKILL.md) | 部署前环境检查、构建配置验证 |
| [部署执行](.cursor/skills/deploy-execute/SKILL.md) | 执行 sandbox 部署、监控服务启动 |
| [部署验证](.cursor/skills/deploy-verify/SKILL.md) | 验证服务状态、可访问性、生成报告 |

**质量与工具**

| Skill | 用途 |
|-------|------|
| [代码规范检查](.cursor/skills/code-review-ainative/SKILL.md) | 代码质量检查和优化 |
| [自动化测试](.cursor/skills/automation-test/SKILL.md) | 自动化测试规划、脚本生成与执行 |
| [创建后端 API](.cursor/skills/create-ainative-backend-api/SKILL.md) | 在 ainative-backend 中创建新接口 |
| [调试项目问题](.cursor/skills/debug-ainative-projects/SKILL.md) | 全栈问题排查和调试 |
| [代码任务执行](.cursor/skills/code-task-apply/SKILL.md) | 执行 OpenSpec apply 生成代码 |
| [任务完成检查](.cursor/skills/code-task-check/SKILL.md) | 检查 tasks.md 中的任务完成状态 |

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
