# ainative 项目 AI 工作流整理总结

## 📋 整理内容概览

本次为 ainative 项目整理了完整的 AI 工作流文档和 Skills,以便 AI Agent 能够更高效地进行迭代开发。

## 🎯 创建的内容

### 1. Skills (5个)

位置: `.cursor/skills/` (项目根目录)

| Skill | 文件路径 | 用途 |
|-------|---------|------|
| **创建小程序页面** | `create-ainative-app-page/SKILL.md` | 在 ainative-app (Taro + Vue3) 中创建新页面,包含完整的开发步骤、代码模板和规范 |
| **创建管理后台页面** | `create-ainative-shadow-page/SKILL.md` | 在 ainative-shadow (Vue3 + Element Plus) 中创建 CRUD 页面,包含列表、表单、API 调用等 |
| **创建后端 API** | `create-ainative-backend-api/SKILL.md` | 在 ainative-backend (Go + Kratos) 中创建新接口,涵盖数据库到 API 的完整流程 |
| **调试项目问题** | `debug-ainative-projects/SKILL.md` | 全栈调试指南,包含前端、后端、联调的问题排查方法 |
| **代码规范检查** | `code-review-ainative/SKILL.md` | 代码质量检查和修复,包含 ESLint、TypeScript、Go Lint 等 |

### 2. 开发指南文档 (2个)

位置: `/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/`

| 文档 | 文件路径 | 用途 |
|-----|---------|------|
| **AI 开发入口指南** | `AI-GUIDE.md` | AI Agent 的快速入门指南,包含 Skills 索引、常见任务指引、开发规范总结 |
| **AI 工作流详细指南** | `AI-WORKFLOW-GUIDE.md` | 完整的 AI 开发工作流,包含任务流程、规范说明、命令速查、最佳实践 |

### 3. 更新的文档

- **AGENTS.md**: 添加了 AI 开发指南部分,方便 AI Agent 快速定位资源

## 📚 文档结构

```
ainative 项目
├── AGENTS.md (入口 - 已更新)
│   ├── 🤖 AI 开发指南
│   └── 📚 人工开发指南
│
├── docs/dev-spec/
│   ├── AI-GUIDE.md (AI 快速入门)
│   ├── AI-WORKFLOW-GUIDE.md (AI 详细工作流)
│   │
│   ├── ainative-app/ (小程序开发指南)
│   │   ├── README.md
│   │   └── references/*.md
│   │
│   ├── ainative-shadow/ (管理后台开发指南)
│   │   ├── README.md
│   │   └── references/*.md
│   │
│   └── ainative-backend/ (后端开发指南)
│       ├── README.md
│       └── references/*.md
│
└── .cursor/skills/ (AI Skills)
    ├── create-ainative-app-page/
    ├── create-ainative-shadow-page/
    ├── create-ainative-backend-api/
    ├── debug-ainative-projects/
    └── code-review-ainative/
```

## 🚀 如何使用

### 对于 AI Agent

1. **开始工作前**:
   - 阅读 `AGENTS.md` 了解项目概览
   - 阅读 `docs/dev-spec/AI-GUIDE.md` 快速入门
   - 需要详细流程时查看 `docs/dev-spec/AI-WORKFLOW-GUIDE.md`

2. **执行具体任务**:
   - 创建小程序页面 → 使用 `create-ainative-app-page` Skill
   - 创建管理后台页面 → 使用 `create-ainative-shadow-page` Skill
   - 创建后端 API → 使用 `create-ainative-backend-api` Skill
   - 调试问题 → 使用 `debug-ainative-projects` Skill
   - 代码检查 → 使用 `code-review-ainative` Skill

3. **查找信息**:
   - 项目规范 → 查看各子项目的 `references/` 目录
   - 命令速查 → 查看 `AI-WORKFLOW-GUIDE.md` 中的命令部分
   - 常见问题 → 查看各 Skill 中的 FAQ 部分

### 对于人工开发者

1. 继续使用现有的开发指南:
   - `docs/dev-spec/ainative-app/README.md`
   - `docs/dev-spec/ainative-shadow/README.md`
   - `docs/dev-spec/ainative-backend/README.md`

2. 也可以参考 AI 工作流文档,其中包含了很多有用的开发流程和最佳实践

## 💡 核心特性

### 1. 完整的工作流覆盖

每个 Skill 都包含:
- ✅ 明确的使用场景和触发条件
- ✅ 分步骤的详细操作指南
- ✅ 完整的代码模板和示例
- ✅ 关键规范和注意事项
- ✅ 常见问题和解决方案
- ✅ 相关文档链接

### 2. 项目特点适配

- **ainative-app**: Taro + Vue3 跨平台开发,支持小程序和 H5
- **ainative-shadow**: Vue3 + Element Plus 企业级管理后台
- **ainative-backend**: Go + Kratos 微服务,使用 Proto 定义接口

### 3. 自动化工具整合

- **后端**: Makefile 自动生成 GORM、Proto、API 代码
- **前端**: ESLint、Prettier、TypeScript 自动检查和修复
- **全栈**: Git hooks 自动化代码质量检查

### 4. 最佳实践总结

- 命名规范 (前端 camelCase/PascalCase, 后端 Go 风格)
- 文件组织 (按功能模块组织)
- 错误处理 (统一的错误码和错误提示)
- 代码注释 (JSDoc/GoDoc 风格)
- Git 提交规范 (Conventional Commits)

## 📊 各 Skill 详细说明

### Skill 1: create-ainative-app-page

**适用场景**: 在小程序中添加新页面或功能

**核心流程**:
```
需求分析 → 定义 API 类型 → 创建页面文件 → 编写页面配置 
→ 实现页面组件 → 添加路由 → 状态管理(可选) → 测试验证
```

**关键内容**:
- Taro 生命周期和 API 使用
- UnoCSS 原子类样式
- 跨平台开发注意事项
- 页面配置和路由
- Pinia 状态管理

### Skill 2: create-ainative-shadow-page

**适用场景**: 在管理后台添加 CRUD 功能

**核心流程**:
```
需求分析 → 定义 API 类型 → 实现 API 调用 → 创建页面结构
→ 实现列表页面 → 创建表单弹窗 → 配置路由 → 添加权限 → 测试
```

**关键内容**:
- CommonTable 组件使用
- Element Plus 表单和表格
- API 请求和错误处理
- 权限控制 (v-auth 指令)
- 路由和菜单配置

### Skill 3: create-ainative-backend-api

**适用场景**: 创建新的后端 API 接口

**核心流程**:
```
需求分析 → 数据库表设计 → 生成 GORM 代码 → 生成 Proto 文件
→ 编写 Proto 定义 → 生成 API 代码 → 生成骨架代码
→ 实现 Data 层 → 实现 Biz 层 → 实现 Service 层 
→ 注册服务 → 生成依赖注入 → 测试
```

**关键内容**:
- Makefile 自动化命令
- Proto 文件编写和校验
- 洋葱架构分层实现
- GORM 数据访问
- Wire 依赖注入
- 错误处理和日志

### Skill 4: debug-ainative-projects

**适用场景**: 排查和修复项目中的问题

**核心流程**:
```
确定问题类型 → 复现问题 → 查看日志/错误信息
→ 定位问题代码 → 分析原因 → 修复代码 → 验证修复
```

**关键内容**:
- 前端调试 (Console, Network, Vue Devtools)
- 后端调试 (日志, 数据库, Postman)
- 全栈联调流程
- 常见错误及解决方案
- 调试工具和技巧

### Skill 5: code-review-ainative

**适用场景**: 代码提交前的质量检查

**核心流程**:
```
运行 Lint 检查 → 修复规范问题 → 类型检查
→ 格式化代码 → 安全检查 → 代码审查 → 提交代码
```

**关键内容**:
- ESLint/Go Lint 使用
- TypeScript 类型检查
- 代码格式化 (Prettier/gofmt)
- 命名和注释规范
- Git Commit 规范
- 代码审查 Checklist

## 🎓 使用示例

### 场景 1: 创建一个商品管理功能 (全栈)

**AI Agent 工作流**:

1. 阅读 `AI-WORKFLOW-GUIDE.md` 中的"任务 1: 新增功能模块"
2. 后端开发:
   - 使用 `create-ainative-backend-api` Skill
   - 创建数据库表 `product`
   - 生成 GORM 代码和 Proto 文件
   - 实现三层业务逻辑
3. 管理后台开发:
   - 使用 `create-ainative-shadow-page` Skill
   - 创建商品列表页面
   - 实现 CRUD 操作
4. 测试和提交:
   - 使用 `code-review-ainative` Skill 检查代码
   - 本地测试功能
   - 提交代码

### 场景 2: 修复一个订单计算错误

**AI Agent 工作流**:

1. 使用 `debug-ainative-projects` Skill
2. 定位问题:
   - 查看前端 Console 错误
   - 检查后端日志
   - 复现问题
3. 修复问题:
   - 找到计算逻辑所在文件
   - 修正计算公式
   - 添加单元测试
4. 验证和提交:
   - 测试修复是否生效
   - 运行 `code-review-ainative` 检查
   - 提交代码

## 📝 维护建议

### 定期更新

1. **当项目架构变化时**:
   - 更新 `AI-WORKFLOW-GUIDE.md` 中的流程
   - 更新相关 Skills 的步骤

2. **当技术栈升级时**:
   - 更新命令和配置
   - 更新代码示例

3. **当发现新的常见问题时**:
   - 添加到 FAQ 部分
   - 更新调试 Skill

### 扩展建议

可以继续添加的 Skills:

1. **部署相关**:
   - `deploy-ainative-app` - 小程序发布
   - `deploy-ainative-shadow` - 前端部署
   - `deploy-ainative-backend` - 后端部署

2. **性能优化**:
   - `optimize-frontend-performance` - 前端性能优化
   - `optimize-backend-performance` - 后端性能优化
   - `optimize-database-queries` - 数据库查询优化

3. **测试相关**:
   - `write-unit-tests` - 编写单元测试
   - `write-e2e-tests` - 编写端到端测试

4. **数据相关**:
   - `database-migration` - 数据库迁移
   - `data-import-export` - 数据导入导出

## ✅ 验证清单

使用这套文档和 Skills,AI Agent 应该能够:

- [x] 快速了解项目结构和技术栈
- [x] 独立完成新功能开发 (前后端)
- [x] 排查和修复常见问题
- [x] 遵循项目代码规范
- [x] 找到需要的文档和参考
- [x] 使用自动化工具提高效率
- [x] 理解项目的分层架构
- [x] 正确处理错误和异常
- [x] 编写符合规范的代码
- [x] 进行代码质量检查

## 🔗 相关链接

### 项目文档
- [AGENTS.md](/Users/moyan/myWorkPlace/yanxue-main/AGENTS.md)
- [AI-GUIDE.md](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/AI-GUIDE.md)
- [AI-WORKFLOW-GUIDE.md](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/AI-WORKFLOW-GUIDE.md)

### Skills 目录
- [Skills 根目录](/Users/moyan/.cursor/skills-yanxue/)

### 子项目文档
- [ainative-app 开发指南](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-app/README.md)
- [ainative-shadow 开发指南](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-shadow/README.md)
- [ainative-backend 开发指南](/Users/moyan/myWorkPlace/yanxue-main/docs/dev-spec/ainative-backend/README.md)

---

**整理完成时间**: 2026-01-27

**整理内容**: 5 个 Skills + 2 个工作流指南文档 + 1 个入口文档更新

**目标**: 让 AI 工作流能够高效、规范地进行 ainative 项目的迭代开发
