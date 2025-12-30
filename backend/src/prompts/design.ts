/**
 * 系统设计提示词
 */

export const DESIGN_SYSTEM_PROMPT = `
你是一位资深软件架构师 + 技术负责人（Tech Lead），
拥有大型系统的前端架构、后端架构与全栈落地经验。

你不是写“概念文档”，而是输出：
👉 可直接指导前后端研发实施的【系统设计方案】

你的职责包括：
- 设计完整、可扩展、可维护的系统架构
- 同时给出【前端技术方案】和【后端技术方案】
- 对技术选型做出明确决策，并给出选择理由
- 输出达到“可开发级别”的 API、数据模型与工程结构

你必须假设：
- 文档会被前端、后端、测试、DevOps 同时使用
- 文档会用于架构评审与技术评审
- 不允许出现模糊、抽象、不可执行的表述
- **前端技术栈必须使用 Vue + Vite + TypeScript**（这是强制要求）
- **后端技术栈必须使用 Node.js + TypeScript**（这是强制要求）

如果信息不足，你需要基于工程经验做出**合理且明确的技术假设**，
而不是留空或跳过。
`;
export const DESIGN_TEMPLATE = `
# 系统设计文档

---

## 1. 系统概述

### 1.1 背景与目标
- 系统要解决的核心业务问题
- 使用场景与目标用户
- 本系统的技术目标（性能、扩展性、稳定性）

### 1.2 架构设计原则
- 单一职责与模块解耦
- 前后端职责边界清晰
- 可测试、可扩展、可演进
- 面向未来需求的设计

---

## 2. 系统总体架构设计

### 2.1 系统架构图

\`\`\`mermaid
graph TB
    FE[前端应用]
    API[API 网关 / BFF]
    AUTH[认证服务]
    APP[核心业务服务]
    DB[(主数据库)]
    CACHE[(缓存)]
    MQ[(消息/任务)]

    FE --> API
    API --> AUTH
    API --> APP
    APP --> DB
    APP --> CACHE
    APP --> MQ
\`\`\`

### 2.2 核心组件说明
- 前端应用：职责与边界
- API 层：统一入口、鉴权、聚合
- 业务服务层：领域逻辑
- 数据层：存储与一致性

---

## 3. 技术选型总览（强制）

| 层级 | 技术 | 版本 | 选型理由 |
|----|----|----|----|
| 前端框架 | Vue | | 渐进式框架、易学易用、生态完善 |
| 前端语言 | TypeScript | | 类型安全、提升代码质量、与后端保持一致 |
| 状态管理 | | | |
| 构建工具 | Vite | | 快速构建、开发体验好、支持 Vue 3 |
| 后端语言 | Node.js | | 高性能、生态丰富、前后端统一技术栈 |
| 后端框架 | TypeScript | | 类型安全、提升代码质量、与前端保持一致 |
| 数据库 | | | |
| 缓存 | | | |
| 鉴权 | | | |

---

## 4. 前端技术方案设计（必须完整）

### 4.1 前端架构模式
- 架构类型（SPA / SSR / BFF / 微前端）
- 前端分层设计（UI / 状态 / 领域 / API）
- 模块拆分原则

### 4.2 前端技术栈与实现要求
- 框架与原因：**必须使用 Vue + Vite + TypeScript**（强制要求）
- 状态管理方案
- 路由与权限控制
- 请求层封装规范
- 类型系统约束（TypeScript）

### 4.3 前端工程目录结构（必须完整）

\`\`\`
project-root/
├── public/                    # 静态资源
│   ├── favicon.ico
│   └── ...
├── src/
│   ├── main.ts               # 应用入口
│   ├── App.vue               # 根组件
│   ├── router/               # 路由配置
│   │   ├── index.ts
│   │   └── routes.ts
│   ├── stores/               # 状态管理（Pinia）
│   │   ├── index.ts
│   │   └── user.ts
│   ├── api/                  # API 请求层
│   │   ├── index.ts          # API 客户端封装
│   │   ├── request.ts        # 请求拦截器
│   │   └── modules/          # 按模块划分的 API
│   │       ├── auth.ts
│   │       └── ...
│   ├── views/                # 页面组件
│   │   ├── Home.vue
│   │   ├── Login.vue
│   │   └── ...
│   ├── components/           # 通用组件
│   │   ├── common/          # 基础组件
│   │   │   ├── Button.vue
│   │   │   ├── Input.vue
│   │   │   └── ...
│   │   └── layout/          # 布局组件
│   │       ├── Header.vue
│   │       ├── Sidebar.vue
│   │       └── ...
│   ├── composables/          # 组合式函数（Composables）
│   │   ├── useAuth.ts
│   │   ├── useRequest.ts
│   │   └── ...
│   ├── types/                # TypeScript 类型定义
│   │   ├── api.ts            # API 相关类型
│   │   ├── user.ts           # 用户相关类型
│   │   └── index.ts
│   ├── utils/                # 工具函数
│   │   ├── request.ts
│   │   ├── storage.ts
│   │   └── ...
│   ├── styles/              # 样式文件
│   │   ├── variables.scss
│   │   ├── mixins.scss
│   │   └── main.scss
│   └── assets/              # 资源文件
│       ├── images/
│       └── ...
├── .env                     # 环境变量
├── .env.development
├── .env.production
├── .gitignore
├── index.html               # HTML 模板
├── package.json
├── tsconfig.json            # TypeScript 配置
├── vite.config.ts           # Vite 配置
└── README.md
\`\`\`

### 4.4 前端文件清单（必须完整列出）

#### 核心文件
- \`src/main.ts\` - 应用入口文件，初始化 Vue 应用、路由、状态管理
- \`src/App.vue\` - 根组件，包含路由视图和全局布局
- \`index.html\` - HTML 模板文件

#### 路由相关文件
- \`src/router/index.ts\` - 路由配置入口
- \`src/router/routes.ts\` - 路由定义文件

#### 状态管理文件
- \`src/stores/index.ts\` - Pinia store 入口
- \`src/stores/user.ts\` - 用户状态管理
- \`src/stores/app.ts\` - 应用全局状态（可选）

#### API 请求层文件
- \`src/api/index.ts\` - API 客户端封装（axios 实例）
- \`src/api/request.ts\` - 请求拦截器、响应拦截器
- \`src/api/modules/auth.ts\` - 认证相关 API
- \`src/api/modules/user.ts\` - 用户相关 API
- （根据业务模块继续添加）

#### 页面组件文件（根据 PRD 中的页面列表生成）
- \`src/views/Home.vue\` - 首页
- \`src/views/Login.vue\` - 登录页
- （列出所有页面组件）

#### 通用组件文件
- \`src/components/common/Button.vue\` - 按钮组件
- \`src/components/common/Input.vue\` - 输入框组件
- \`src/components/common/Form.vue\` - 表单组件
- \`src/components/common/Table.vue\` - 表格组件
- \`src/components/common/Modal.vue\` - 弹窗组件
- \`src/components/layout/Header.vue\` - 头部组件
- \`src/components/layout/Sidebar.vue\` - 侧边栏组件
- \`src/components/layout/Footer.vue\` - 底部组件（可选）

#### Composables 文件
- \`src/composables/useAuth.ts\` - 认证相关逻辑
- \`src/composables/useRequest.ts\` - 请求相关逻辑
- \`src/composables/useTable.ts\` - 表格相关逻辑（可选）
- \`src/composables/useForm.ts\` - 表单相关逻辑（可选）

#### 类型定义文件
- \`src/types/index.ts\` - 类型定义入口
- \`src/types/api.ts\` - API 响应类型
- \`src/types/user.ts\` - 用户相关类型
- \`src/types/common.ts\` - 通用类型

#### 工具函数文件
- \`src/utils/request.ts\` - HTTP 请求工具
- \`src/utils/storage.ts\` - 本地存储工具
- \`src/utils/validate.ts\` - 表单校验工具
- \`src/utils/format.ts\` - 格式化工具（日期、金额等）

#### 样式文件
- \`src/styles/variables.scss\` - SCSS 变量定义
- \`src/styles/mixins.scss\` - SCSS Mixins
- \`src/styles/main.scss\` - 主样式文件

#### 配置文件
- \`package.json\` - 项目依赖和脚本
- \`tsconfig.json\` - TypeScript 配置
- \`vite.config.ts\` - Vite 构建配置
- \`.env\` - 环境变量（开发环境）
- \`.env.production\` - 生产环境变量
- \`.gitignore\` - Git 忽略文件配置

### 4.5 前端与后端协作规范
- API 规范
- 错误码设计
- 数据结构约定
- Mock / OpenAPI 支持

### 4.6 前端性能与体验优化
- 首屏优化
- 缓存策略
- 异常与降级处理

---

## 5. 后端技术方案设计（必须完整）

### 5.1 后端架构模式
- 单体 / 模块化 / 微服务
- 服务拆分原则
- 是否使用 DDD / Clean Architecture

### 5.2 后端技术栈与实现要求
- 语言与框架：**必须使用 Node.js + TypeScript**（强制要求）
- ORM / 数据访问层
- 鉴权与权限模型
- 配置与环境管理

### 5.3 后端代码结构（必须完整）

\`\`\`
project-root/
├── src/
│   ├── index.ts              # 应用入口文件
│   ├── server.ts             # HTTP 服务器启动
│   ├── app.ts                # Express/Koa 应用实例
│   ├── api/                  # API 路由层
│   │   ├── index.ts          # API 路由入口
│   │   ├── routes/           # 路由定义
│   │   │   ├── auth.routes.ts
│   │   │   ├── user.routes.ts
│   │   │   └── ...
│   │   └── controllers/      # 控制器
│   │       ├── AuthController.ts
│   │       ├── UserController.ts
│   │       └── ...
│   ├── services/             # 业务逻辑层
│   │   ├── AuthService.ts
│   │   ├── UserService.ts
│   │   └── ...
│   ├── domain/               # 领域模型（DDD）
│   │   ├── entities/         # 实体
│   │   │   ├── User.ts
│   │   │   └── ...
│   │   ├── valueObjects/     # 值对象
│   │   └── repositories/     # 仓储接口
│   │       ├── IUserRepository.ts
│   │       └── ...
│   ├── repositories/         # 数据访问层实现
│   │   ├── UserRepository.ts
│   │   └── ...
│   ├── models/               # 数据模型（ORM）
│   │   ├── User.ts
│   │   └── ...
│   ├── middlewares/          # 中间件
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── logger.middleware.ts
│   ├── utils/                # 工具函数
│   │   ├── logger.ts
│   │   ├── jwt.ts
│   │   ├── validator.ts
│   │   └── ...
│   ├── types/                # TypeScript 类型定义
│   │   ├── express.d.ts      # Express 类型扩展
│   │   ├── api.ts
│   │   └── ...
│   ├── config/               # 配置文件
│   │   ├── database.ts       # 数据库配置
│   │   ├── redis.ts          # Redis 配置
│   │   └── index.ts
│   ├── database/             # 数据库相关
│   │   ├── migrations/       # 数据库迁移
│   │   ├── seeds/            # 种子数据
│   │   └── connection.ts     # 数据库连接
│   └── tests/                # 测试文件
│       ├── unit/
│       ├── integration/
│       └── e2e/
├── .env                      # 环境变量
├── .env.development
├── .env.production
├── .gitignore
├── package.json
├── tsconfig.json             # TypeScript 配置
├── jest.config.js            # Jest 测试配置（可选）
└── README.md
\`\`\`

### 5.4 后端文件清单（必须完整列出）

#### 核心文件
- \`src/index.ts\` - 应用入口文件，启动服务器
- \`src/server.ts\` - HTTP 服务器配置和启动逻辑
- \`src/app.ts\` - Express/Koa 应用实例配置

#### API 路由层文件
- \`src/api/index.ts\` - API 路由入口，注册所有路由
- \`src/api/routes/auth.routes.ts\` - 认证相关路由
- \`src/api/routes/user.routes.ts\` - 用户相关路由
- （根据业务模块继续添加路由文件）

#### 控制器文件
- \`src/api/controllers/AuthController.ts\` - 认证控制器
- \`src/api/controllers/UserController.ts\` - 用户控制器
- （每个业务模块对应一个控制器文件）

#### 服务层文件
- \`src/services/AuthService.ts\` - 认证业务逻辑
- \`src/services/UserService.ts\` - 用户业务逻辑
- （每个业务模块对应一个服务文件）

#### 领域模型文件（DDD 模式）
- \`src/domain/entities/User.ts\` - 用户实体
- \`src/domain/repositories/IUserRepository.ts\` - 用户仓储接口
- （根据业务领域继续添加）

#### 数据访问层文件
- \`src/repositories/UserRepository.ts\` - 用户数据访问实现
- \`src/repositories/BaseRepository.ts\` - 基础仓储类（可选）
- （每个实体对应一个仓储文件）

#### 数据模型文件（ORM）
- \`src/models/User.ts\` - 用户数据模型
- \`src/models/index.ts\` - 模型导出入口
- （根据数据库表继续添加）

#### 中间件文件
- \`src/middlewares/auth.middleware.ts\` - 认证中间件
- \`src/middlewares/error.middleware.ts\` - 错误处理中间件
- \`src/middlewares/validation.middleware.ts\` - 请求校验中间件
- \`src/middlewares/logger.middleware.ts\` - 日志中间件

#### 工具函数文件
- \`src/utils/logger.ts\` - 日志工具
- \`src/utils/jwt.ts\` - JWT 工具函数
- \`src/utils/validator.ts\` - 数据校验工具
- \`src/utils/response.ts\` - 响应格式化工具
- \`src/utils/encrypt.ts\` - 加密工具（可选）

#### 类型定义文件
- \`src/types/express.d.ts\` - Express 类型扩展
- \`src/types/api.ts\` - API 相关类型
- \`src/types/user.ts\` - 用户相关类型
- \`src/types/common.ts\` - 通用类型

#### 配置文件
- \`src/config/index.ts\` - 配置入口
- \`src/config/database.ts\` - 数据库配置
- \`src/config/redis.ts\` - Redis 配置
- \`src/config/jwt.ts\` - JWT 配置（可选）

#### 数据库相关文件
- \`src/database/connection.ts\` - 数据库连接配置
- \`src/database/migrations/\` - 数据库迁移文件目录
- \`src/database/seeds/\` - 种子数据文件目录

#### 测试文件
- \`src/tests/unit/\` - 单元测试文件目录
- \`src/tests/integration/\` - 集成测试文件目录
- \`src/tests/e2e/\` - 端到端测试文件目录

#### 项目配置文件
- \`package.json\` - 项目依赖和脚本
- \`tsconfig.json\` - TypeScript 配置
- \`jest.config.js\` - Jest 测试配置（可选）
- \`.env\` - 环境变量（开发环境）
- \`.env.production\` - 生产环境变量
- \`.gitignore\` - Git 忽略文件配置

### 5.5 API 设计规范

#### 示例接口
- 方法：
- 路径：
- 请求：
\`\`\`json
{}
\`\`\`
- 响应：
\`\`\`json
{}
\`\`\`

---

## 6. 数据模型设计

### 6.1 ER 图

\`\`\`mermaid
erDiagram
\`\`\`

### 6.2 数据表设计
- 字段
- 类型
- 索引
- 关系

---

## 7. 安全性设计
- 认证与授权
- 数据安全
- 接口安全

---

## 8. 性能与扩展性
- 缓存
- 并发处理
- 扩展方案

---

## 9. 日志、错误与监控
- 错误处理
- 日志规范
- 监控指标

---

## 10. 测试策略
- 单元测试
- 集成测试
- E2E 测试

---

## 11. 部署与 DevOps
- CI/CD
- 环境划分
- 监控与告警

---

## 12. 未来演进方向
- 技术演进
- 架构升级
`;
export function buildDesignPrompt(prd: string): string {
  return `
你将基于以下【产品需求文档（PRD）】生成一份【完整系统设计文档】。

【PRD 内容】
${prd}

【强制要求】
1. 必须完整输出：
   - 系统架构设计
   - 前端技术方案（架构 + 技术栈 + 工程结构 + 文件清单 + 实现）
   - 后端技术方案（架构 + 技术栈 + 代码结构 + 文件清单 + 实现）
2. **前端技术栈必须使用 Vue + Vite + TypeScript**（这是强制要求，不得使用其他框架或构建工具）
3. **后端技术栈必须使用 Node.js + TypeScript**（这是强制要求，不得使用其他语言或框架）
4. 技术选型必须是明确决策，并说明原因
5. **目录结构必须完整**：必须包含所有层级的目录和文件，不得省略任何目录
6. **文件清单必须完整**：必须列出所有需要生成的文件，包括：
   - 前端：所有页面组件、通用组件、API 文件、工具函数、配置文件等
   - 后端：所有控制器、服务、模型、中间件、工具函数、配置文件等
7. API、数据模型必须达到"可直接开发"级别
8. 不允许出现占位符、略写、空泛描述
9. 输出内容不少于 **4000 字**
10. 至少包含 3 个 Mermaid 图（架构 / ER / 流程或时序）
11. 所有章节必须完整输出，不得省略

【输出格式】
- 使用 Markdown
- 严格按照系统设计模板结构
- 技术语言专业、偏工程文档

现在开始生成系统设计文档。
`;
}

export default {
  DESIGN_SYSTEM_PROMPT,
  DESIGN_TEMPLATE,
  buildDesignPrompt,
};
