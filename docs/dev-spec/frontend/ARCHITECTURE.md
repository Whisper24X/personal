# ainative 仓库 `frontend` 项目架构

本仓库 Web 前端为 **Vue 3 + TypeScript + Vite** 的 SPA，与 **ainative-app**（Taro）、**ainative-shadow**（管理端）并列，**不要求**顶层目录与另两端同构。本文档采用与 [`ARCHITECTURE_app.md`](ARCHITECTURE_app.md)、[`ARCHITECTURE_shadow.md`](ARCHITECTURE_shadow.md) 相同的 **「整体分层」表述习惯**（页面层、组件层、状态层、数据层、共享与横切等），并映射到本仓库 **五分区**（`app` / `pages` / `features` / `api` / `shared`）。规范性条文以 **`.agents/skills/frontend-architecture/references/spa-architecture.md`** 为准。

---

## 整体分层

依赖自上而下：**装配 → 页面编排 → 业务组件与组合式逻辑 → 状态 → 请求与契约 → 通用能力与横切**。

```
┌──────────────────────────────────────────────────────────────┐
│  装配层 (app)          入口、路由、布局壳、指令、应用级配置      │
├──────────────────────────────────────────────────────────────┤
│  页面层 (pages)        路由页面、薄编排、组合各 feature 公开能力 │
├──────────────────────────────────────────────────────────────┤
│  组件层 (features)     业务域组件、composables、域内展示逻辑     │
├──────────────────────────────────────────────────────────────┤
│  状态层 (stores)       Pinia：全局（app）与域内（feature）状态     │
├──────────────────────────────────────────────────────────────┤
│  数据层 (api)          请求封装、领域 API 模块、契约类型          │
├──────────────────────────────────────────────────────────────┤
│  共享与横切 (shared)   通用 UI、工具、常量、通用类型、i18n 等     │
└──────────────────────────────────────────────────────────────┘
```

**与另两端文档用语的对照（概念映射，非目录同名）：**

| 本分层（Web SPA，五分区） | ainative-app（见 ARCHITECTURE_app） | ainative-shadow（见 ARCHITECTURE_shadow） |
|-------------------------|-------------------------------------|------------------------------------------|
| 装配层 (app) | `app.ts`、全局初始化、路由配置入口 | `main` / `router` / `plugins`、全局能力 |
| 页面层 (pages) | 页面层 (pages)，路由页面 | 视图层 (views) |
| 组件层 (features) | 组件层 (components) 中业务相关部分 | 组件层 (components) + 业务向逻辑 |
| 状态层 (stores) | 状态层 (store) | 逻辑层中的 Pinia / hooks 中的状态侧 |
| 数据层 (api) | 数据层 (api) | 数据层 (api / utils/http) |
| 共享与横切 (shared) | 横切 (utils) + 通用组件 | `utils`、通用组件、locales 等 |

---

## 构建与入口

- **构建**：Vite；配置见仓库 `frontend/vite.config.ts`（开发代理 `/api`、`/ws` 等）。
- **应用入口**：`src/app/main.ts`（注册 Pinia、路由、指令，挂载根组件）。
- **路由**：Vue Router；路由表与守卫在 **`app/router/`**。

---

## 核心数据流（概要）

用户操作 **页面层 (pages)** / **组件层 (features)** → 调用 **数据层 (api)**（经统一 HTTP，注入 Token、处理 401 等）→ 后端 → 响应与契约类型对齐 → 更新 **状态层 (stores)** 或组件本地状态 → 驱动界面。

路由与鉴权：**装配层 (app)** 中路由守卫集中处理登录与权限，不在各页面重复实现「是否可进系统」。

---

## 目录结构（`src/`，五分区）

顶层目录与上文分层一一对应。

```
frontend/src/
├── app/                 # 装配层：main、App、router、全局 stores、directives、应用级 config
├── pages/               # 页面层：路由入口，dash-case + index.vue
├── features/            # 组件层（业务）：按域内聚，对外 index.ts 公开 API
├── api/                 # 数据层：领域请求模块（配合 types/api 等）
├── shared/              # 共享与横切：通用 UI、utils、constants、locales、通用类型
├── assets/              # 静态资源（可收束至 shared 或保留顶层，以团队约定为准）
└── ...
```

可选的 **`frontend/ARCHITECTURE.md`**（若存在）可作补充说明，规范性条文仍以 skill `references/` 为准。

---

## 技术栈（摘要）

| 类别 | 技术 |
|------|------|
| 运行时 | Vue 3（`<script setup>`）、TypeScript、Vite |
| 路由与状态 | Vue Router、Pinia |
| 样式 | Tailwind CSS 4 等（见 `frontend/package.json`） |
| 请求 | `fetch` 封装（`utils/http`）、`api/http.ts` 统一前缀 `/api/v1` |
| 测试 | Vitest、Playwright |

---

## 横切能力

- **权限与路由**：`auth` / `permission` 守卫、`route.meta` 与访问控制常量配合；指令如 **`v-auth`**（目标在 `app/directives`）。
- **国际化**：`locales`（目标在 `shared/locales` 或等价路径）。
- **长连接与 Worker**：按业务域归入对应 **feature**，经显式接口供页面使用。

---

## 该架构对 AI 编码的友好程度分析

**总体：中高。** **页面 / feature / api / shared** 边界清晰时，与 shadow 类似，单域改动路径可预测。

| 维度 | 说明 |
|------|------|
| **有利** | 路由表可枚举；`api` 与 `utils/http` 集中；`types/api` 与请求模块搭配；五分区 + 依赖矩阵可约束「改哪里」。 |
| **需注意** | `features` 需严格遵守 **公开入口**，避免 deep import；任务 **CLI 多 agent** 目录需限定修改范围。 |
| **建议用法** | 规范性条文以 **skill `references/spa-architecture.md`** 为准；改接口先锁 `api/` 与 `types/api`，改 UI 先锁对应 `features/<域>`。项目背景与历史分阶段记录见 **`docs/technical/frontend-architecture-feasibility-analysis.md`**。 |

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [frontend-architecture-feasibility-analysis.md](../../technical/frontend-architecture-feasibility-analysis.md) | 项目背景：可行性、分阶段执行与风险、细节目录树（**非**规范条文替代物） |
| [.agents/skills/frontend-architecture/references/spa-architecture.md](../../../.agents/skills/frontend-architecture/references/spa-architecture.md) | 五分区规范正文 |
| [.agents/skills/frontend-architecture/references/multi-frontend-alignment.md](../../../.agents/skills/frontend-architecture/references/multi-frontend-alignment.md) | 与 app / shadow 的职责对齐语义 |
| [ARCHITECTURE_app.md](ARCHITECTURE_app.md) / [ARCHITECTURE_shadow.md](ARCHITECTURE_shadow.md) | 另两端的同风格架构说明 |
