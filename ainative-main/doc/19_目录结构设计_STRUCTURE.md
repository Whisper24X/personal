# 即思即成（Mind2Build）目录结构设计

**Slogan**: 让所思，即所得

**文档版本**: v1.2  
**创建日期**: 2025-12-25  
**最后更新**: 2026-01-26（添加services和executors目录说明，更新GitService位置）

---

## 目录

1. [总体目录结构](#1-总体目录结构)
2. [后端目录结构](#2-后端目录结构)
3. [前端目录结构](#3-前端目录结构)
4. [数据库目录结构](#4-数据库目录结构)
5. [配置文件说明](#5-配置文件说明)
6. [目录设计原则](#6-目录设计原则)
7. [目录扩展指南](#7-目录扩展指南)

---

## 1. 总体目录结构

### 1.1 完整目录树

```
ax/                                # 项目根目录
├── backend/                       # 后端服务（Node.js）
│   ├── src/                      # 源代码
│   ├── tests/                    # 测试代码
│   ├── package.json              # Node.js 依赖配置
│   ├── tsconfig.json             # TypeScript 配置
│   └── .env.example              # 环境变量示例
├── frontend/                      # 前端应用（Vue + Vite）
│   ├── src/                      # 源代码
│   ├── public/                   # 静态资源
│   ├── tests/                    # 测试代码
│   ├── package.json              # Node.js 依赖配置
│   ├── vite.config.ts            # Vite 配置
│   └── tsconfig.json             # TypeScript 配置
├── database/                      # 数据库相关
│   ├── migrations/               # 数据库迁移脚本
│   ├── seeds/                    # 种子数据
│   ├── schema/                   # 数据库模式定义
│   └── prisma/                   # Prisma ORM 配置
├── shared/                        # 前后端共享代码
│   ├── types/                    # 共享类型定义
│   ├── utils/                    # 共享工具函数
│   └── constants/                # 共享常量
├── doc/                          # 项目文档
│   ├── 00_文档导航_INDEX.md
│   ├── ...
│   └── README.md
├── scripts/                       # 脚本工具
│   ├── setup.sh                  # 环境初始化脚本
│   ├── build.sh                  # 构建脚本
│   ├── deploy.sh                 # 部署脚本
│   └── test.sh                   # 测试脚本
├── config/                        # 配置文件
│   ├── dev.json                  # 开发环境配置
│   ├── prod.json                 # 生产环境配置
│   └── test.json                 # 测试环境配置
├── workspace/                     # 生成项目的工作区（自动创建）
│   └── [generated-projects]/     # 各个生成的项目
├── logs/                         # 日志目录（自动创建）
├── .github/                      # GitHub 配置
│   ├── workflows/                # GitHub Actions
│   └── ISSUE_TEMPLATE/           # Issue 模板
├── .vscode/                      # VSCode 配置
│   ├── settings.json             # 编辑器设置
│   ├── extensions.json           # 推荐扩展
│   └── launch.json               # 调试配置
├── docker/                       # Docker 配置
│   ├── backend.Dockerfile        # 后端容器
│   ├── frontend.Dockerfile       # 前端容器
│   └── docker-compose.yml        # 容器编排
├── .gitignore                    # Git 忽略文件
├── .env.example                  # 环境变量示例（根级）
├── package.json                  # 根 package.json（monorepo 配置）
├── pnpm-workspace.yaml           # pnpm workspace 配置
├── README.md                     # 项目说明
└── LICENSE                       # 开源许可
```

### 1.2 目录职责说明

| 目录 | 职责 | 说明 |
|------|------|------|
| `backend/` | 后端服务 | Node.js + Express/Fastify，提供 API 服务 |
| `frontend/` | 前端应用 | Vue 3 + Vite，用户界面 |
| `database/` | 数据库管理 | PostgreSQL 相关的迁移、种子数据、模式 |
| `shared/` | 共享代码 | 前后端共享的类型定义、工具函数 |
| `doc/` | 项目文档 | 需求、设计、API 等所有文档 |
| `scripts/` | 脚本工具 | 自动化脚本（部署、构建、测试） |
| `config/` | 配置文件 | 环境相关的配置 |
| `workspace/` | 工作区 | AI 生成的项目存放位置 |
| `logs/` | 日志 | 应用运行日志 |
| `docker/` | 容器配置 | Docker 镜像和编排配置 |

---

## 2. 后端目录结构

### 2.1 详细结构

```
backend/
├── src/
│   ├── core/                     # 核心基础设施层
│   │   ├── base/                # 基础抽象类
│   │   │   ├── BaseRole.ts      # 角色基类
│   │   │   ├── BaseAction.ts    # 行动基类
│   │   │   └── index.ts
│   │   ├── message/             # 消息系统
│   │   │   ├── Message.ts       # 消息类
│   │   │   ├── MessageQueue.ts  # 消息队列
│   │   │   └── index.ts
│   │   ├── memory/              # 记忆系统
│   │   │   ├── Memory.ts        # 记忆管理
│   │   │   ├── ShortTermMemory.ts
│   │   │   ├── LongTermMemory.ts
│   │   │   └── index.ts
│   │   ├── context/             # 上下文管理
│   │   │   ├── Context.ts       # 全局上下文
│   │   │   ├── RoleContext.ts   # 角色上下文
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── roles/                   # 角色层
│   │   ├── Role.ts              # 角色基础实现
│   │   ├── ProductManager.ts    # 产品经理
│   │   ├── Architect.ts         # 架构师
│   │   ├── Engineer.ts          # 工程师
│   │   ├── QAEngineer.ts        # QA 工程师
│   │   ├── TeamLeader.ts        # 团队领导
│   │   ├── DataAnalyst.ts       # 数据分析师
│   │   └── index.ts
│   ├── actions/                 # 行动层
│   │   ├── Action.ts            # 行动基类
│   │   ├── UserRequirement.ts        # 用户需求收集
│   │   ├── WriteRequirementSpec.ts   # 编写需求说明文档
│   │   ├── RequirementSpecReview.ts # 需求说明文档审查
│   │   ├── WritePRD.ts               # 编写 PRD
│   │   ├── PRDReview.ts              # PRD文档审查
│   │   ├── WriteDesign.ts            # 编写设计
│   │   ├── WriteCode.ts              # 编写代码
│   │   ├── WriteTest.ts              # 编写测试
│   │   ├── DataAnalysis.ts           # 数据分析
│   │   ├── Coordinate.ts             # 协调任务
│   │   ├── BreakdownTasks.ts         # 任务拆分
│   │   ├── GeneratePrototype.ts      # 生成原型
│   │   └── index.ts
│   │   # 已移除: SubProjectDesignReview, CodeReview, WriteSubProjectDesign,
│   │   # TestabilityReview, RunCode, FixBug, SearchEnhancedQA
│   ├── providers/               # 提供商层
│   │   ├── llm/                 # LLM 提供商
│   │   │   ├── BaseLLM.ts       # LLM 基类
│   │   │   ├── OpenAILLM.ts     # OpenAI
│   │   │   ├── AnthropicLLM.ts  # Claude
│   │   │   ├── GeminiLLM.ts     # Gemini
│   │   │   ├── ZhipuLLM.ts      # 智谱AI
│   │   │   ├── factory.ts       # LLM 工厂
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── tools/                   # 工具层
│   │   ├── Browser.ts           # 浏览器工具
│   │   ├── Editor.ts            # 编辑器工具
│   │   ├── Terminal.ts          # 终端工具
│   │   ├── SearchEnhanced.ts    # 增强搜索
│   │   └── index.ts
│   ├── orchestration/           # 编排层
│   │   ├── Environment.ts       # 环境管理
│   │   ├── Team.ts              # 团队管理
│   │   ├── ProjectManager.ts    # 项目管理器（文件系统操作）
│   │   └── index.ts
│   ├── services/                 # 服务层（10个Service）
│   │   ├── WorkflowService.ts   # 工作流配置和管理
│   │   ├── RAGService.ts        # RAG检索增强生成
│   │   ├── EmbeddingService.ts  # 向量嵌入生成
│   │   ├── QdrantService.ts     # Qdrant向量数据库
│   │   ├── RerankService.ts     # 结果重排序
│   │   ├── RoleActionService.ts # 角色Action管理
│   │   ├── SectionAdjustService.ts # PRD/MRD章节调整
│   │   ├── StagehandService.ts  # Stagehand集成
│   │   ├── DocumentArchiveService.ts # 文档归档
│   │   ├── GitService.ts        # Git仓库管理
│   │   └── defaultWorkflowConfig.ts # 默认工作流配置
│   ├── executors/               # 执行器层
│   │   ├── LLMExecutor.ts       # LLM执行器
│   │   ├── CLIExecutor.ts       # CLI执行器
│   │   ├── ExecutorFactory.ts   # 执行器工厂
│   │   ├── cli/                 # CLI提供商
│   │   │   ├── AiderCLIProvider.ts
│   │   │   ├── CursorCLIProvider.ts
│   │   │   ├── CLIProviderFactory.ts
│   │   │   └── ICLIProvider.ts
│   │   └── index.ts
│   ├── workflow/                # 工作流执行引擎
│   │   ├── WorkflowExecutor.ts  # 工作流执行器
│   │   ├── WorkflowExecutionService.ts # 工作流执行服务
│   │   ├── WorkflowStateMachine.ts # 工作流状态机
│   │   ├── WorkflowRecoveryService.ts # 工作流恢复服务
│   │   └── types.ts
│   ├── api/                     # API 层
│   │   ├── routes/              # 路由定义
│   │   │   ├── project.ts       # 项目相关路由
│   │   │   ├── team.ts          # 团队相关路由
│   │   │   ├── role.ts          # 角色相关路由
│   │   │   └── index.ts
│   │   ├── controllers/         # 控制器
│   │   │   ├── ProjectController.ts
│   │   │   ├── TeamController.ts
│   │   │   └── RoleController.ts
│   │   ├── middleware/          # 中间件
│   │   │   ├── auth.ts          # 认证中间件
│   │   │   ├── errorHandler.ts  # 错误处理
│   │   │   ├── logger.ts        # 日志中间件
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── database/                # 数据库层
│   │   ├── models/              # 数据模型
│   │   │   ├── Project.ts
│   │   │   ├── Team.ts
│   │   │   ├── Message.ts
│   │   │   └── index.ts
│   │   ├── repositories/        # 数据仓库
│   │   │   ├── ProjectRepository.ts
│   │   │   ├── TeamRepository.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── utils/                   # 工具函数
│   │   ├── logger.ts            # 日志工具
│   │   ├── cost.ts              # 成本计算
│   │   ├── token.ts             # Token 计算
│   │   ├── validators.ts        # 验证器
│   │   └── index.ts
│   ├── types/                   # 类型定义
│   │   ├── role.types.ts
│   │   ├── action.types.ts
│   │   ├── message.types.ts
│   │   └── index.ts
│   ├── config/                  # 配置管理
│   │   ├── Config.ts            # 配置类
│   │   ├── default.ts           # 默认配置
│   │   └── index.ts
│   ├── cli/                     # CLI 工具
│   │   ├── commands/            # 命令定义
│   │   │   ├── generate.ts      # 生成命令
│   │   │   ├── run.ts           # 运行命令
│   │   │   └── index.ts
│   │   ├── cli.ts               # CLI 入口
│   │   └── index.ts
│   ├── app.ts                   # Express/Fastify 应用
│   └── server.ts                # 服务器入口
├── tests/                       # 测试
│   ├── unit/                    # 单元测试
│   │   ├── core/
│   │   ├── roles/
│   │   ├── actions/
│   │   └── providers/
│   ├── integration/             # 集成测试
│   │   ├── workflow.test.ts
│   │   ├── api.test.ts
│   │   └── database.test.ts
│   ├── e2e/                     # 端到端测试
│   │   ├── project-generation.test.ts
│   │   └── data-analysis.test.ts
│   ├── fixtures/                # 测试数据
│   │   ├── messages.json
│   │   ├── projects.json
│   │   └── index.ts
│   ├── mocks/                   # Mock 对象
│   │   ├── llm.mock.ts
│   │   ├── tools.mock.ts
│   │   └── index.ts
│   └── setup.ts                 # 测试设置
├── dist/                        # 编译输出（自动生成）
├── node_modules/                # 依赖（自动生成）
├── package.json                 # 依赖配置
├── tsconfig.json                # TypeScript 配置
├── jest.config.js               # Jest 配置
├── .eslintrc.js                 # ESLint 配置
├── .prettierrc                  # Prettier 配置
├── .env.example                 # 环境变量示例
└── README.md                    # 后端说明
```

### 2.2 核心模块说明

#### 2.2.1 核心层（core/）

**职责**: 提供框架的基础设施和核心抽象

**关键文件**:
- `base/BaseRole.ts`: 角色抽象基类，定义角色的生命周期
- `base/BaseAction.ts`: 行动抽象基类，定义行动的执行接口
- `message/Message.ts`: 消息类，实现角色间通信
- `memory/Memory.ts`: 记忆管理，提供上下文记忆能力
- `context/Context.ts`: 全局上下文，管理配置和共享资源

#### 2.2.2 角色层（roles/）

**职责**: 实现具体的 AI 角色

**命名规范**: 
- 文件名：PascalCase，如 `ProductManager.ts`
- 类名：与文件名一致
- 导出：默认导出 + 命名导出

**示例结构**:
```typescript
// ProductManager.ts
import { Role } from './Role';
import { WritePRD } from '../actions';

export class ProductManager extends Role {
  constructor() {
    super({
      name: 'Alice',
      profile: 'Product Manager',
      goal: 'Create comprehensive PRD',
      actions: [WritePRD]
    });
  }
}

export default ProductManager;
```

#### 2.2.3 行动层（actions/）

**职责**: 实现具体的任务执行逻辑

**命名规范**: 
- 文件名：PascalCase + 动词开头，如 `WritePRD.ts`
- 类名：与文件名一致

**示例结构**:
```typescript
// WritePRD.ts
import { Action } from './Action';

export class WritePRD extends Action {
  name = 'WritePRD';
  
  async run(requirement: string): Promise<Document> {
    // 实现逻辑
  }
}
```

#### 2.2.4 提供商层（providers/）

**职责**: 集成外部服务（LLM、工具等）

**LLM 提供商规范**:
- 继承 `BaseLLM`
- 实现统一的接口（`aask`, `acompletion`）
- 使用工厂模式创建实例

#### 2.2.5 编排层（orchestration/）

**职责**: 管理角色协作和工作流

**关键类**:
- `Environment`: 角色容器，消息路由
- `Team`: 团队管理，预算控制
- `ProjectManager`: 项目管理器（文件系统操作）

#### 2.2.6 服务层（services/）

**职责**: 提供业务服务功能

**关键服务**（共10个）:
- `WorkflowService`: 工作流配置和管理
- `RAGService`: RAG检索增强生成
- `EmbeddingService`: 向量嵌入生成
- `QdrantService`: Qdrant向量数据库集成
- `RerankService`: 结果重排序
- `RoleActionService`: 角色Action管理
- `SectionAdjustService`: PRD/MRD章节调整
- `StagehandService`: Stagehand集成
- `DocumentArchiveService`: 文档归档
- `GitService`: Git仓库管理（11个Git操作方法）

#### 2.2.7 执行器层（executors/）

**职责**: 提供Action执行能力

**关键执行器**:
- `LLMExecutor`: LLM执行器，用于LLM-based Actions
- `CLIExecutor`: CLI执行器，用于CLI-based Actions（支持Aider和Cursor）
- `ExecutorFactory`: 执行器工厂，根据Action类型选择合适的执行器

**CLI提供商**:
- `AiderCLIProvider`: Aider CLI集成
- `CursorCLIProvider`: Cursor Agent CLI集成

#### 2.2.8 工作流层（workflow/）

**职责**: 工作流执行引擎

**关键类**:
- `WorkflowExecutor`: 工作流执行器
- `WorkflowExecutionService`: 工作流执行服务
- `WorkflowStateMachine`: 工作流状态机
- `WorkflowRecoveryService`: 工作流恢复服务

---

## 3. 前端目录结构

### 3.1 详细结构

```
frontend/
├── src/
│   ├── assets/                  # 静态资源
│   │   ├── images/              # 图片
│   │   ├── icons/               # 图标
│   │   ├── fonts/               # 字体
│   │   └── styles/              # 全局样式
│   │       ├── variables.scss   # 样式变量
│   │       ├── mixins.scss      # 样式混入
│   │       ├── reset.scss       # 样式重置
│   │       └── global.scss      # 全局样式
│   ├── components/              # 组件
│   │   ├── common/              # 通用组件
│   │   │   ├── Button.vue
│   │   │   ├── Input.vue
│   │   │   ├── Modal.vue
│   │   │   ├── Card.vue
│   │   │   └── index.ts
│   │   ├── layout/              # 布局组件
│   │   │   ├── Header.vue
│   │   │   ├── Sidebar.vue
│   │   │   ├── Footer.vue
│   │   │   └── index.ts
│   │   ├── project/             # 项目相关组件
│   │   │   ├── ProjectCard.vue
│   │   │   ├── ProjectList.vue
│   │   │   ├── ProjectEditor.vue
│   │   │   └── index.ts
│   │   ├── team/                # 团队相关组件
│   │   │   ├── TeamPanel.vue
│   │   │   ├── RoleCard.vue
│   │   │   ├── MessageFlow.vue
│   │   │   └── index.ts
│   │   └── chat/                # 聊天相关组件
│   │       ├── ChatBox.vue
│   │       ├── MessageList.vue
│   │       ├── MessageItem.vue
│   │       └── index.ts
│   ├── views/                   # 页面视图
│   │   ├── Home.vue             # 首页
│   │   ├── Dashboard.vue        # 仪表板
│   │   ├── ProjectCreate.vue    # 创建项目
│   │   ├── ProjectDetail.vue    # 项目详情
│   │   ├── TeamManage.vue       # 团队管理
│   │   ├── Settings.vue         # 设置
│   │   └── About.vue            # 关于
│   ├── router/                   # 路由配置
│   │   └── index.ts              # 路由主文件
│   ├── stores/                   # 状态管理（Pinia）
│   │   ├── businessLine.ts       # 业务线状态
│   │   ├── platform.ts           # 平台状态
│   │   └── roleAction.ts         # 角色Action状态
│   ├── api/                      # API 调用
│   │   └── client.ts             # API客户端
│   ├── components/                # 组件
│   │   └── common/               # 通用组件
│   │       ├── CardHeader.vue
│   │       ├── EmptyState.vue
│   │       ├── PageHeader.vue
│   │       └── StatCard.vue
│   ├── config/                   # 配置
│   │   └── stageConfig.ts        # 阶段配置
│   └── utils/                     # 工具函数
│       ├── errorHandler.ts       # 错误处理
│       └── polling.ts           # 轮询工具
│   ├── composables/             # 组合式函数
│   │   ├── useProject.ts        # 项目相关逻辑
│   │   ├── useTeam.ts           # 团队相关逻辑
│   │   ├── useMessage.ts        # 消息相关逻辑
│   │   └── index.ts
│   ├── utils/                   # 工具函数
│   │   ├── format.ts            # 格式化工具
│   │   ├── validators.ts        # 验证器
│   │   ├── storage.ts           # 本地存储
│   │   └── index.ts
│   ├── types/                   # 类型定义
│   │   ├── project.types.ts
│   │   ├── team.types.ts
│   │   ├── role.types.ts
│   │   └── index.ts
│   ├── constants/               # 常量定义
│   │   ├── routes.ts            # 路由常量
│   │   ├── api.ts               # API 常量
│   │   └── index.ts
│   ├── directives/              # 自定义指令
│   │   ├── loading.ts
│   │   ├── permission.ts
│   │   └── index.ts
│   ├── plugins/                 # 插件
│   │   ├── i18n.ts              # 国际化
│   │   └── index.ts
│   ├── App.vue                  # 根组件
│   └── main.ts                  # 应用入口
├── public/                      # 公共静态资源
│   ├── favicon.ico
│   ├── logo.png
│   └── index.html
├── tests/                       # 测试
│   ├── unit/                    # 单元测试
│   │   ├── components/
│   │   └── utils/
│   ├── e2e/                     # 端到端测试
│   │   └── specs/
│   └── setup.ts
├── dist/                        # 构建输出（自动生成）
├── node_modules/                # 依赖（自动生成）
├── package.json                 # 依赖配置
├── vite.config.ts               # Vite 配置
├── tsconfig.json                # TypeScript 配置
├── vitest.config.ts             # Vitest 配置
├── .eslintrc.js                 # ESLint 配置
├── .prettierrc                  # Prettier 配置
├── .env.development             # 开发环境变量
├── .env.production              # 生产环境变量
└── README.md                    # 前端说明
```

### 3.2 核心模块说明

#### 3.2.1 组件层（components/）

**分类原则**:
- `common/`: 通用 UI 组件，不包含业务逻辑
- `layout/`: 布局组件
- 业务组件：按功能模块分类（如 `project/`, `team/`）

**组件命名规范**:
- 文件名：PascalCase，如 `ProjectCard.vue`
- 组件名：与文件名一致

#### 3.2.2 视图层（views/）

**职责**: 页面级组件，对应路由

**命名规范**:
- 文件名：PascalCase，如 `ProjectCreate.vue`
- 一个视图对应一个路由

#### 3.2.3 状态管理（stores/）

**使用 Pinia**:
```typescript
// stores/project.ts
import { defineStore } from 'pinia';

export const useProjectStore = defineStore('project', {
  state: () => ({
    projects: [],
    currentProject: null
  }),
  actions: {
    async fetchProjects() {
      // 实现逻辑
    }
  }
});
```

#### 3.2.4 组合式函数（composables/）

**职责**: 可复用的业务逻辑

**命名规范**: `use` 开头，如 `useProject.ts`

---

## 4. 数据库目录结构

### 4.1 详细结构

```
database/
├── prisma/                      # Prisma ORM
│   ├── schema.prisma            # 数据库模式定义
│   ├── migrations/              # 迁移文件（自动生成）
│   │   ├── 20250101000000_init/
│   │   ├── 20250102000000_add_teams/
│   │   └── migration_lock.toml
│   └── seed.ts                  # 种子数据脚本
├── schema/                      # 数据库模式文档
│   ├── ERD.md                   # 实体关系图
│   ├── tables.md                # 表结构文档
│   └── indexes.md               # 索引设计
├── migrations/                  # 自定义迁移脚本
│   ├── 001_create_tables.sql
│   ├── 002_add_indexes.sql
│   └── README.md
├── seeds/                       # 种子数据
│   ├── development/             # 开发环境数据
│   │   ├── users.json
│   │   ├── projects.json
│   │   └── teams.json
│   ├── test/                    # 测试环境数据
│   │   └── test-data.json
│   └── production/              # 生产环境数据（初始数据）
│       └── initial-data.json
├── backup/                      # 数据库备份
│   └── .gitkeep
├── scripts/                     # 数据库脚本
│   ├── setup.sh                 # 初始化数据库
│   ├── migrate.sh               # 执行迁移
│   ├── seed.sh                  # 执行种子数据
│   ├── backup.sh                # 备份脚本
│   └── restore.sh               # 恢复脚本
└── README.md                    # 数据库说明
```

### 4.2 Prisma Schema 示例

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Project {
  id          String   @id @default(uuid())
  name        String
  description String?
  status      String
  teamId      String
  team        Team     @relation(fields: [teamId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([teamId])
  @@index([status])
}

model Team {
  id        String    @id @default(uuid())
  name      String
  budget    Float     @default(0)
  projects  Project[]
  roles     Role[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Role {
  id       String   @id @default(uuid())
  name     String
  profile  String
  teamId   String
  team     Team     @relation(fields: [teamId], references: [id])
  messages Message[]
  
  @@index([teamId])
}

model Message {
  id        String   @id @default(uuid())
  content   String
  roleId    String
  role      Role     @relation(fields: [roleId], references: [id])
  createdAt DateTime @default(now())
  
  @@index([roleId])
  @@index([createdAt])
}
```

---

## 5. 配置文件说明

### 5.1 根配置文件

#### package.json（根级 - Monorepo）

```json
{
  "name": "mind2build",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "backend",
    "frontend",
    "shared"
  ],
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm run dev",
    "build": "npm run build:backend && npm run build:frontend",
    "build:backend": "cd backend && npm run build",
    "build:frontend": "cd frontend && npm run build",
    "test": "npm run test:backend && npm run test:frontend",
    "test:backend": "cd backend && npm run test",
    "test:frontend": "cd frontend && npm run test",
    "lint": "npm run lint:backend && npm run lint:frontend",
    "lint:backend": "cd backend && npm run lint",
    "lint:frontend": "cd frontend && npm run lint"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
```

#### pnpm-workspace.yaml

```yaml
packages:
  - 'backend'
  - 'frontend'
  - 'shared'
```

#### .env.example

```bash
# 数据库配置
DATABASE_URL="postgresql://user:password@localhost:5432/mind2build"

# LLM API Keys
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_API_KEY="AIza..."

# 服务配置
BACKEND_PORT=3000
FRONTEND_PORT=5173

# 环境
NODE_ENV=development

# JWT Secret
JWT_SECRET="your-secret-key"

# 日志级别
LOG_LEVEL=debug
```

### 5.2 后端配置文件

#### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@core/*": ["src/core/*"],
      "@roles/*": ["src/roles/*"],
      "@actions/*": ["src/actions/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

#### .eslintrc.js

```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off'
  }
};
```

### 5.3 前端配置文件

#### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@views': path.resolve(__dirname, './src/views'),
      '@stores': path.resolve(__dirname, './src/stores')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
```

---

## 6. 目录设计原则

### 6.1 分层架构原则

**垂直分层**:
```
用户接口层 (CLI / Web UI)
      ↓
编排层 (Team / Environment)
      ↓
角色层 (ProductManager / Engineer)
      ↓
行动层 (WritePRD / WriteCode)
      ↓
基础设施层 (Message / Memory)
      ↓
提供商层 (LLM / Tools)
```

**水平模块化**:
- 每层独立，低耦合
- 使用依赖注入，避免硬编码
- 明确的接口定义

### 6.2 命名规范

#### 文件命名
- **TypeScript/JavaScript**: PascalCase（类）或 camelCase（工具）
  - 类文件：`ProductManager.ts`
  - 工具文件：`logger.ts`
- **Vue 组件**: PascalCase
  - `ProjectCard.vue`
- **样式文件**: kebab-case
  - `global-styles.scss`
- **配置文件**: kebab-case 或约定俗成
  - `tsconfig.json`, `vite.config.ts`

#### 目录命名
- 全部使用 **小写 + 连字符** 或 **小驼峰**
  - 推荐：`message-queue/` 或 `messageQueue/`
  - 保持项目内一致性

#### 导出规范
```typescript
// 默认导出（单个核心类）
export default ProductManager;

// 命名导出（多个工具函数）
export { formatDate, parseJSON };

// index.ts 统一导出
export * from './ProductManager';
export * from './Architect';
```

### 6.3 模块职责单一

**SOLID 原则**:
- **S**ingle Responsibility: 每个模块只负责一个功能
- **O**pen/Closed: 对扩展开放，对修改关闭
- **L**iskov Substitution: 子类可替换父类
- **I**nterface Segregation: 接口隔离
- **D**ependency Inversion: 依赖倒置

**示例**:
```
✅ 好的设计:
actions/
  ├── WritePRD.ts      # 只负责写 PRD
  ├── WriteDesign.ts   # 只负责写设计
  └── WriteCode.ts     # 只负责写代码

❌ 不好的设计:
actions/
  └── WriteEverything.ts  # 做所有事情
```

### 6.4 可扩展性设计

**插件化机制**:
- 角色可扩展（继承 `BaseRole`）
- 行动可扩展（继承 `BaseAction`）
- LLM 提供商可扩展（继承 `BaseLLM`）

**配置驱动**:
- 通过配置文件定义角色和工作流
- 避免硬编码逻辑

### 6.5 测试友好

**测试目录结构镜像源代码**:
```
src/
  ├── roles/
  │   └── ProductManager.ts
  └── actions/
      └── WritePRD.ts

tests/
  ├── unit/
  │   ├── roles/
  │   │   └── ProductManager.test.ts
  │   └── actions/
  │       └── WritePRD.test.ts
```

**依赖注入便于 Mock**:
```typescript
// ✅ 依赖注入
class ProductManager {
  constructor(private llm: BaseLLM) {}
}

// ❌ 硬编码
class ProductManager {
  private llm = new OpenAILLM();  // 难以测试
}
```

---

## 7. 目录扩展指南

### 7.1 添加新角色

**步骤**:
1. 在 `backend/src/roles/` 创建新文件
2. 继承 `Role` 基类
3. 定义角色属性（name, profile, goal）
4. 设置 `actions` 和 `_watch`
5. 在 `roles/index.ts` 导出
6. 编写单元测试

**示例**:
```typescript
// backend/src/roles/Designer.ts
import { Role } from './Role';
import { WriteUIDesign } from '../actions';

export class Designer extends Role {
  constructor() {
    super({
      name: 'Charlie',
      profile: 'UI/UX Designer',
      goal: 'Create beautiful user interfaces',
      actions: [WriteUIDesign]
    });
    this._watch([WritePRD]);
  }
}

export default Designer;
```

### 7.2 添加新 Action

**步骤**:
1. 在 `backend/src/actions/` 创建新文件
2. 继承 `Action` 基类
3. 实现 `run()` 方法
4. 在 `actions/index.ts` 导出
5. 编写单元测试

**示例**:
```typescript
// backend/src/actions/WriteUIDesign.ts
import { Action } from './Action';

export class WriteUIDesign extends Action {
  name = 'WriteUIDesign';
  
  async run(prd: Document): Promise<Document> {
    const prompt = this.buildPrompt(prd);
    const result = await this.llm.aask(prompt);
    return new Document('UI_Design.md', result);
  }
  
  private buildPrompt(prd: Document): string {
    return `Based on this PRD, create UI design:\n${prd.content}`;
  }
}
```

### 7.3 添加新 LLM 提供商

**步骤**:
1. 在 `backend/src/providers/llm/` 创建新文件
2. 继承 `BaseLLM`
3. 实现 `aask()` 和 `acompletion()` 方法
4. 在 `factory.ts` 注册
5. 编写单元测试

**示例**:
```typescript
// backend/src/providers/llm/CustomLLM.ts
import { BaseLLM } from './BaseLLM';

export class CustomLLM extends BaseLLM {
  async aask(prompt: string): Promise<string> {
    // 调用自定义 LLM API
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });
    return response.text();
  }
}

// factory.ts
import { CustomLLM } from './CustomLLM';

export function createLLM(type: string, config: LLMConfig): BaseLLM {
  switch (type) {
    case 'openai': return new OpenAILLM(config);
    case 'custom': return new CustomLLM(config);
    default: throw new Error(`Unknown LLM type: ${type}`);
  }
}
```

### 7.4 添加新工具

**步骤**:
1. 在 `backend/src/tools/` 创建新文件
2. 定义工具接口和实现
3. 在 `tools/index.ts` 导出
4. 在角色中引用

**示例**:
```typescript
// backend/src/tools/Calculator.ts
export class Calculator {
  async calculate(expression: string): Promise<number> {
    // 实现计算逻辑
    return eval(expression);
  }
}

// 在角色中使用
class DataAnalyst extends Role {
  constructor() {
    super({
      name: 'Dana',
      profile: 'Data Analyst',
      tools: ['Calculator', 'Editor']
    });
  }
}
```

### 7.5 添加前端页面

**步骤**:
1. 在 `frontend/src/views/` 创建新页面
2. 在 `router/routes.ts` 添加路由
3. 创建相关组件（在 `components/` 下）
4. 创建状态管理（在 `stores/` 下）
5. 创建 API 调用（在 `api/` 下）

**示例**:
```typescript
// frontend/src/views/Analytics.vue
<template>
  <div class="analytics">
    <h1>数据分析</h1>
    <AnalyticsChart :data="chartData" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AnalyticsChart from '@/components/analytics/AnalyticsChart.vue';

const chartData = ref([]);
</script>

// frontend/src/router/routes.ts
export const routes = [
  // ...
  {
    path: '/analytics',
    name: 'Analytics',
    component: () => import('@/views/Analytics.vue')
  }
];
```

---

## 8. 目录最佳实践

### 8.1 保持目录简洁

**原则**:
- 避免过深的嵌套（建议 ≤ 4 层）
- 模块不超过 10 个文件时，不必再拆分子目录
- 使用 `index.ts` 统一导出

**示例**:
```
✅ 好的结构（清晰）:
actions/
  ├── WritePRD.ts
  ├── WriteDesign.ts
  ├── WriteCode.ts
  └── index.ts

❌ 过度拆分:
actions/
  ├── write/
  │   ├── prd/
  │   │   └── WritePRD.ts
  │   ├── design/
  │   │   └── WriteDesign.ts
  │   └── code/
  │       └── WriteCode.ts
  └── index.ts
```

### 8.2 使用 Barrel Exports

**目的**: 简化导入路径

**示例**:
```typescript
// roles/index.ts
export { ProductManager } from './ProductManager';
export { Architect } from './Architect';
export { Engineer } from './Engineer';

// 使用时
import { ProductManager, Architect } from '@/roles';
```

### 8.3 分离关注点

**前后端分离**:
- 后端：业务逻辑、数据处理
- 前端：UI 展示、用户交互
- 共享：类型定义、常量

**示例**:
```
shared/
  ├── types/
  │   └── project.types.ts    # 前后端共享的项目类型
  └── constants/
      └── status.ts           # 前后端共享的状态常量
```

### 8.4 版本控制忽略

**.gitignore 规范**:
```gitignore
# 依赖
node_modules/
pnpm-lock.yaml

# 构建输出
dist/
build/

# 环境变量
.env
.env.local
.env.*.local

# 日志
logs/
*.log

# IDE
.vscode/
.idea/

# 系统文件
.DS_Store
Thumbs.db

# 测试覆盖率
coverage/

# 生成的工作区项目
workspace/*
!workspace/.gitkeep

# 数据库
*.db
*.sqlite
```

### 8.5 文档驱动

**每个目录都应有 README.md**:
```
backend/
  ├── src/
  │   ├── roles/
  │   │   ├── README.md       # 说明角色系统的设计和使用
  │   │   ├── ProductManager.ts
  │   │   └── ...
  │   └── ...
  └── README.md               # 后端整体说明
```

---

## 9. 常见问题（FAQ）

### Q1: 如何决定某个模块应该放在哪一层？

**A**: 根据职责划分：
- **基础设施层**: 提供核心抽象和基础服务（Message, Memory）
- **提供商层**: 对接外部服务（LLM, Tools）
- **行动层**: 执行具体任务（WritePRD, WriteCode）
- **角色层**: 定义 AI 角色（ProductManager, Engineer）
- **编排层**: 管理协作流程（Team, Environment）
- **接口层**: 用户交互入口（CLI, API）

### Q2: 前后端共享代码应该如何组织？

**A**: 创建 `shared/` 目录：
```
shared/
  ├── types/        # 共享类型定义
  ├── utils/        # 共享工具函数
  └── constants/    # 共享常量
```

在 package.json 中配置工作区：
```json
{
  "workspaces": ["backend", "frontend", "shared"]
}
```

### Q3: 测试文件应该放在哪里？

**A**: 推荐在项目根级创建 `tests/` 目录，镜像 `src/` 结构：
```
backend/
  ├── src/
  │   └── roles/
  │       └── ProductManager.ts
  └── tests/
      └── unit/
          └── roles/
              └── ProductManager.test.ts
```

也可以采用就近原则（测试文件和源文件放在一起）：
```
src/
  └── roles/
      ├── ProductManager.ts
      └── ProductManager.test.ts
```

### Q4: 如何管理配置文件？

**A**: 
1. 使用环境变量（`.env` 文件）存储敏感信息
2. 使用配置文件（`config/` 目录）存储非敏感配置
3. 配置优先级：环境变量 > 配置文件 > 默认值

```typescript
// config/Config.ts
export class Config {
  static load() {
    return {
      llm: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.LLM_MODEL || 'gpt-4-turbo'
      },
      database: {
        url: process.env.DATABASE_URL
      }
    };
  }
}
```

### Q5: workspace/ 目录下生成的项目如何管理？

**A**:
- `workspace/` 用于存放 AI 生成的项目
- **每个项目使用独立的 Git 仓库管理**
- 项目初始化时会自动拉取 Git 仓库（如果提供仓库地址）
- 所有文档（MRD、PRD、系统设计文档等）和代码都存储在 Git 仓库中
- 如果已有项目文档或代码，系统会根据版本号创建不同的分支

**Git 仓库管理**:
```
workspace/
  ├── {applicationId}/          # 应用ID
  │   └── {projectId}/          # 项目ID
  │       ├── v1/               # 版本1（对应Git分支 v1）
  │       │   ├── MRD/         # 需求说明文档
  │       │   ├── PRD/         # 产品需求文档
  │       │   ├── DESIGN/      # 系统设计文档
  │       │   ├── CODE/        # 源代码
  │       │   └── TEST/         # 测试代码
  │       └── v2/               # 版本2（对应Git分支 v2）
  │           └── ...
  └── .gitkeep
```

**Git 分支管理策略**:
- 每个版本对应一个 Git 分支（如 `v1`, `v2`, `v3`）
- 主分支（`main` 或 `master`）存储最新稳定版本
- 初始化项目时：
  - 如果提供 Git 仓库地址，自动执行 `git clone`
  - 如果仓库已存在，检查当前版本并创建新分支
  - 所有文档和代码提交到对应版本分支
- 版本分支命名规范：`v{version}`（如 `v1`, `v2`, `v3`）

**项目初始化流程**:
1. 用户提供项目需求和 Git 仓库地址（可选）
2. 如果提供仓库地址：
   - 执行 `git clone <repository_url>` 拉取仓库
   - 检查是否存在已有文档或代码
   - 如果存在，根据版本号创建新分支（如 `v2`, `v3`）
   - 如果不存在，在 `main` 分支开始工作
3. 所有生成的文档和代码保存到 Git 仓库
4. 自动提交到对应版本分支

---

## 10. 总结

### 10.1 目录设计要点

1. **分层清晰**: 按照架构层次组织目录
2. **模块独立**: 每个模块职责单一，低耦合
3. **命名规范**: 统一的文件和目录命名规则
4. **可扩展性**: 易于添加新功能和模块
5. **测试友好**: 便于编写和维护测试
6. **文档完善**: 每个重要目录都有说明文档

### 10.2 核心目录关系图

```mermaid
graph TB
    Root[项目根目录]
    
    Root --> Backend[backend/<br/>后端服务]
    Root --> Frontend[frontend/<br/>前端应用]
    Root --> Database[database/<br/>数据库]
    Root --> Shared[shared/<br/>共享代码]
    Root --> Doc[doc/<br/>文档]
    Root --> Scripts[scripts/<br/>脚本]
    Root --> Config[config/<br/>配置]
    Root --> Workspace[workspace/<br/>工作区]
    
    Backend --> Core[core/<br/>核心层]
    Backend --> Roles[roles/<br/>角色层]
    Backend --> Actions[actions/<br/>行动层]
    Backend --> Providers[providers/<br/>提供商层]
    Backend --> Orchestration[orchestration/<br/>编排层]
    Backend --> API[api/<br/>API层]
    
    Frontend --> Components[components/<br/>组件]
    Frontend --> Views[views/<br/>视图]
    Frontend --> Stores[stores/<br/>状态管理]
    Frontend --> Router[router/<br/>路由]
    
    Database --> Prisma[prisma/<br/>ORM]
    Database --> Migrations[migrations/<br/>迁移]
    Database --> Seeds[seeds/<br/>种子数据]
    
    Shared --> Types[types/<br/>类型]
    Shared --> Utils[utils/<br/>工具]
```

### 10.3 下一步行动

1. **创建目录结构**: 根据本文档创建完整的目录结构
2. **配置开发环境**: 设置 TypeScript、ESLint、Prettier
3. **实现核心模块**: 按照任务拆解文档开始实现
4. **编写测试**: 同步编写单元测试和集成测试
5. **完善文档**: 为每个模块编写详细文档

---

**文档维护**: 随着项目发展，及时更新目录结构文档  
**反馈渠道**: GitHub Issues

---

**参考文档**:
- [04_系统架构文档_ARCHITECTURE.md](./04_系统架构文档_ARCHITECTURE.md)
- [11_任务拆解文档_TASKS.md](./11_任务拆解文档_TASKS.md)
- [14_开发指南_DEVELOPMENT.md](./14_开发指南_DEVELOPMENT.md)

