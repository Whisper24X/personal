# AINative Workspace

AI 助手在此项目工作的快速入口。文档按渐进式披露组织：先看概览，按需深入。

---

## 项目概览

这是一个 **monorepo**，包含完整的全栈应用套件：

| 子项目 | 类型 | 技术栈 | 开发指南 |
|--------|------|--------|----------|
| **ainative-app** | 跨平台移动端 | uni-app + Vue3 + TypeScript + UnoCSS | [README](docs/dev-spec/ainative-app/README.md) |
| **ainative-pc** | PC 端 Web | Vue3 + Vite + TypeScript + Pinia | [README](docs/dev-spec/ainative-pc/README.md) |
| **ainative-shadow** | 管理后台 | Vue3 + Element Plus + Tailwind CSS | [README](docs/dev-spec/ainative-shadow/README.md) |
| **ainative-backend** | Go 后端服务 | Kratos + GORM + Protobuf | [README](docs/dev-spec/ainative-backend/README.md) |

---

## 快速命令

### ainative-app（移动端）
```bash
cd ainative-app
pnpm install && pnpm dev        # H5 开发
pnpm dev:mp                     # 微信小程序
pnpm lint:fix                   # 代码修复
```

### ainative-shadow（管理后台）
```bash
cd ainative-shadow
pnpm install && pnpm dev        # 开发服务
pnpm build                      # 生产构建
pnpm fix                        # 代码修复
```

### ainative-pc（PC 端）
```bash
cd ainative-pc
pnpm install && pnpm dev        # 开发服务
pnpm build                      # 生产构建
pnpm test:unit                  # 单元测试
```

### ainative-backend（后端）
```bash
cd ainative-backend
make init                       # 安装工具
make gorm TABLES=表名           # 生成 GORM 代码
make api && make protocode      # 生成 API 和骨架代码
make wire && make build         # 依赖注入和构建
```

---

## 开发导航

### 何时阅读什么

| 任务场景 | 推荐阅读 |
|----------|----------|
| 了解整体架构和约定 | [openspec/project.md](openspec/project.md) |
| 开发移动端页面/功能 | [ainative-app 指南](docs/dev-spec/ainative-app/README.md) |
| 开发 PC 端页面/功能 | [ainative-pc 指南](docs/dev-spec/ainative-pc/README.md) |
| 开发管理后台页面 | [ainative-shadow 指南](docs/dev-spec/ainative-shadow/README.md) |
| 开发后端接口/业务逻辑 | [ainative-backend 指南](docs/dev-spec/ainative-backend/README.md) |
| 需要创建变更提案 | [openspec/AGENTS.md](openspec/AGENTS.md) |

### 子项目详细规范

<details>
<summary><b>ainative-app 参考文档</b></summary>

- [项目概览](docs/dev-spec/ainative-app/references/project-overview.md)
- [开发流程](docs/dev-spec/ainative-app/references/development-workflow.md)
- [uni-app 约定](docs/dev-spec/ainative-app/references/uni-app-patterns.md)
- [Vue3 + TypeScript 规范](docs/dev-spec/ainative-app/references/vue-typescript-patterns.md)
- [API 与 HTTP 规范](docs/dev-spec/ainative-app/references/api-http-patterns.md)
- [样式与 CSS 规范](docs/dev-spec/ainative-app/references/styling-css-patterns.md)

</details>

<details>
<summary><b>ainative-pc 参考文档</b></summary>

- [项目概览](docs/dev-spec/ainative-pc/references/project-overview.md)
- [开发流程](docs/dev-spec/ainative-pc/references/development-workflow.md)
- [目录结构](docs/dev-spec/ainative-pc/references/directory-structure.md)
- [路由与状态规范](docs/dev-spec/ainative-pc/references/routing-state.md)
- [API 与数据访问规范](docs/dev-spec/ainative-pc/references/api-patterns.md)
- [样式与资源规范](docs/dev-spec/ainative-pc/references/styling-assets.md)
- [测试规范](docs/dev-spec/ainative-pc/references/testing.md)

</details>

<details>
<summary><b>ainative-shadow 参考文档</b></summary>

- [项目概览](docs/dev-spec/ainative-shadow/references/project-overview.md)
- [开发流程](docs/dev-spec/ainative-shadow/references/development-workflow.md)
- [路由与权限规范](docs/dev-spec/ainative-shadow/references/routing-permission.md)
- [状态管理规范](docs/dev-spec/ainative-shadow/references/state-management.md)
- [API 与 HTTP 规范](docs/dev-spec/ainative-shadow/references/api-http.md)
- [样式与主题规范](docs/dev-spec/ainative-shadow/references/styling-theme.md)
- [国际化规范](docs/dev-spec/ainative-shadow/references/i18n.md)
- [配置与环境变量规范](docs/dev-spec/ainative-shadow/references/configuration.md)

</details>

<details>
<summary><b>ainative-backend 参考文档</b></summary>

**入门必读**
- [架构概览](docs/dev-spec/ainative-backend/references/architecture.md)
- [目录结构](docs/dev-spec/ainative-backend/references/directory.md)

**各层详解**
- [分层编码](docs/dev-spec/ainative-backend/references/layer.md)
- [API 层](docs/dev-spec/ainative-backend/references/layer-api.md)
- [Server 层](docs/dev-spec/ainative-backend/references/layer-server.md)
- [Service 层](docs/dev-spec/ainative-backend/references/layer-service.md)
- [Biz 层](docs/dev-spec/ainative-backend/references/layer-biz.md)
- [Data 层](docs/dev-spec/ainative-backend/references/layer-data.md)

**规范参考**
- [数据库设计](docs/dev-spec/ainative-backend/references/database.md)
- [错误码规范](docs/dev-spec/ainative-backend/references/error-codes.md)
- [Makefile 命令](docs/dev-spec/ainative-backend/references/makefile.md)

</details>

---

## 关键约定速览

### 代码风格
- **前端**：ESLint + Prettier，Vue SFC 使用 `<script setup>` 语法
- **后端**：gofmt + goimports + golangci-lint，遵循洋葱架构

### 命名规范
| 类型 | 规范 | 示例 |
|------|------|------|
| Vue 组件 | PascalCase | `TabbarItem.vue` |
| TypeScript 工具 | camelCase | `useRequest.ts` |
| Go 文件 | snake_case | `app_v1_auth.go` |
| Proto 文件 | snake_case | `sys_admin.proto` |
| 数据库表 | snake_case + 前缀 | `sys_admin` |

### 后端分层架构
```
Server → Service → Biz → Data → Database/Cache
```
- 依赖向内流动
- Biz 层定义接口，Data 层实现
- 业务逻辑放在 Biz 层，不要放在 Service 或 Data 层

### Git 提交规范
使用 Conventional Commits：`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`, `chore`

---
