# ainative-app 项目架构

跨端移动应用，基于 **Taro + Vue 3**，一套代码构建**微信小程序、H5、支付宝小程序**等。本文档概括分层、构建入口与目录布局；接口与组件细则见仓库开发说明。

---

## 整体分层

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

---

## 构建与入口

- **构建**：Webpack 5，配置在 `config/`（`index.ts`、`dev.ts`、`prod.ts`）。
- **应用入口**：`src/app.ts`（初始化、全局指令如埋点等）。
- **路由**：`src/app.config.ts` 与 `src/pages.json`（及分包等 Taro 约定）。

---

## 核心数据流（概要）

页面 / 组件调用 `api` → 统一请求层注入 Token、处理 401 与白名单 → 后端 API → 错误与业务回调 → 可选更新 Pinia → 驱动界面。

路由侧：`utils/routerGuard` 配置需登录页，在 `app.ts` 中初始化。

---

## 目录结构（摘要）

```
ainative-app/
├── config/                 # Taro / Webpack 构建配置
├── src/
│   ├── api/                # 请求封装与各业务 API
│   ├── components/         # 通用组件（NavBar、TabBar、Loading 等）
│   ├── config/             # 环境等配置
│   ├── pages/              # 页面（按业务分子目录）
│   ├── store/              # Pinia（user、config、tabBar 等）
│   ├── styles/             # 变量、通用样式、mixins、端差异
│   ├── types/              # 类型定义
│   ├── utils/              # 埋点、路由守卫、上传、格式化等
│   ├── app.ts
│   ├── app.config.ts
│   └── app.less
├── types/                  # 全局类型声明
└── package.json
```

---

## 技术栈（摘要）

| 技术 | 说明 |
|------|------|
| Taro 3.x | 跨端运行时与编译 |
| Vue 3 | 组合式 API |
| TypeScript | 类型约束 |
| Pinia | 状态管理（含持久化插件，适配端存储） |
| Less | 样式与设计变量 |
| Webpack 5 | 打包 |

---

## 多端与样式

- 设计稿基准宽度 **750**，小程序侧 **rpx**，H5 侧 rem 等由 Taro 转换链处理。
- 样式变量与 mixins 集中在 `src/styles/`，需保持多端可维护性。

---

## 该架构对 AI 编码的友好程度分析

**总体：中高，强依赖任务是否「跨端一致」。** Vue 3 + Pinia + 分层目录与主流 H5 项目类似，单端（尤其 H5 或仅微信小程序）页面与接口封装对 AI 较友好；一旦涉及多端差异或 Taro 专有 API，模型容易混用 Web 习惯或错误端能力。

| 维度 | 说明 |
|------|------|
| **有利** | `api` / `pages` / `store` / `components` 边界清楚；组合式写法与 TypeScript 便于局部生成；仓库有 `docs/dev-spec/ainative-app` 与 `.cursor/skills/app-dev` 可作约束。 |
| **需注意** | **多端差异**：样式单位（rpx / rem）、条件编译、`Taro.xxx` 与浏览器 API 不可混用；**路由**需同时考虑 `app.config`、`pages.json` 与分包；构建链为 Webpack + Taro，与纯 Vite 项目习惯不同。 |
| **建议用法** | 明确目标端（微信 / H5 / 支付宝）；要求 AI **参照同端现有页面与 `api/request` 封装**；样式改动优先走 `styles/` 变量与 mixins，避免在组件内散落硬编码的平台分支。 |

---

## 相关文档

- [本仓库 Web 前端：项目背景与可行性长文](../../technical/frontend-architecture-feasibility-analysis.md)（非规范唯一来源；条文见 skill `references/`）
- 移动端开发指南、详细规范索引：见各 **ainative-app** 仓库内 `docs/dev-spec/ainative-app/`（若本 monorepo 未收录则以外部仓库为准）
