# ainative-shadow 项目架构

管理后台前端，基于 **Vue 3 + TypeScript + Vite**，UI 为 **Element Plus**，样式配合 **Tailwind CSS** 与 **SCSS**。本文档描述分层职责、请求路径与目录布局；细节规范见仓库内开发说明。

---

## 整体分层

依赖自上而下：视图与业务交互 → 可复用组件与 Hooks → 状态与 API → HTTP 与工具。

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

---

## 请求与数据流（概要）

用户操作页面 → Hook（如 `useTable`）调用 API → `utils/http` 经 Axios 发往后端 → 响应拦截（Token、错误、401 等）→ Hook / Store 更新 → 视图刷新。

---

## 目录结构（`src/`）

```
src/
├── api/           # 接口定义
├── assets/        # 静态资源、全局样式、图标
├── components/    # 组件（含 core：base、forms、tables、layouts 等）
├── config/        # 应用与模块配置
├── directives/    # 自定义指令（如权限）
├── enums/         # 枚举
├── hooks/         # 组合式逻辑（core：useTable、useAuth 等）
├── locales/       # 国际化
├── mock/          # 本地 Mock（如有）
├── plugins/       # 插件注册
├── router/        # 路由、守卫、动态路由
├── store/         # Pinia 模块（user、menu、setting 等）
├── types/         # TypeScript 类型
├── utils/         # 工具（http、storage、table、router 等）
├── views/         # 页面视图
├── App.vue
└── main.ts
```

根目录另有 `public/`、`vite.config.ts`、`tsconfig.json` 等。

---

## 技术栈（摘要）

| 类别 | 技术 |
|------|------|
| 运行时 | Vue 3、TypeScript、Vite |
| UI | Element Plus、Tailwind CSS、SCSS |
| 状态与路由 | Pinia（含持久化）、Vue Router |
| 请求 | Axios |
| 其他 | VueUse、ECharts、ESLint / Prettier / Stylelint |

---

## 横切能力

- **权限**：路由守卫（登录与菜单权限）、指令（如按钮级 `v-auth`）、动态路由注册。
- **性能**：路由懒加载、`KeepAlive`、表格等场景下的缓存策略（见各业务 Hook 配置）。

---

## 该架构对 AI 编码的友好程度分析

**总体：较高。** 分层与目录约定清晰，TypeScript + Vue 3 组合式 API 便于在「单文件 / 单层」内完成任务；仓库另有 `docs/dev-spec` 与 `.cursor/skills/shadow-dev`，可显著降低模型跑偏概率。

| 维度 | 说明 |
|------|------|
| **有利** | 职责边界明确（`views` / `hooks` / `api` / `store`），改列表页可优先对齐 `useTable` 等既有模式；Element Plus、Axios、Pinia 生态文档成熟，补全组件与请求代码时上下文成本低。 |
| **需注意** | 权限（路由守卫、动态路由、`v-auth`）、国际化 key、样式上 Tailwind 与 SCSS 混用，容易在「未读现有页面」时写出不一致交互或漏配权限；复杂表格/图表需对照同类页面而非从零臆造。 |
| **建议用法** | 让 AI **先引用同模块现有页面或 `hooks/core` 示例**，再改 API 类型与文案；涉及菜单/路由时显式说明是否需同步 `router` 与权限配置。 |

---

## 相关文档

- [本仓库 Web 前端：项目背景与可行性长文](../../technical/frontend-architecture-feasibility-analysis.md)（非规范唯一来源；条文见 skill `references/`）
- **ainative-shadow** 仓库内开发指南、架构详细版、集成说明：见对应仓库 `docs/`（若本 monorepo 未收录则以外部仓库为准）
