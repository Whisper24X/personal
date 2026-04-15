# 前端架构优化方案可行性分析与执行计划

> **文档性质**：本文档为 **项目背景与历史决策记录**（可行性论证、分阶段实施、风险与细节目录树）。**规范性条文**（依赖方向、公开入口、CLI 边界）以 `.agents/skills/frontend-architecture/references/spa-architecture.md` 与 `multi-frontend-alignment.md` 为准；与本文不一致时以 skill references 为准。

> **主文档位置**：`docs/technical/frontend-architecture-feasibility-analysis.md`。本仓库 **frontend 重构** 的可行性、目标架构（五分区）、分阶段执行计划与风险以**本文**为历史与规划叙述。  
> **dev-spec 副本**：`docs/dev-spec/frontend/` 下 [`ARCHITECTURE.md`](../dev-spec/frontend/ARCHITECTURE.md)（本 Web SPA 目标分层摘要）、[`ARCHITECTURE_app.md`](../dev-spec/frontend/ARCHITECTURE_app.md)、[`ARCHITECTURE_shadow.md`](../dev-spec/frontend/ARCHITECTURE_shadow.md)（另两产品线对照，与 Skill `multi-frontend-alignment.md` 一致）；**§1.2** 摘录要点并链向全文。

---

## 一、文档定位

本文档结合当前 `frontend/` 代码库现状，对**五分区目标架构**的可行性进行分析，并给出分阶段执行计划。**目标形态的核心叙述集中在本文第四章（理论）与第五章（分层、目录树、数据流、依赖）**；不依赖其它独立「架构 md」文件，避免后续删文导致断链。

**规范性条文（依赖方向、CLI、日常开发约束）的唯一正文**：`.agents/skills/frontend-architecture/references/spa-architecture.md` 与 `multi-frontend-alignment.md`。

历史分析语境中曾以仓库内旧稿「基准方案 `frontend-architecture.md`」「辅助方案 `frontend-ai-friendly-architecture.md`」对比五分区与九目录；**执行与评审时以 Skill 包 + 本文第五、八章为准**，旧稿仅作背景。

核心原则：**不做大爆炸式重构，采用兼容迁移，允许新旧结构共存。**

### 1.1 目标架构核心要点（速览）

以下为重构目标**最小自洽摘要**（与 Skill `spa-architecture.md` 一致；详图与执行目录树见 **第五章**）。

| 项目 | 内容 |
|------|------|
| **五分区顶层** | `app/` 装配（入口、路由、全局 Pinia、壳、指令、应用级配置）；`pages/` 路由薄壳；`features/` 按域业务，对外仅经 **`index.ts`** 公开；`api/` HTTP 与按域请求、契约类型；`shared/` 通用 UI、工具、常量、通用类型、i18n |
| **与阅读习惯的对应** | 「装配层 / 页面层 / 组件层 / 状态层 / 数据层 / 共享与横切」分别主要对应 `app` / `pages` / `features` / stores（在 app 或各 feature 内）/ `api` / `shared`，便于与 [`docs/dev-spec/frontend/ARCHITECTURE_app.md`](../dev-spec/frontend/ARCHITECTURE_app.md)、[`ARCHITECTURE_shadow.md`](../dev-spec/frontend/ARCHITECTURE_shadow.md) 对照，**非强制目录同名** |
| **依赖矩阵** | 见 **第八章 §8.3**；硬约束：`api`、`shared` 不得依赖 `features` / `pages` / `app`；跨 feature 仅允许 **公开 API** |
| **迁移** | 新旧结构可并存；新功能优先落五分区；`views/` → `pages/`；巨型逻辑进对应 `features/<域>`；**CLI** 仍按 agent 分目录、禁止跨 agent 引用 UI（详见 Skill） |
| **路径别名（建议）** | `@app/`、`@pages/`、`@features/`、`@shared/`（与现有 `@/` 并存，以团队配置为准） |

### 1.2 dev-spec 前端架构副本与三端对照（摘录）

下列内容与 **`docs/dev-spec/frontend/`** 内三份文档一致，**重构评审时**可与本第五章、第八章及 Skill **对照阅读**；三端**不要求**顶层目录同构，对齐 **职责与数据流**（统一请求层、鉴权集中、状态驱动视图、路由守卫）。

| 副本文件 | 用途 |
|----------|------|
| [`ARCHITECTURE.md`](../dev-spec/frontend/ARCHITECTURE.md) | 本仓库 **Vue SPA** 目标五分区与「装配→…→共享」分层框图、**与 app/shadow 的用语映射表**、目标 `src/` 树摘要、构建与横切 |
| [`ARCHITECTURE_app.md`](../dev-spec/frontend/ARCHITECTURE_app.md) | **ainative-app**（Taro）：页面/组件/store/api/横切 五层框图、Webpack 入口、`pages.json` 路由、目录树、多端与 AI 注意点 |
| [`ARCHITECTURE_shadow.md`](../dev-spec/frontend/ARCHITECTURE_shadow.md) | **ainative-shadow**（管理端）：views/components/hooks·store/api 四层框图、Axios 数据流、`src/` 目录树、权限与横切 |

**ainative-app — 整体分层（节选）**

```
┌──────────────────────────────────────────────┐
│  页面层 (pages)     路由页面、业务编排        │
├──────────────────────────────────────────────┤
│  组件层 (components)  导航、TabBar、反馈组件等 │
├──────────────────────────────────────────────┤
│  状态层 (store)     Pinia，持久化到端存储     │
├──────────────────────────────────────────────┤
│  数据层 (api)       Taro.request 封装、鉴权   │
├──────────────────────────────────────────────┤
│  横切 (utils)       路由守卫、埋点、上传等      │
└──────────────────────────────────────────────┘
```

- 入口：`src/app.ts`；路由：`app.config.ts` + `pages.json`；数据流：`api` → 统一请求层（Token、401）→ Pinia → 界面；路由守卫见 `utils/routerGuard`。（详见副本全文。）

**ainative-shadow — 整体分层（节选）**

```
┌──────────────────────────────────────────────┐
│  视图层 (views)     页面、业务编排、用户交互   │
├──────────────────────────────────────────────┤
│  组件层 (components)  基础/表单/表格/布局等   │
├──────────────────────────────────────────────┤
│  逻辑层 (hooks / store)  useTable 等、Pinia   │
├──────────────────────────────────────────────┤
│  数据层 (api / utils/http)  请求、类型、工具   │
└──────────────────────────────────────────────┘
```

- 请求链：页面 → Hook → `utils/http`（Axios）→ 拦截器 → Store/视图；权限：路由守卫、动态路由、`v-auth`。（详见副本全文。）

**与本仓库 `frontend` 目标的关系**

- **第五章** 与 [`dev-spec/frontend/ARCHITECTURE.md`](../dev-spec/frontend/ARCHITECTURE.md) 描述**同一套** Web 侧目标（五分区 + 映射表）；第五章另含 **执行用目录树、Phase 计划**。
- **app / shadow** 副本用于 **跨产品线** 对齐接口与语义；**不**要求把 Taro 或 shadow 的目录名搬到本仓库。

---

## 二、当前项目现状摘要

### 2.1 技术栈

| 维度 | 现状 |
|------|------|
| 框架 | Vue 3.5 + TypeScript 5.9 |
| 构建工具 | Vite 7 |
| 路由 | Vue Router 5 |
| 状态管理 | Pinia 3 |
| CSS | Tailwind CSS 4 |
| UI 组件库 | shadcn-vue (new-york style) + Reka UI |
| 测试 | Vitest (单测) + Playwright (E2E) |
| Lint | ESLint + OxLint + Prettier |
| 包管理 | pnpm |
| 项目类型 | Monorepo（frontend/ + backend/） |

### 2.2 当前 `frontend/src/` 目录结构

```
frontend/src/
├── App.vue                 # 根组件
├── main.ts                 # 入口文件
├── api/                    # 15 个 API 模块（已按业务域拆分 ✅）
├── assets/                 # 静态资源 + 样式
├── components/             # 231 个文件（最大的目录，问题集中区 ⚠️）
│   ├── access/             # 权限相关组件
│   ├── business/settings/  # 跨业务聚集区（核心问题 ❌）
│   ├── core/               # 布局、反馈、文件浏览器、选择器
│   ├── goals/              # 目标相关组件
│   ├── knowledge-base/     # 知识库组件
│   ├── settings/           # 设置相关组件
│   ├── skills/             # 技能相关组件
│   ├── tasks/              # 任务相关组件（含 CLI 渲染器）
│   ├── ui/                 # shadcn-vue 基础 UI（80 个文件）
│   └── workflow/           # 工作流组件
├── config/                 # 应用配置（2 个文件）
├── constants/              # 常量定义（4 个文件）
├── directives/             # Vue 自定义指令（2 个文件）
├── enums/                  # 枚举（2 个文件）
├── hooks/                  # Composables（14 个文件）
├── keys/                   # Provide/Inject 键（1 个文件）
├── lib/                    # 工具库（1 个文件，shadcn cn()）
├── locales/                # 国际化
├── router/                 # 路由配置（模块化、守卫模式）
├── stores/                 # Pinia 状态管理（6 个模块）
├── types/                  # TypeScript 类型定义（25 个文件）
├── utils/                  # 工具函数（21 个文件）
├── views/                  # 页面视图（32 个文件，16 个路由模块）
└── workers/                # Web Workers（1 个文件）
```

**总计：375 个源文件（.vue + .ts）**

### 2.3 现状问题诊断

#### 已经做得好的部分 ✅

| 维度 | 说明 |
|------|------|
| `api/` 按业务域拆分 | 15 个模块，1:1 对应后端域，结构清晰 |
| `types/api/` 类型分离 | 与 api/ 目录镜像对应，维护方便 |
| CLI 渲染器分 provider | `tasks/detail/cli/<provider>` 隔离清晰 |
| 测试就近共置 | `__tests__/` 与源码同级，符合最佳实践 |
| 路由模块化 | core/guards/routes 三层分离 |
| Pinia 按模块拆分 | 6 个 store 模块职责清晰 |

#### 核心问题 ❌

| 问题 | 严重度 | 说明 |
|------|--------|------|
| **巨型文件** | 🔴 高 | `BusinessLineManagementPanel.vue`(4437行)、`projects/detail.vue`(2806行)、`AgentToolConfigModal.vue`(1636行) 等严重超标 |
| **`components/business/settings/` 跨域聚集** | 🔴 高 | 7个模态框混放，涉及业务线、MCP、技能、权限等多个业务域 |
| **页面承载过多业务逻辑** | 🟠 中 | `tasks/detail.vue`(1263行)、`mcp/index.vue`(1098行)、`skills/index.vue`(1091行) |
| **`hooks/core/useLayout.ts` 过大** | 🟠 中 | 922 行，混合了多种布局相关职责 |
| **目录维度混杂** | 🟠 中 | 按技术类型（components/hooks/utils）+ 按业务域（tasks/skills）+ 按页面入口（views）三种方式混合 |
| **顶层碎片目录** | 🟡 低 | `keys/`(1文件)、`workers/`(1文件)、`enums/`(2文件) 单独占顶层不合理 |

---

## 三、基准方案 vs 辅助方案对比分析

### 3.1 核心差异

| 维度 | 基准方案（`frontend-architecture.md`） | 辅助方案（`frontend-ai-friendly-architecture.md`） |
|------|----------------------------------------|------------------------------------------------|
| **顶层结构** | 传统分层：assets/components/composables/config/layouts/pages/services/stores/utils | 五分区：app/pages/features/api/shared |
| **组件组织** | 全局通用组件放 `components/`，业务私有放 pages 下 | 共享组件放 `shared/`，业务组件放 `features/*/components/` |
| **API 层** | `services/` 目录（base.ts + 业务模块） | `api/` 目录（与现有结构一致） |
| **Composables** | 顶层 `composables/` 统一管理 | 通用放 `shared/composables/`，业务放 `features/*/composables/` |
| **状态管理** | 顶层 `stores/` 统一管理 | 全局放 `app/stores/`，业务放 `features/*/stores/` |
| **迁移策略** | 一次性初始化新项目 | 兼容迁移，分 Phase 渐进执行 |
| **Cursor 规则** | 需要创建 `.cursor/rules/` 触发 Skill | 依赖 AGENTS.md + dev-spec + lint 守护 |
| **适用场景** | 全新项目从零开始 | 已有项目渐进式重构 |

### 3.2 可行性判定

| 判定项 | 基准方案 | 辅助方案 | 说明 |
|--------|---------|---------|------|
| 适用于已有项目 | ❌ 不适用 | ✅ 适用 | 基准方案面向新项目初始化，不考虑存量代码迁移 |
| 目录结构映射 | ⚠️ 部分冲突 | ✅ 高度匹配 | 基准方案的 `services/` 与现有 `api/` 冲突 |
| 迁移成本 | 🔴 极高 | 🟡 可控 | 基准方案要求一次性重写目录结构 |
| 业务域收口 | ❌ 不支持 | ✅ 核心能力 | 基准方案无 `features/` 概念，无法按业务域收口 |
| AI 友好度 | 🟡 中 | ✅ 高 | 辅助方案的五分区更利于 AI 快速定位 |
| 团队协作冲突 | 🔴 高 | 🟡 低 | 基准方案要求一步到位，辅助方案允许渐进 |

### 3.3 综合结论

> **基准方案适用于全新 Vue 项目的脚手架初始化，不适用于当前已有 375 个源文件的迭代项目。**
>
> **推荐采用辅助方案的核心架构思路（五分区 + feature first + 兼容迁移），同时吸收基准方案中的代码规范细节（SFC 结构规范、命名规范、Cursor 规则配置）作为补充。**

**与现行文档体系的衔接：** 上述「推荐采用」的目标形态由**本文第五章**统一描述（分层框图、五分区表、目标目录树、数据流与依赖）；无需再依赖其它独立架构稿。

---

## 四、为什么选择五分区分层 —— AI 友好型架构的理论依据

### 4.1 核心判断标准

> **分层要服务于 AI 的理解、生成、维护与扩展，而非为分层而分层。**

AI（尤其大模型）的核心弱点是：**上下文有限、易混淆职责、难理解隐式逻辑、难定位复杂代码问题**。清晰分层恰好解决这些问题：

| AI 弱点 | 分层如何解决 | 在五分区中的体现 |
|---------|------------|----------------|
| **上下文窗口有限** | 职责隔离，每层只做一件事，AI 不用在一团代码里猜职责 | `app/` 只管装配，`pages/` 只管路由入口，`features/` 只管业务域，`api/` 只管后端通信，`shared/` 只管通用能力 |
| **易混淆职责** | 显式接口，层间通过标准化接口通信，AI 明确知道 "该在哪个层写什么代码" | 每个 feature 通过 `index.ts` 暴露公开 API，跨层引用必须走公开入口 |
| **难理解隐式逻辑** | 显式化、语义化，层名 / 接口 / 方法名清晰（AI 靠名字理解意图） | 禁止隐式依赖、全局状态、魔法变量；依赖流向单向且可通过 lint 强制 |
| **难定位问题** | 故障隔离，独立演进，换框架 / 改实现只影响对应层 | 换 UI 库只动 `shared/ui/`，换 HTTP 客户端只动 `api/`，业务迭代只在 `features/` 内 |

### 4.2 分层过多的坏处（为什么不选 6 层+）

基准方案的九目录结构（assets / components / composables / config / layouts / pages / services / stores / utils）本质上是 **按技术类型的平铺分层**，在 AI 视角下存在明显问题：

| 问题 | 说明 |
|------|------|
| **AI 上下文爆炸** | 完成一个业务功能需要跨 components → composables → services → stores → types 五个目录，AI 难以在有限上下文内跟踪完整流程 |
| **路由 / 编排复杂** | 层间调用链过长，AI 容易写错层间调用、漏传上下文 |
| **代码碎片化** | 一个小功能的逻辑散落在多个顶层目录，AI 难以把握整体意图 |
| **高歧义落点** | AI 不确定一段代码应该放 `components/` 还是 `composables/` 还是 `utils/`，同一类逻辑在不同开发者（或不同 AI 会话）手中落点不同 |

### 4.3 分层过少的坏处（为什么不选 2 层）

如果只保留 Controller + Model 式的两层结构（如 `views/` + `components/`，即当前项目的近似现状）：

| 问题 | 说明 |
|------|------|
| **职责混杂** | UI 渲染、业务逻辑、API 调用、状态管理混在同一个文件 → AI 极易改错（正是当前巨型文件的根因） |
| **无法独立扩展** | 要改某个业务域必须理解整个 `components/` 目录 |
| **维护灾难** | AI 生成代码易 "面条化"，4437 行的 `BusinessLineManagementPanel.vue` 就是典型后果 |

### 4.4 五分区 = AI 友好的 "黄金分层"

根据 AI 友好型架构原则，**3～5 层是平衡点**。我们的五分区方案恰好落在这个最佳区间：

```
5 个顶层分区，对应 5 个清晰职责：

app/       → 应用装配（启动、路由、全局状态、布局壳）    ← 稳定层
pages/     → 页面入口（路由级编排，薄壳）               ← 易变层
features/  → 业务能力（按域内聚，高内聚低耦合）          ← 易变层
api/       → 后端通信（HTTP 客户端、请求 / 响应类型）    ← 稳定层
shared/    → 通用基座（UI 组件、工具、类型、常量）       ← 最稳定层
```

**与 AI 友好分层四原则的对应关系：**

| 原则 | 五分区的实现 |
|------|------------|
| **高内聚、低耦合** | `features/` 内部按业务域组织，层内功能高度相关；层间仅通过 `index.ts` 公开接口通信 |
| **依赖倒置** | 上层（pages）依赖下层（features/api/shared）的抽象接口，不依赖具体实现；改实现不改接口，风险可控 |
| **显式化、语义化** | 5 个顶层目录名即是职责声明，AI 看到路径就知道该文件的角色；禁止隐式依赖和魔法变量 |
| **稳定层在下，易变层在上** | `shared/` → `api/` → `features/` → `pages/` → `app/`，底层最稳定，上层可频繁迭代而不影响核心底座 |

### 4.5 选型结论

| 场景 | 推荐层数 | 本项目判定 |
|------|---------|-----------|
| 小型、简单、短期 AI 工具（快速原型、个人项目） | 2～3 层 | ❌ 不适用 — 375 个源文件，长期维护的企业级产品 |
| **绝大多数 AI 系统（企业级、产品化、长期维护）** | **4～5 层** | **✅ 正是本项目 — 五分区方案** |
| 超大型、多团队、强隔离场景（AI 平台、多云多模型底座） | 6 层+ | ❌ 不适用 — 单前端团队，无需过度隔离 |

> **一句话总结：AI 友好 = 清晰分层（3～5 层）+ 单一职责 + 显式接口 + 稳定抽象。五分区方案不多不少，刚好让 AI 和人都能轻松看懂、修改、扩展。**

---

## 五、适配后的目标架构

综合五分区理论依据（第四章）与项目现状，推荐的目标结构如下。

### 5.1 两种表述如何对应

- **目录名（五分区）**：`app` / `pages` / `features` / `api` / `shared` —— 与 Skill `spa-architecture.md` 一致，也是迁移时的物理落点。
- **分层用语（与多端文档对齐）**：**装配层 → 页面层 → 组件层 → 状态层 → 数据层 → 共享与横切** —— 便于与 **ainative-app / ainative-shadow** 架构说明对照阅读（见 §5.2 对照表），不改变五分区规范本身。
- **本章下文**：给出较细**目标目录树**（便于 Phase 执行），与 §1.1 速览、第八章依赖约定一致。

### 5.2 整体分层（与 app / shadow 文档用语对齐）

依赖自上而下：**装配 → 页面编排 → 业务组件与组合式逻辑 → 状态 → 请求与契约 → 通用能力与横切**。

```
┌──────────────────────────────────────────────────────────────┐
│  装配层 (app)          入口、路由、布局壳、指令、应用级配置      │
├──────────────────────────────────────────────────────────────┤
│  页面层 (pages)        路由页面、薄编排、组合各 feature 公开能力 │
├──────────────────────────────────────────────────────────────┤
│  组件层 (features)     业务域组件、composables、域内展示逻辑     │
├──────────────────────────────────────────────────────────────┤
│  状态层 (stores)       Pinia：全局（app）与域内（feature）状态   │
├──────────────────────────────────────────────────────────────┤
│  数据层 (api)          请求封装、领域 API 模块、契约类型          │
├──────────────────────────────────────────────────────────────┤
│  共享与横切 (shared)   通用 UI、工具、常量、通用类型、i18n 等     │
└──────────────────────────────────────────────────────────────┘
```

**与另两端架构文档的概念映射（非目录同名）：**

| 本分层（frontend 目标） | ainative-app | ainative-shadow |
|-------------------------|--------------|-----------------|
| 装配层 (app) | `app.ts`、全局初始化、路由配置入口 | `main` / `router` / `plugins`、全局能力 |
| 页面层 (pages) | 页面层 (pages) | 视图层 (views) |
| 组件层 (features) | 组件层中业务相关部分 | 组件层 + 业务向逻辑 |
| 状态层 (stores) | 状态层 (store) | 逻辑层中的 Pinia / hooks 中的状态侧 |
| 数据层 (api) | 数据层 (api) | 数据层 (api / utils/http) |
| 共享与横切 (shared) | 横切 (utils) + 通用组件 | `utils`、通用组件、locales 等 |

### 5.3 五分区 `src/` 骨架

| 分区 | 职责 | 角色 |
|------|------|------|
| `app/` | 应用装配：入口、路由、全局 Pinia、布局壳、指令、应用级配置 | 装配层 |
| `pages/` | 路由级页面入口：薄编排，组合各 feature 公开能力 | 易变层 |
| `features/` | 业务能力：按域内聚；对外仅经 `index.ts` 暴露 | 易变层 |
| `api/` | HTTP、按域请求模块、契约类型 | 稳定层 |
| `shared/` | UI 基座、通用组件、工具、常量、通用类型、i18n | 稳定层 |

```
┌──────────────────────────────────────────────────────────────────────────┐
│  app/          入口、路由、全局 Pinia、布局壳、指令、应用级配置               │
├──────────────────────────────────────────────────────────────────────────┤
│  pages/        路由级编排（薄壳），组合 features 公开 API + 必要 api/shared   │
├──────────────────────────────────────────────────────────────────────────┤
│  features/     按业务域内聚；对外仅 export 公开入口（如 index.ts）            │
├──────────────────────────────────────────────────────────────────────────┤
│  api/          请求模块、契约类型；经统一 HTTP 层访问后端                     │
├──────────────────────────────────────────────────────────────────────────┤
│  shared/       设计系统级 UI、通用工具、常量、类型、locales                   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.4 目标目录树（执行参考，可与 Phase 计划对照）

```
frontend/src/
├── app/                          # 应用装配层
│   ├── App.vue
│   ├── main.ts
│   ├── router/                   # ← 从 src/router/ 迁入
│   ├── stores/                   # ← 全局 store（auth, menu, setting）
│   ├── config/                   # ← 从 src/config/ 迁入
│   ├── directives/               # ← 从 src/directives/ 迁入
│   └── layouts/                  # ← 结构性壳组件（从 components/core/layouts/ 拆出）
│
├── pages/                        # 页面入口层（← 从 views/ 重命名）
│   ├── dashboard/
│   ├── tasks/
│   ├── projects/
│   ├── business-lines/
│   ├── skills/
│   ├── mcp/
│   ├── goals/
│   ├── settings/
│   ├── login/
│   └── ...
│
├── features/                     # 业务能力层（核心新增）
│   ├── layout/                   # 布局业务能力（sidebar, header 等）
│   ├── notifications/            # 通知能力（SSE worker 等）
│   ├── tasks/                    # 任务域
│   │   ├── create/
│   │   ├── detail/
│   │   │   ├── components/
│   │   │   ├── composables/
│   │   │   ├── model/
│   │   │   └── cli/              # CLI 渲染器（保持现有 provider 隔离）
│   │   └── index.ts
│   ├── business-lines/           # 业务线域
│   ├── skills/                   # 技能域
│   ├── mcp/                      # MCP 域
│   ├── goals/                    # 目标域
│   ├── workflow/                 # 工作流域
│   ├── access/                   # 权限域
│   ├── settings/                 # 设置域
│   └── knowledge-base/           # 知识库域
│
├── api/                          # 后端访问层（保持现有结构 ✅）
│   ├── http.ts                   # ← 相当于基准方案的 base.ts
│   ├── tasks.ts
│   ├── projects.ts
│   └── ...
│
└── shared/                       # 稳定共享层
    ├── ui/                       # ← 从 components/ui/ 迁入（shadcn-vue）
    ├── components/               # ← 跨域通用组件（file-browser, select 等）
    ├── composables/              # ← 通用 hooks（useTable, useChart, useMessage 等）
    ├── utils/                    # ← 从 src/utils/ 迁入（通用工具）
    ├── types/                    # ← 从 src/types/ 迁入（通用类型）
    ├── constants/                # ← 从 src/constants/ + src/enums/ 合并迁入
    ├── assets/                   # ← 从 src/assets/ 迁入
    ├── locales/                  # ← 从 src/locales/ 迁入
    └── lib/                      # ← 从 src/lib/ 迁入
```

### 5.5 易变 / 稳定 / 装配与依赖方向

依赖自上而下：**视图与编排在上，稳定基座在下**；五分区框图见 **§5.3**；与第八章「依赖流向规范」一致。

**要点：**

- **易变层**：`pages/`、`features/` —— 业务迭代主要发生处；页面只做编排，复杂逻辑下沉到 `features/`。
- **稳定层**：`api/`、`shared/` —— 换 UI 细节或换 HTTP 客户端时，分别主要影响 `shared/` 与 `api/`。
- **装配层**：`app/` —— 把路由、全局状态、壳布局、指令等与「具体业务画面」解耦，变更频率低于单页业务。

**允许的依赖方向（与第八章一致）：** `app` → `pages` / `features(公开 API)` / `api` / `shared`；`pages` → `features` / `api` / `shared`；`features` → `api` / `shared` 及其他 `features` 的公开入口；`api` → `shared`；`shared` 仅依赖自身与外部 npm 包。

### 5.6 核心数据流（概要）

描述一次典型交互从界面到后端再回来的路径，便于与评审、排障和 AI 定位对齐。

```text
用户操作（pages 视图 / features 业务组件）
        ↓
features 内 composable 或组件方法（业务规则、组装参数）
        ↓
api 模块（统一 http 实例、Token / 错误码 / 401 等拦截）→ 后端 API
        ↓
响应数据（类型在 types/api 等与契约对齐）返回
        ↓
可选：写入 app/stores（全局）或 features/*/stores（域内）或组件本地状态
        ↓
视图更新（响应式 / Pinia 订阅）
```

**补充说明：**

- **鉴权与路由**：未登录或无权访问时，由 `app/router` 守卫处理跳转或拦截，不将「是否可进系统」散落在各 page 内重复判断。
- **SSE / Worker 等横切能力**：按域归入对应 **feature**（例如通知与 `workers` 同域共置），通过显式接口与页面连接，避免隐式全局单例。
- **跨 feature 协作**：只通过目标 feature 的 **公开入口**（如 `index.ts`）引用，避免 deep import 形成环依赖（与 Phase 4 架构守护一致）。

### 5.7 构建入口、技术栈与横切（摘要）

目标态下：

- **构建**：Vite（`frontend/vite.config.ts`）；开发代理 `/api`、`/ws`。
- **入口**：`app/main.ts`（或等价根入口）注册 Pinia、路由、指令；路由与守卫在 `app/router/`。
- **技术栈**：Vue 3、TypeScript、Vue Router、Pinia、Tailwind CSS 4、`fetch` 封装 + `api/http.ts` 前缀 `/api/v1`、Vitest、Playwright（详见 `frontend/package.json`）。
- **横切**：权限与路由守卫、`v-auth` 等归装配层；`locales` 归 `shared`；SSE / Worker 按域归 **feature**。

---

## 六、分阶段执行计划

### Phase 0：基础准备

**目标：建立迁移基础设施，不移动任何文件。**

| 序号 | 任务 | 详细说明 | 影响范围 |
|------|------|---------|---------|
| 0.1 | 配置路径别名 | 在 `vite.config.ts` 和 `tsconfig.json` 中增加新别名：`@app/`、`@pages/`、`@features/`、`@api/`（保留已有 `@/`）、`@shared/` | 构建配置 |
| 0.2 | 完善 Cursor 规则 | 以 `.cursor/rules/frontend-architecture-*.mdc` 与 Skill 为准，补充依赖流向、feature 公开入口等（若仍有独立 `vue-architecture-skill.mdc` 草案则合并或废弃） | AI 辅助开发 |
| 0.3 | 更新 AGENTS.md | 声明迁移状态、source of truth 规则、已废弃目录清单 | 团队协作 |
| 0.4 | 创建新目录骨架 | 创建 `app/`、`pages/`、`features/`、`shared/` 四个空顶层目录 | 无代码影响 |
| 0.5 | 团队对齐 | 确认迁移计划、分工、review 规则 | 团队流程 |

**验收标准：**
- [ ] 新别名配置完成，`import {} from '@features/...'` 可正常解析
- [ ] Cursor 规则文件生效
- [ ] 新代码开始使用新别名

---

### Phase 1：全局基础层搭建

**目标：把与业务无关的基础层迁移到新位置。**

| 序号 | 迁移项 | 从 | 到 | 文件数 | 风险等级 |
|------|--------|-----|-----|--------|---------|
| 1.1 | UI 基础组件 | `components/ui/` | `shared/ui/` | ~80 | 🟡 低（纯路径变更） |
| 1.2 | 静态资源 | `assets/` | `shared/assets/` | 少量 | 🟢 极低 |
| 1.3 | 国际化 | `locales/` | `shared/locales/` | 少量 | 🟢 极低 |
| 1.4 | 工具库 | `lib/` | `shared/lib/` | 1 | 🟢 极低 |
| 1.5 | 通用组件 | `components/core/file-browser/`、`components/core/select/` | `shared/components/` | ~15 | 🟡 低 |
| 1.6 | 应用配置 | `config/` | `app/config/` | 2 | 🟢 极低 |
| 1.7 | 路由配置 | `router/` | `app/router/` | ~8 | 🟡 低 |
| 1.8 | 自定义指令 | `directives/` | `app/directives/` | 2 | 🟢 极低 |
| 1.9 | 清理空目录 | 删除 `components/core/base/demo/` 等非必要文件 | — | — | 🟢 极低 |

**每项迁移要求：**
- 文件移动 + import 修正在同一个 PR 内完成
- PR 通过 type-check + lint + 单测
- 同步更新 `tsconfig.json` paths（如需要）

**验收标准：**
- [ ] `shared/ui/` 替代原 `components/ui/`，全部引用已更新
- [ ] `app/router/`、`app/config/` 正常工作
- [ ] 旧路径不再有新文件提交

---

### Phase 2：技术碎片收口

**目标：消除顶层技术碎片目录，统一到新结构。**

| 序号 | 迁移项 | 从 | 到 | 说明 |
|------|--------|-----|-----|------|
| 2.1 | Composables 通用部分 | `hooks/core/useTable.ts`、`useChart.ts`、`useMessage.ts` | `shared/composables/` | 通用能力迁入共享层 |
| 2.2 | Composables 业务部分 | `hooks/core/useAuth.ts`、`useLayout.ts` | `features/layout/composables/`、`app/composables/` | 按归属拆分 |
| 2.3 | Composables 目标域 | `hooks/goals/*` | `features/goals/composables/` | 目标域收口 |
| 2.4 | InjectionKey | `keys/layout-workspace.ts` | `features/layout/model/workspace.context.ts` | 按辅助方案命名约定 |
| 2.5 | Worker | `workers/notification-sse.worker.ts` | `features/notifications/notification-sse.worker.ts` | 与 feature 共置 |
| 2.6 | 枚举合并 | `enums/*` | `shared/constants/` | 枚举是值，并入常量 |
| 2.7 | 常量 | `constants/*` | 通用 → `shared/constants/`；业务 → `features/*/constants/` | 按归属拆分 |
| 2.8 | 类型 | `types/api/*` 保留原位；`types/common/*`、`types/component/*` → `shared/types/` | 按归属拆分 | |
| 2.9 | 工具函数 | 通用部分 → `shared/utils/`；业务部分(goal-*) → `features/goals/utils/` | 按归属拆分 | |
| 2.10 | HTTP 基础设施 | `utils/http/` | `api/shared/` | 访问基础设施归 api 层 |
| 2.11 | views → pages | `views/` | `pages/` | 重命名 + 路由配置更新 |
| 2.12 | 全局 Store 迁移 | `stores/` | `app/stores/` | 全局 store 归 app 层 |

**重点关注：**
- **`useLayout.ts`（922行）** 需先拆分再迁移，拆分为：
  - `features/layout/composables/useSidebar.ts`
  - `features/layout/composables/useWorkspace.ts`
  - `features/layout/composables/useBreadcrumb.ts`（如有）
- **`views/` → `pages/`** 需同步修改所有路由配置中的 `import()` 路径

**验收标准：**
- [ ] 顶层 `hooks/`、`keys/`、`workers/`、`enums/` 目录已清空并删除
- [ ] `views/` 已重命名为 `pages/`
- [ ] 所有迁移切片通过 type-check + lint + 测试

---

### Phase 3：业务域收口（可按域分批进行）

**目标：按业务域将散落在 `components/` 中的业务组件收口到 `features/`。**

推荐按以下顺序执行，每个域为独立 PR：

#### 3.1 layout + notifications（第一批，风险最低）

| 迁移项 | 从 | 到 |
|--------|-----|-----|
| 布局壳组件 | `components/core/layouts/Layout.vue`、`BusinessLineLayout.vue`、`WorkspacePageLayout.vue` | `app/layouts/` |
| 布局业务组件 | `components/core/layouts/Sidebar.vue`(304行)、`Header.vue`、`SidebarRouteSync.vue` | `features/layout/components/` |
| 反馈组件 | `components/core/feedback/AppMessageHost.vue` | `shared/components/feedback/` |

#### 3.2 tasks（第二批，最关键）

| 迁移项 | 从 | 到 |
|--------|-----|-----|
| 任务创建 | `components/tasks/TaskCreatePanel.vue`(972行)、`TaskCreateModal.vue` | `features/tasks/create/` |
| 任务详情 | `components/tasks/detail/*` | `features/tasks/detail/` |
| CLI 渲染器 | `components/tasks/detail/cli/*` | `features/tasks/detail/cli/`（保持 provider 隔离不变） |
| 任务页面 | `pages/tasks/detail.vue`(1263行) | 页面瘦身 → 编排层，逻辑提取到 `features/tasks/detail/composables/` |

**重要约束：**
- CLI 渲染器的 renderer ownership 规则不变（参照 `docs/dev-spec/frontend/frontend-cli-renderer-boundaries.md`）
- 同一 PR 中必须同步更新 dev-spec 中的路径引用

#### 3.3 business-lines（第三批，解决最大痛点）

| 迁移项 | 从 | 到 |
|--------|-----|-----|
| 管理面板 | `components/business/settings/BusinessLineManagementPanel.vue`(4437行) | **必须先拆分**，再迁入 `features/business-lines/` |
| 业务线表单 | `components/business/settings/modals/BusinessLineFormModal.vue`、`views/business-lines/components/BusinessLineFormModal.vue` | `features/business-lines/components/` |
| 业务线弹窗 | `components/business/settings/BusinessLineModal.vue` | `features/business-lines/components/` |
| 项目表单 | `components/business/settings/modals/ProjectFormModal.vue` | `features/business-lines/components/` 或 `features/projects/components/` |
| 确认弹窗 | `components/business/settings/modals/ConfirmActionModal.vue` | `shared/components/` |
| 成员权限 | `components/business/settings/modals/MemberPermissionModal.vue`(459行) | `features/access/components/` |
| Agent工具配置 | `components/business/settings/modals/AgentToolConfigModal.vue`(1636行) | **需先拆分**，再迁入对应 feature |

#### 3.4 skills + mcp（第四批）

| 迁移项 | 从 | 到 |
|--------|-----|-----|
| 技能上传 | `components/business/settings/modals/SkillUploadModal.vue` | `features/skills/components/` |
| 技能树 | `components/skills/SkillTree.vue`、`SkillTreeItem.vue` | `features/skills/components/` |
| MCP 导入 | `components/business/settings/modals/McpJsonImportModal.vue` | `features/mcp/components/` |
| 技能页面瘦身 | `pages/skills/index.vue`(1091行) | 逻辑提取到 `features/skills/composables/` |
| MCP 页面瘦身 | `pages/mcp/index.vue`(1098行) | 逻辑提取到 `features/mcp/composables/` |

#### 3.5 goals + workflow + access + settings + knowledge-base（第五批）

| 迁移项 | 从 | 到 |
|--------|-----|-----|
| 目标组件 | `components/goals/*` | `features/goals/components/` |
| 工作流组件 | `components/workflow/*` | `features/workflow/components/` |
| 权限组件 | `components/access/*` | `features/access/components/` |
| 设置组件 | `components/settings/*` | `features/settings/components/` |
| 知识库组件 | `components/knowledge-base/*` | `features/knowledge-base/components/` |

**每个域完成后的必做动作：**
- 为 feature 创建 `index.ts` 公开入口（仅对外暴露的能力）
- 更新 `AGENTS.md` 和 `docs/dev-spec/`
- 对已迁移切片禁止新文件落入旧路径

**验收标准：**
- [ ] `components/business/` 目录已清空并删除
- [ ] `components/` 只剩下 `ui/` 的引用壳（或已完全迁移）
- [ ] 每个 feature 有清晰的内部结构和公开入口

---

### Phase 4：巨型文件拆分 + 严格守护

**目标：处理明确过大的文件，启用自动化守护。**

#### 4.1 必须拆分的巨型文件

| 文件 | 当前行数 | 拆分方案 |
|------|---------|---------|
| `BusinessLineManagementPanel.vue` | 4437 | 拆为 5-8 个子面板组件 + 1 个编排容器 |
| `projects/detail.vue` | 2806 | 页面瘦身，逻辑下沉到 `features/projects/` |
| `AgentToolConfigModal.vue` | 1636 | 拆为配置表单子组件 + 弹窗容器 |
| `tasks/detail.vue` | 1263 | 页面层只做编排，逻辑移入 `features/tasks/detail/composables/` |
| `PersonalSettingsPanel.vue` | 1219 | 按设置分区拆成子面板 |
| `mcp/index.vue` | 1098 | 逻辑提取到 `features/mcp/composables/` |
| `skills/index.vue` | 1091 | 逻辑提取到 `features/skills/composables/` |
| `TaskGitPanel.vue` | 1090 | 拆为子组件 |
| `TaskCreatePanel.vue` | 972 | 拆为表单分区组件 |
| `useLayout.ts` | 922 | 按职责拆成多个 composable |
| `knowledge-base/index.vue` | 932 | 逻辑提取到 `features/knowledge-base/composables/` |
| `AppSelect.vue` | 714 | 评估是否需要拆分或保持 |

#### 4.2 架构守护配置

| 守护项 | 工具/方式 | 规则 |
|--------|---------|------|
| 依赖方向检查 | `eslint-plugin-boundaries` 或 restricted-imports | shared 不依赖 features/pages/app；api 不依赖 features/pages/app |
| 循环依赖检查 | `dependency-cruiser` 或 `madge` | CI 中检查 features 间无双向依赖 |
| 旧路径禁用 | ESLint restricted-paths | 禁止新文件 import 已迁移切片的旧路径 |
| 文件大小预警 | ESLint `max-lines` | Vue SFC：默认 **>600 行 error**；400 行软上限靠评审；过渡期 **豁免清单**（`frontend/eslint.config.ts` 内 `maxLinesExemptVueFiles`）仍为 warn@600 |
| deep import 禁止 | ESLint import 规则 | 跨 feature 仅公开入口：`boundaries/dependencies` + `feature` capture 的配置位已写在 `eslint.config.ts` 注释；存量 deep import 多，启用前需分批改导出 |

#### 4.3 Cursor 规则更新

更新 `.cursor/rules/frontend-architecture-*.mdc`（及既有架构类规则），将以下约束写入：
- 五分区目录约束（替代基准方案的九目录约束）
- Feature first 默认落点规则
- 公开入口导入规则
- 状态归属矩阵

**验收标准：**
- [ ] 无 > 600 行的 Vue SFC 文件
- [ ] CI 通过依赖方向检查
- [ ] CI 通过循环依赖检查
- [ ] 旧目录 `components/business/`、`hooks/`、`keys/`、`workers/`、`enums/`、`views/` 已完全删除

---

## 七、风险评估与应对

| 风险 | 等级 | 应对措施 |
|------|------|---------|
| 大量 import 路径修改导致合并冲突 | 🔴 高 | 每个迁移切片独立 PR，快速合并；使用 IDE 批量重构 |
| 迁移期间新功能开发受阻 | 🟠 中 | 兼容期内新旧路径共存；新功能按新结构落点，不进旧目录 |
| 巨型文件拆分引入回归 Bug | 🟠 中 | 拆分前补齐测试覆盖，拆分后跑全量测试 |
| 团队习惯变更阻力 | 🟡 低 | Cursor 规则 + ESLint 自动约束，减少人为判断 |
| CLI 渲染器迁移影响 dev-spec | 🟡 低 | 同一 PR 中同步更新 dev-spec 路径 |

---

## 八、基准方案中可直接采用的代码规范

以下规范来自基准方案，与架构迁移无关，可立即在现有项目中执行：

### 8.1 Vue SFC 结构规范（立即生效）

```
<script setup lang="ts"> → <template> → <style scoped>
```

### 8.2 命名规范（立即生效）

| 类型 | 规则 | 示例 |
|------|------|------|
| 页面文件 | 按路由建目录，目录名使用 dash-case；路由入口统一为 `index.vue` | `pages/login/index.vue`、`pages/user-control/index.vue` |
| 组件文件 | PascalCase | `BaseButton.vue`、`UserCard.vue` |
| Composables | useXXX | `useAuth`、`usePagination` |
| 变量/函数 | camelCase | `userInfo`、`getUserList` |
| 常量 | UPPER_SNAKE_CASE | `BASE_URL`、`DEFAULT_PAGE_SIZE` |

### 8.3 依赖流向规范（配合 lint 逐步生效）

```
app      -> pages, features(public API), api, shared
pages    -> features(public API), api, shared
features -> api, shared, other-features(public API only)
api      -> shared
shared   -> shared, npm packages
```

### 8.4 TypeScript 强约束（立即生效）

- 禁止 `any` 类型滥用
- props、emits、函数返回值必须定义类型
- 核心逻辑必须添加注释

---

## 九、关键决策记录

| 决策 | 结论 | 理由 |
|------|------|------|
| 顶层结构选择 | 采用五分区（app/pages/features/api/shared） | 3～5 层是 AI 友好的黄金分层区间（详见第四章），比九目录更低歧义，更适合 AI 定位 |
| `api/` 目录 | 保持现有结构不变 | 已按业务域拆分，结构清晰，无需改动 |
| `services/` vs `api/` | 不采用基准方案的 `services/` 命名 | 现有 `api/` 更直接，与辅助方案一致 |
| `views/` → `pages/` | 采用 | `pages` 更准确表达路由页面入口职责 |
| `hooks/` → `composables/` | 采用 | Vue 3 社区约定，减少语义歧义 |
| CLI 渲染器位置 | `features/tasks/detail/cli/<provider>` | 保持 renderer ownership，深层嵌套是批准的例外 |
| 迁移方式 | 兼容期优先，不做大爆炸式重构 | 降低风险，支持新旧并存 |
| Cursor 规则 | 创建但内容适配实际架构 | 吸收基准方案的 Skill 触发思路，内容对齐实际五分区 |

---

## 相关文档

| 文档 | 说明 |
|------|------|
| **可执行规范（唯一正文）** | `.agents/skills/frontend-architecture/`（`SKILL.md`、`references/spa-architecture.md`、`references/multi-frontend-alignment.md`） |
| **本文档** | 可行性分析、**第五章为目标架构与目录树**、第六至七章为阶段计划与风险 |
| **dev-spec 前端架构（本仓库）** | [`docs/dev-spec/frontend/README.md`](../dev-spec/frontend/README.md) 索引；[`ARCHITECTURE.md`](../dev-spec/frontend/ARCHITECTURE.md)（Web 目标摘要）、[`ARCHITECTURE_app.md`](../dev-spec/frontend/ARCHITECTURE_app.md)、[`ARCHITECTURE_shadow.md`](../dev-spec/frontend/ARCHITECTURE_shadow.md)（多端对照） |
| **当前实现快照** | [`frontend/ARCHITECTURE.md`](../frontend/ARCHITECTURE.md)（仅描述现状，非目标规范） |
| **编辑器规则** | `.cursor/rules/frontend-architecture-*.mdc` |
| **历史/背景稿** | `analysis/` 下 `frontend-architecture.md`、`frontend-ai-friendly-architecture.md` 等（若仍存在），**不替代** Skill 与本文第五、八章 |

---

## 十、后续跟踪

- [x] Phase 0（打破 user/access Pinia 环、`deps:circular:strict` 进 `quality-gate`）已与工具链/AGENTS/dev-spec 对齐
- [x] 每个 Phase 完成后同步更新 `AGENTS.md` 和 `docs/dev-spec/`（五分区 lint/boundaries、`deps:circular:strict`、`max-lines` 阶梯说明）
- [ ] 迁移结束后归档本文档，将最终架构写入正式的 dev-spec
