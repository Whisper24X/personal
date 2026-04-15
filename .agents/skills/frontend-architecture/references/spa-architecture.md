# `frontend/` SPA 架构规范（五分区）

适用范围：采用本布局的 Vue 3 + Vite 前端（如本仓库 `frontend/`）。**本文与同目录 `multi-frontend-alignment.md` 为规范正文**（依赖方向、公开入口、CLI 边界等）。

## 与仓库其它文档的关系

| 层级 | 说明 |
|------|------|
| **规范正文（本包）** | 本文 + `multi-frontend-alignment.md` — 五分区、依赖矩阵、数据流、日常约束与 CLI；评审与实现的**硬约束**以此为准。 |
| **各仓库可另有材料** | 团队可在 `docs/` 中维护 dev-spec、目录树图示或 ADR；**与本文冲突时以本文为准**。 |
| **工具配置** | 别名、eslint boundaries、`no-restricted-imports` 等以**各仓库** `vite.config` / `eslint.config` 为准，须落实本文的依赖方向与公开 API 规则。 |

不依赖 `analysis/` 等历史方案稿作为强制布局来源。

## 1. 五分区职责

| 分区 | 职责 |
|------|------|
| `app/` | 应用装配：入口、路由、全局 Pinia、布局壳、指令、应用级配置 |
| `pages/` | 页面入口：路由级薄壳，组合各 feature 的公开能力 |
| `features/` | 业务能力：按域内聚（组件、composables、域内状态等），对外经 `index.ts` 暴露公开 API |
| `api/` | 后端通信：HTTP 封装、按域拆分的请求模块、与后端契约类型（如 `types/api/`） |
| `shared/` | 稳定共享：UI 基座、跨域通用组件、工具、常量、通用类型、i18n |

**角色分层：** 易变层 — `pages/`、`features/`；稳定层 — `api/`、`shared/`；装配层 — `app/`。

**与多端文档的用语对照（概念映射，非强制目录同名）：** 装配层 → `app/`；页面层 → `pages/`；组件层 → `features/`；状态层（Pinia）→ `app/stores` 与各 `features/*/stores`；数据层 → `api/`（及契约类型如 `types/api/`）；共享与横切 → `shared/`。三端产品线对照见 `multi-frontend-alignment.md` §3。

## 2. 整体分层（框图）

```
┌──────────────────────────────────────────────────────────────────────────┐
│  app/          应用装配：入口、路由、全局 Pinia、布局壳、指令、应用级配置   │
├──────────────────────────────────────────────────────────────────────────┤
│  pages/        页面入口：路由级编排（薄壳），组合各 feature 的公开能力     │
├──────────────────────────────────────────────────────────────────────────┤
│  features/     业务能力：按业务域内聚（组件 / composables / 域内状态等）   │
├──────────────────────────────────────────────────────────────────────────┤
│  api/          后端通信：HTTP 封装、按域拆分的请求模块、与后端契约类型     │
├──────────────────────────────────────────────────────────────────────────┤
│  shared/       稳定共享：UI 基座、跨域通用组件、工具、常量、通用类型、i18n │
└──────────────────────────────────────────────────────────────────────────┘
```

## 3. 核心数据流

```
用户操作（pages 视图 / features 业务组件）
        ↓
features 内 composable 或组件方法（业务规则、组装参数）
        ↓
api 模块（统一 http、Token / 401 / 错误码等拦截）→ 后端 API
        ↓
响应数据（与契约类型对齐）返回
        ↓
可选：app/stores（全局）或 features/*/stores（域内）或组件本地状态
        ↓
视图更新（响应式 / Pinia）
```

- **鉴权与路由**：由 `app/router` 守卫集中处理，不在各 page 重复散落「是否可进系统」。
- **SSE / Worker**：按域归入对应 **feature**，经显式接口连接页面，避免隐式全局单例。
- **跨 feature**：只通过目标 feature 的**公开入口**（如 `index.ts`）引用，禁止 deep import 形成环依赖。

## 4. 依赖流向（必须遵守）

```
app      -> pages, features(public API), api, shared
pages    -> features(public API), api, shared
features -> api, shared, other-features(public API only)
api      -> shared
shared   -> shared, npm packages
```

`features(public API)`：仅该 feature 对外暴露的入口模块，非内部任意路径。

## 5. 硬约束

- `api` 不得依赖 `features` / `pages` / `app`（仅 `shared` 与 npm）。
- `shared` 不得依赖 `features` / `pages` / `app`。
- 跨 feature 只能 `import` 其它 feature 的**公开 API**，禁止依赖未导出内部文件。

## 6. 命名与 SFC（与架构一致的基线）

- SFC 顺序：`script setup` → `template` → `style scoped`（若需要）。
- 页面：路由目录 dash-case，入口文件 `index.vue`。
- 组件：PascalCase；composables：`useXxx`；常量：`UPPER_SNAKE_CASE`。
- TypeScript：避免滥用 `any`；props/emits/返回值应有类型。

## 7. 日常开发与增量约束

- **新代码**落在五分区及项目已配置的别名下（如 `@app/`、`@pages/`、`@features/`、`@api/`、`@shared/`）。
- **禁止**向项目已废弃或未约定的聚集区新增文件；具体禁止路径以**本仓库** `eslint`（如 `no-restricted-imports`）与团队约定为准。
- **巨型页面/组件**：新逻辑优先抽到对应 feature 的 composable 或子组件，`pages/` 保持薄编排层。
- **契约优先**：变更后端契约时，优先在 `api/` 与契约类型（如 `types/api/`）对齐后，再做大范围 UI 改动。

## 8. CLI 任务渲染器（边界）

CLI 相关代码的**物理路径以仓库为准**（例如可位于某 feature 下的 `.../cli/<provider>/`）。**无论路径如何**，须遵守：

- 每个 agent 的 CLI 渲染器**自有目录**（如 `codex/`、`claude-code/`、`gemini/` 等），**UI 组件放在该目录内**。
- **不要**把各 agent 的 UI 堆到公共 `cli/components` 再互相引用。
- **禁止**跨 agent 目录 `import` 对方 UI（例如 `gemini` 不得引用 `claude-code/` 下的 `.vue`）。
- `cli` 内共享代码仅限**非 UI**、语义稳定的工具：解析/分组工具、共享类型、纯函数；若两路 CLI 长得像，仍**先各写各的 UI**，契约稳定后再抽抽象。
- 各 agent 的展示差异（时间戳策略、卡片布局、工具项样式等）**必须**落在本 agent 目录内。

意图：渲染器归属清晰，改动局部、可审、互不拖累。

## 9. 与其它「目录脚手架」说明

若仓库中仍存在「九目录 / services 命名」等**历史或外部模板**文档，**不**作为本 `frontend/` 的强制布局；**以本 reference 的五分区与依赖矩阵为准**。
