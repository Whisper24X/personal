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
- **UI组件库选择**：
  - PC端项目必须使用 **Element Plus**（这是强制要求）
  - 移动端项目必须使用 **Vant**（这是强制要求）
- **后端技术栈必须使用 Go + Kratos 框架**（这是强制要求）

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
| UI组件库（PC端） | Element Plus | | 企业级UI组件库、Vue 3生态完善、组件丰富 |
| UI组件库（移动端） | Vant | | 移动端UI组件库、轻量高效、组件齐全 |
| 状态管理 | | | |
| 构建工具 | Vite | | 快速构建、开发体验好、支持 Vue 3 |
| 后端语言 | Go | | 高性能、高并发、编译型语言、类型安全 |
| 后端框架 | Kratos | | 微服务框架、洋葱架构、工具链完善 |
| 数据库 | | | |
| 缓存 | | | |
| 鉴权 | | | |

---

## 4. 前端技术方案设计（必须完整）

### 4.1 前端架构模式
- 架构类型（SPA / SSR / BFF / 微前端）
- 前端分层设计（UI / 状态 / 领域 / API）
- 模块拆分原则：
  - **按业务模块组织页面**：每个业务模块独立成文件夹
  - 模块内包含：页面入口、子页面、专用组件、类型定义、API 请求
  - 通用组件统一放在 components 目录
  - 全局 API、类型、工具函数统一管理

### 4.2 前端技术栈与实现要求
- 框架与原因：**必须使用 Vue + Vite + TypeScript**（强制要求）
- UI组件库选择：
  - **PC端项目必须使用 Element Plus**（强制要求，不得使用其他PC端组件库）
  - **移动端项目必须使用 Vant**（强制要求，不得使用其他移动端组件库）
  - 根据项目类型（PC端/移动端）明确选择对应的组件库
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
│   ├── views/                # 页面组件（按业务模块组织）
│   │   ├── home/            # 首页模块
│   │   │   └── index.vue    # 首页主入口
│   │   ├── login/           # 登录模块
│   │   │   └── index.vue    # 登录页主入口
│   │   ├── user/            # 用户模块示例
│   │   │   ├── index.vue    # 用户列表页（模块主入口）
│   │   │   ├── detail.vue   # 用户详情页
│   │   │   ├── components/  # 该模块专用组件
│   │   │   │   ├── UserCard.vue
│   │   │   │   └── UserForm.vue
│   │   │   ├── types.ts     # 该模块类型定义
│   │   │   └── api.ts       # 该模块 API 请求
│   │   └── ...              # 其他业务模块
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

**全局 API 配置**：
- \`src/api/index.ts\` - API 客户端封装（axios 实例）
- \`src/api/request.ts\` - 请求拦截器、响应拦截器

**全局通用 API**（跨模块使用的 API）：
- \`src/api/modules/auth.ts\` - 认证相关 API
- \`src/api/modules/common.ts\` - 通用 API（如字典、配置等）
- （根据需要添加其他全局 API）

**说明**：业务模块的 API 请求放在各自模块内的 \`api.ts\` 文件中

#### 页面组件文件（按业务模块组织，根据 PRD 中的功能模块生成）

**说明**：每个业务模块独立成文件夹，包含该模块的页面、组件、类型、API 等

##### 公共页面模块
- \`src/views/home/index.vue\` - 首页主入口
- \`src/views/login/index.vue\` - 登录页主入口

##### 业务模块示例（用户模块）
- \`src/views/user/index.vue\` - 用户列表页（模块主入口）
- \`src/views/user/detail.vue\` - 用户详情页
- \`src/views/user/edit.vue\` - 用户编辑页（如需要）
- \`src/views/user/components/UserCard.vue\` - 用户卡片组件（仅该模块使用）
- \`src/views/user/components/UserForm.vue\` - 用户表单组件（仅该模块使用）
- \`src/views/user/types.ts\` - 用户模块类型定义
- \`src/views/user/api.ts\` - 用户模块 API 请求

##### 其他业务模块
- 按照同样的结构，为每个业务模块创建独立的文件夹
- 每个模块包含：主入口页面、子页面、专用组件、类型定义、API 请求文件

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

**全局类型**（跨模块使用的类型）：
- \`src/types/index.ts\` - 类型定义入口
- \`src/types/api.ts\` - API 响应通用类型
- \`src/types/common.ts\` - 通用类型定义

**说明**：业务模块的类型定义放在各自模块内的 \`types.ts\` 文件中

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
- 采用洋葱架构（Clean Architecture）：Server → Service → Biz → Data
- 依赖向内流动，Biz 层定义接口，Data 层实现

### 5.2 后端技术栈与实现要求
- 语言与框架：**必须使用 Go + Kratos 框架**（强制要求）
- ORM / 数据访问层：GORM
- 鉴权与权限模型
- 配置与环境管理

### 5.3 后端代码结构（必须完整）

\`\`\`
project-root/
├── cmd/
│   └── server/
│       ├── main.go              # 应用入口
│       ├── wire.go              # 依赖注入配置
│       └── wire_gen.go          # Wire 生成文件
├── api/                         # API 定义（Protobuf）
│   └── v1/
│       ├── auth.proto           # 认证相关 API
│       ├── user.proto           # 用户相关 API
│       └── ...
├── internal/
│   ├── conf/                    # 配置定义
│   │   └── conf.proto           # 配置 Protobuf
│   ├── server/                  # Server 层（HTTP/gRPC）
│   │   ├── http.go              # HTTP 服务器
│   │   ├── grpc.go              # gRPC 服务器
│   │   └── server.go            # Server 注册
│   ├── service/                 # Service 层（业务接口实现）
│   │   ├── auth.go              # 认证服务
│   │   ├── user.go              # 用户服务
│   │   └── service.go           # Service 注册
│   ├── biz/                     # Biz 层（业务逻辑）
│   │   ├── auth.go              # 认证业务逻辑
│   │   ├── user.go              # 用户业务逻辑
│   │   └── biz.go               # Biz 注册
│   └── data/                    # Data 层（数据访问）
│       ├── data.go              # Data 初始化
│       ├── auth.go              # 认证数据访问
│       ├── user.go              # 用户数据访问
│       └── ent/                 # 数据模型（GORM/Ent）
│           ├── schema/
│           └── ...
├── pkg/                         # 公共工具库
│   ├── middleware/              # 中间件
│   │   ├── auth.go
│   │   ├── logger.go
│   │   └── ...
│   ├── util/                    # 工具函数
│   │   ├── jwt.go
│   │   ├── hash.go
│   │   └── ...
│   └── errors/                  # 错误定义
│       └── errors.go
├── configs/                     # 配置文件
│   ├── config.yaml              # 开发环境配置
│   ├── config.prod.yaml         # 生产环境配置
│   └── ...
├── third_party/                 # 第三方 Proto 文件
├── go.mod                       # Go 模块定义
├── go.sum
├── Makefile                     # 构建脚本
└── README.md
\`\`\`

### 5.4 后端文件清单（必须完整列出）

#### 核心文件
- \`cmd/server/main.go\` - 应用入口文件，启动服务器
- \`cmd/server/wire.go\` - Wire 依赖注入配置
- \`cmd/server/wire_gen.go\` - Wire 自动生成的依赖注入代码

#### API 定义文件（Protobuf）
- \`api/v1/auth.proto\` - 认证相关 API 定义
- \`api/v1/user.proto\` - 用户相关 API 定义
- （根据业务模块继续添加 Proto 文件）

#### Server 层文件
- \`internal/server/http.go\` - HTTP 服务器配置
- \`internal/server/grpc.go\` - gRPC 服务器配置（可选）
- \`internal/server/server.go\` - Server 注册和初始化

#### Service 层文件
- \`internal/service/service.go\` - Service 层注册
- \`internal/service/auth.go\` - 认证服务实现
- \`internal/service/user.go\` - 用户服务实现
- （每个业务模块对应一个 Service 文件）

#### Biz 层文件（业务逻辑）
- \`internal/biz/biz.go\` - Biz 层注册
- \`internal/biz/auth.go\` - 认证业务逻辑
- \`internal/biz/user.go\` - 用户业务逻辑
- （每个业务模块对应一个 Biz 文件）

#### Data 层文件（数据访问）
- \`internal/data/data.go\` - Data 层初始化和数据库连接
- \`internal/data/auth.go\` - 认证数据访问实现
- \`internal/data/user.go\` - 用户数据访问实现
- \`internal/data/ent/schema/\` - 数据模型 Schema 定义（GORM/Ent）
- （每个实体对应一个 Data 文件）

#### 中间件文件
- \`pkg/middleware/auth.go\` - 认证中间件
- \`pkg/middleware/logger.go\` - 日志中间件
- \`pkg/middleware/recovery.go\` - 错误恢复中间件
- \`pkg/middleware/cors.go\` - CORS 中间件（可选）

#### 工具函数文件
- \`pkg/util/jwt.go\` - JWT 工具函数
- \`pkg/util/hash.go\` - 密码哈希工具
- \`pkg/util/validator.go\` - 数据校验工具
- \`pkg/util/response.go\` - 响应格式化工具

#### 错误定义文件
- \`pkg/errors/errors.go\` - 统一错误定义和错误码

#### 配置文件
- \`internal/conf/conf.proto\` - 配置定义（Protobuf）
- \`configs/config.yaml\` - 开发环境配置
- \`configs/config.prod.yaml\` - 生产环境配置

#### 项目配置文件
- \`go.mod\` - Go 模块依赖
- \`go.sum\` - 依赖版本锁定
- \`Makefile\` - 构建和工具命令
- \`.gitignore\` - Git 忽略文件配置
- \`README.md\` - 项目说明文档

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

## 8. 部署与 DevOps
- CI/CD
- 环境划分
- 监控与告警
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
3. **UI组件库选择**（强制要求）：
   - PC端项目必须使用 **Element Plus**（不得使用其他PC端组件库）
   - 移动端项目必须使用 **Vant**（不得使用其他移动端组件库）
   - 根据PRD中的项目类型（PC端/移动端）明确选择对应的组件库
4. **后端技术栈必须使用 Go + Kratos 框架**（这是强制要求，不得使用其他语言或框架）
5. 技术选型必须是明确决策，并说明原因
6. **目录结构必须完整**：必须包含所有层级的目录和文件，不得省略任何目录
7. **文件清单必须完整**：必须列出所有需要生成的文件，包括：
   - 前端：所有页面组件、通用组件、API 文件、工具函数、配置文件等
   - 后端：所有 Proto 文件、Service/Biz/Data 层文件、中间件、工具函数、配置文件等
8. API、数据模型必须达到"可直接开发"级别
9. 不允许出现占位符、略写、空泛描述
10. 输出内容不少于 **4000 字**
11. 至少包含 3 个 Mermaid 图（架构 / ER / 流程或时序）
12. 所有章节必须完整输出，不得省略（共8个章节）

【输出格式】
- 使用 Markdown
- 严格按照系统设计模板结构
- 技术语言专业、偏工程文档

现在开始生成系统设计文档。
`;
}

/**
 * 生成设计文档目录（仅输出章节结构）
 */
export function buildDesignOutlinePrompt(input: string): string {
  return `基于以下产品需求文档（PRD），生成系统设计文档的目录结构（仅输出章节标题，不输出内容）：

【产品需求文档（PRD）】
${input}

【系统设计文档模板格式（必须严格遵循）】
${DESIGN_TEMPLATE}

要求：
1. **严格按照模板结构输出目录,包含所有一级章节（## 1. 到 ## 8.）**
2. **只输出 Markdown 格式的目录，格式如下：**
\`\`\`
## 1. 系统概述
## 2. 系统总体架构设计
## 3. 技术选型总览
...
## 8. 部署与 DevOps
\`\`\`
3. 不要输出任何章节内容，只输出章节标题
4. 保持章节编号和标题与模板完全一致

输出格式：纯 Markdown 目录，每个章节一行
`;
}

/**
 * 生成单个章节的详细内容
 */
export function buildDesignSectionPrompt(input: string, outline: string, sectionNumber: number, sectionTitle: string): string {
  return `基于以下产品需求文档（PRD）和设计文档目录，生成第 ${sectionNumber} 章「${sectionTitle}」的详细内容：

【产品需求文档（PRD）】
${input}

【设计文档目录】
${outline}

【目标章节】
## ${sectionNumber}. ${sectionTitle}

生成要求：
1. **严格按照设计文档模板中第 ${sectionNumber} 章的结构和格式输出**
2. **必须包含该章节下的所有子章节和内容点**
3. 内容要详细、具体、可执行，避免空洞和占位符
4. 技术选型必须明确，并说明选择理由
5. 前后端方案必须完整，包含目录结构和文件清单
6. 内容要面向研发团队，确保可直接使用
7. 如果章节需要 Mermaid 图，必须包含完整的图表代码

输出要求：
- 只输出第 ${sectionNumber} 章的内容（包含章节标题）
- 内容要充实，不少于 500 字
- 使用 Markdown 格式
- 不保留任何占位符
- 章节编号和标题必须与模板完全一致
`;
}

/**
 * Design Review 提示词
 */
export const DESIGN_REVIEW_SYSTEM_PROMPT = `你是一位资深的系统架构审查专家，擅长检查系统设计文档的完整性和质量。

你的职责是：
- 检查设计文档是否包含所有必需的章节（1-12章）
- 检查每个章节的内容是否充实、具体
- 识别空洞、模糊或占位符内容
- 特别检查技术选型是否明确、前后端方案是否完整
- 提供改进建议

输出格式：结构化的审查报告`;

export function buildDesignReviewPrompt(designContent: string, outline: string): string {
  return `请审查以下系统设计文档的质量：

【设计文档】
${designContent}

【预期目录结构】
${outline}

审查要求：
1. **检查章节完整性**：是否包含所有必需的章节（## 1. 系统概述 到 ## 8. 部署与 DevOps）？
2. **检查内容质量**：每个章节是否有充实的内容？是否存在空洞、模糊或占位符？
3. **检查格式规范**：章节编号、标题是否与模板一致？
4. **检查技术选型**：技术选型是否明确？是否说明了选型理由？
5. **检查前后端方案**：前端和后端技术方案是否完整？是否包含完整的目录结构和文件清单？
6. **检查可执行性**：API设计、数据模型设计是否达到可直接开发级别？

输出格式：
\`\`\`markdown
# 系统设计文档审查报告

## 1. 章节完整性检查
- [ ] 章节 1. 系统概述：存在/缺失
- [ ] 章节 2. 系统总体架构设计：存在/缺失
- [ ] 章节 3. 技术选型总览：存在/缺失
- [ ] 章节 4. 前端技术方案设计：存在/缺失（需特别检查是否完整）
- [ ] 章节 5. 后端技术方案设计：存在/缺失（需特别检查是否完整）
- [ ] 章节 6. 数据模型设计：存在/缺失
- [ ] 章节 7. 安全性设计：存在/缺失
- [ ] 章节 8. 部署与 DevOps：存在/缺失

## 2. 内容质量检查
### 发现的问题：
1. [章节编号] 问题描述
2. [章节编号] 问题描述

### 空洞内容识别：
- [章节编号] 具体位置和问题

### 技术选型检查：
- [ ] 技术选型是否明确？
- [ ] 是否说明了选型理由？
- [ ] 前端技术栈是否强制使用 Vue + Vite + TypeScript？
- [ ] UI组件库是否明确选择（PC端使用Element Plus，移动端使用Vant）？
- [ ] 后端技术栈是否强制使用 Go + Kratos 框架？

### 前后端方案检查：
- [ ] 前端目录结构是否完整？
- [ ] 前端文件清单是否完整？
- [ ] 后端目录结构是否完整？
- [ ] 后端文件清单是否完整？
- [ ] API设计是否达到可直接开发级别？

## 3. 改进建议
1. 建议 1
2. 建议 2

## 4. 审查结论
- 通过 / 需要改进
- 主要问题：[列出主要问题]
\`\`\`
`;
}

/**
 * Design Improve 提示词
 */
export const DESIGN_IMPROVE_SYSTEM_PROMPT = `你是一位资深的系统设计文档改进专家，擅长根据审查报告的建议，补充和完善系统设计文档。

你的职责是：
- 仔细分析审查报告中的改进建议
- 识别文档中需要补充和完善的部分
- 针对性地改进文档内容，使其更加详细、具体、可执行
- 保持文档的原有结构和格式
- 确保改进后的内容符合系统设计文档模板要求

改进原则：
- 保持文档的章节结构和编号不变（## 1. 到 ## 8.）
- 根据审查报告中的具体建议，补充缺失的内容
- 完善模糊或简略的描述，使其更加详细具体
- 确保技术选型明确，并说明选择理由
- 确保前后端方案完整，包含完整的目录结构和文件清单
- 确保API设计、数据模型设计达到可直接开发级别
- 改进后的内容要面向研发团队，确保可直接使用`;

export function buildDesignImprovePrompt(designContent: string, reviewReport: string): string {
  return `请根据以下审查报告的建议，改进和完善系统设计文档：

【当前系统设计文档】
${designContent}

【审查报告】
${reviewReport}

改进要求：
1. **仔细分析审查报告**：识别所有改进建议和问题点
2. **保持文档结构**：不要改变章节编号和标题（## 1. 到 ## 8.），只改进内容
3. **针对性改进**：
   - 补充缺失的章节内容
   - 完善简略或模糊的描述
   - 明确技术选型，并说明选择理由
   - 完善前后端技术方案，确保包含完整的目录结构和文件清单
   - 细化API设计、数据模型设计，确保达到可直接开发级别
   - 补充架构图、ER图等图表
4. **内容质量**：
   - 所有内容必须详细、具体、可执行
   - 避免空洞、模糊或占位符内容
   - 确保研发团队可直接使用
   - 前端技术栈必须使用 Vue + Vite + TypeScript（强制要求）
   - UI组件库必须明确选择：PC端使用Element Plus，移动端使用Vant（强制要求）
   - 后端技术栈必须使用 Go + Kratos 框架（强制要求）
5. **保持格式**：使用Markdown格式，保持章节层级清晰

输出要求：
- 输出完整的改进后的系统设计文档
- 保持所有章节（## 1. 系统概述 到 ## 8. 部署与 DevOps）
- 确保改进后的内容解决了审查报告中提出的所有问题
- 如果审查报告建议增加新内容，可以在现有章节基础上扩展，但保持主要结构不变
`;
}

export default {
  DESIGN_SYSTEM_PROMPT,
  DESIGN_TEMPLATE,
  buildDesignPrompt,
  buildDesignOutlinePrompt,
  buildDesignSectionPrompt,
  DESIGN_REVIEW_SYSTEM_PROMPT,
  buildDesignReviewPrompt,
  DESIGN_IMPROVE_SYSTEM_PROMPT,
  buildDesignImprovePrompt,
};
