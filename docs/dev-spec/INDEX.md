# ainative 项目文档索引

## 🤖 AI 开发相关

### 快速开始
1. **[AGENTS.md](../../AGENTS.md)** - 项目入口,包含 AI 和人工开发指南的索引
2. **[AI-GUIDE.md](AI-GUIDE.md)** - AI Agent 快速入门指南
3. **[AI-WORKFLOW-GUIDE.md](AI-WORKFLOW-GUIDE.md)** - 完整的 AI 工作流程

### AI Skills
所有 Skills 位于: `.cursor/skills/` (项目根目录)

| Skill | 说明 |
|-------|------|
| `create-ainative-app-page` | 创建小程序页面 |
| `create-ainative-shadow-page` | 创建管理后台页面 |
| `create-ainative-backend-api` | 创建后端 API |
| `debug-ainative-projects` | 调试项目问题 |
| `code-review-ainative` | 代码规范检查 |

### 整理总结
- **[AI-SETUP-SUMMARY.md](AI-SETUP-SUMMARY.md)** - 本次整理的详细说明和使用指南

## 📱 ainative-app (小程序)

### 核心文档
- **[README.md](ainative-app/README.md)** - 开发指南入口

### 详细规范
- [项目概览](ainative-app/references/project-overview.md)
- [开发流程](ainative-app/references/development-workflow.md)
- [uni-app 约定](ainative-app/references/uni-app-patterns.md)
- [Vue3 + TypeScript 规范](ainative-app/references/vue-typescript-patterns.md)
- [API 与 HTTP 规范](ainative-app/references/api-http-patterns.md)
- [样式与 CSS 规范](ainative-app/references/styling-css-patterns.md)

## 💻 ainative-shadow (管理后台)

### 核心文档
- **[README.md](ainative-shadow/README.md)** - 开发指南入口

### 详细规范
- [架构概览](ainative-shadow/references/architecture.md)
- [开发环境](ainative-shadow/references/dev-environment.md)
- [API 调用规范](ainative-shadow/references/api-http.md)
- [API 类型定义](ainative-shadow/references/api-types.md)
- [状态管理规范](ainative-shadow/references/state-management.md)
- [组件开发规范](ainative-shadow/references/component-development.md)
- [路由配置规范](ainative-shadow/references/router-config.md)
- [核心 Hooks](ainative-shadow/references/core-hooks.md)
- [核心组件库](ainative-shadow/references/core-components.md)
- [样式开发规范](ainative-shadow/references/styling-theme.md)
- [配置管理](ainative-shadow/references/configuration.md)
- [国际化](ainative-shadow/references/i18n.md)

## 🔧 ainative-backend (后端)

### 核心文档
- **[README.md](ainative-backend/README.md)** - 开发指南入口

### 详细规范
- [架构概览](ainative-backend/references/architecture.md)
- [目录结构](ainative-backend/references/directory.md)
- [数据库设计](ainative-backend/references/database.md)
- [分层编码](ainative-backend/references/layer.md)
- [错误码规范](ainative-backend/references/error-codes.md)

### 各层详解
- [API 层](ainative-backend/references/layer-api.md)
- [Server 层](ainative-backend/references/layer-server.md)
- [Service 层](ainative-backend/references/layer-service.md)
- [Biz 层](ainative-backend/references/layer-biz.md)
- [Data 层](ainative-backend/references/layer-data.md)

### 工具参考
- [Makefile 命令](ainative-backend/references/makefile.md)

## 📖 其他文档

- **[readme.md](readme.md)** - 开发规范导航总览

## 🔍 如何使用此索引

### 我是 AI Agent

1. **首次使用**: 按顺序阅读
   - AGENTS.md → AI-GUIDE.md → AI-WORKFLOW-GUIDE.md

2. **执行任务**: 根据任务类型选择对应的 Skill
   - 创建页面/功能 → 选择对应项目的 create Skill
   - 遇到问题 → 使用 debug Skill
   - 提交代码前 → 使用 code-review Skill

3. **查找规范**: 根据项目和主题查找对应的 references 文档

### 我是人工开发者

1. **快速开始**: 查看对应子项目的 README.md
2. **详细规范**: 根据需要查看 references 目录下的文档
3. **参考 AI 文档**: AI 工作流文档也包含了很多有用的开发流程和最佳实践

## 📊 文档层级结构

```
docs/dev-spec/
│
├── 📄 INDEX.md (本文件)
├── 📄 readme.md (总览)
│
├── 🤖 AI 相关
│   ├── AI-GUIDE.md (入门)
│   ├── AI-WORKFLOW-GUIDE.md (详细)
│   └── AI-SETUP-SUMMARY.md (总结)
│
├── 📱 ainative-app/
│   ├── README.md
│   └── references/
│       └── *.md
│
├── 💻 ainative-shadow/
│   ├── README.md
│   └── references/
│       └── *.md
│
└── 🔧 ainative-backend/
    ├── README.md
    └── references/
        └── *.md
```

## 🔗 外部资源

### 技术栈文档
- [Taro 文档](https://taro-docs.jd.com/)
- [Vue 3 文档](https://cn.vuejs.org/)
- [Element Plus 文档](https://element-plus.org/)
- [Go 官方文档](https://go.dev/doc/)
- [Kratos 框架](https://go-kratos.dev/)
- [GORM 文档](https://gorm.io/)

### 工具文档
- [TypeScript 手册](https://www.typescriptlang.org/zh/docs/)
- [ESLint 文档](https://eslint.org/)
- [Prettier 文档](https://prettier.io/)

---

**提示**: 使用 Ctrl/Cmd + F 在本文件中搜索关键词快速定位文档
