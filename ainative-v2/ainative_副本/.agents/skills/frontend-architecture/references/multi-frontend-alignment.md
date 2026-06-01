# 多前端对齐规范（协作语义）

与 [`spa-architecture.md`](spa-architecture.md) 配套：说明本仓库 `frontend/`（Web SPA）与 **ainative-app**（Taro）、**ainative-shadow**（Vue 管理端）在职责上的**可对齐点**。**全文自洽**。更完整的分层框图与用语表可在各仓库的 `docs/dev-spec/frontend/` 中查阅（**非**规范条文来源，冲突时以 `spa-architecture.md` 为准）。不依赖 `analysis/` 或其它方案归档文档作为强制依据。

## 1. 范围

| 前端 | 说明 |
|------|------|
| 本仓库 `frontend/` | Vite SPA，五分区与依赖以 `spa-architecture.md` 为准 |
| **ainative-app** | Taro + Vue 3 多端；详见 `docs/dev-spec/frontend/ARCHITECTURE_app.md` |
| **ainative-shadow** | Vue 3 + Vite 管理端；详见 `docs/dev-spec/frontend/ARCHITECTURE_shadow.md` |

三者是**不同代码库/产品线**，**不要求**顶层目录同名或层数一致。

## 2. 结论性原则

- **不必**三端文件夹树同构。
- **建议对齐**的是**职责与数据流角色**（便于评审、联调、口头对齐）：
  - 统一 **API 出口**（先经封装请求层，再写业务逻辑）。
  - 鉴权与错误处理在**请求链路**中集中（Token、401、拦截器）。
  - **Pinia（或等价）驱动视图**，避免散落直连 DOM。
  - **路由与登录**：守卫集中；不把「能否进系统」复制到每个页面（Web：Vue Router 守卫；小程序端：如 `routerGuard` + 应用入口初始化）。

## 3. 分层角色对照（概念映射）

| Web SPA（五分区） | shadow 常见对应 | app 常见对应 |
|-------------------|-----------------|--------------|
| `app/` | `router` + `main` + `plugins` + 全局 store | `app.ts` + 全局初始化 + 守卫 |
| `pages/` | `views/` | `src/pages/` |
| `features/` | 业务 `components` + 部分业务 `hooks` | 页面内组件 + 业务子包 |
| `api/` | `api/` | `api/` |
| `shared/` | core 组件 + `utils` + `types` + `locales` | `components` + `utils` + `styles` 等 |

**同构性：** 均为「**界面与编排偏上、契约与请求偏下**」。

**仅约束本仓库 Web：** `app/` / `features/` / `shared/` 的**目录级**拆分；**不**要求 shadow/app 改成五分区。

## 4. 数据流（角色级共同叙事）

编排/视图 → 业务逻辑载体（本仓库为 features 内逻辑；shadow 常为 Hook；app 为页面/组件内）→ **统一请求层** → 后端 → 状态 → 视图。

**允许差异：** HTTP 放在 `api` 模块还是 `utils/http`、Taro.request 还是 Axios —— 对齐**职责**，不要求文件名一致。

## 5. 不必对齐清单

- 顶层目录名、构建入口、路由模型（Vue Router vs Taro 页面配置/分包）。
- UI 组件栈。
- **features 公开入口、五分区** —— **仅**强制于本仓库 `frontend/` 的 Web SPA 架构。
