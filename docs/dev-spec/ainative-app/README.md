# ainative-app 开发指南

本指南是 ainative-app 的入口索引，覆盖快速启动、目录概览与关键约定。更详细的实现规范请阅读 `references/` 目录中的文档。

## 项目特点
- 基于 uniapp + Vue3 + TypeScript + Vite5 + UnoCSS 的跨平台框架
- 支持 H5、小程序、APP 多平台开发
- 内置约定式路由、layout 布局、请求封装、登录拦截、自定义 tabbar 等能力
- 无需依赖 HBuilderX，支持命令行开发

## 快速开始
1. 安装依赖：`pnpm install`
2. 启动开发：
   - H5：`pnpm dev` 或 `pnpm dev:h5`
   - 微信小程序：`pnpm dev:mp`
   - 支付宝小程序（含钉钉）：`pnpm dev:mp-alipay`
   - APP：`pnpm dev:app`

## 常用命令
- 代码检查：`pnpm lint`
- 自动修复：`pnpm lint:fix`
- 类型检查：`pnpm type-check`
- 构建产物：
  - H5：`pnpm build:h5`
  - 微信小程序：`pnpm build:mp`
  - 支付宝小程序：`pnpm build:mp-alipay`
  - APP：`pnpm build:app`

## 核心配置文件
- [package.json](mdc:package.json) - 项目依赖和脚本配置
- [vite.config.ts](mdc:vite.config.ts) - Vite 构建配置
- [pages.config.ts](mdc:pages.config.ts) - 页面路由配置
- [manifest.config.ts](mdc:manifest.config.ts) - 应用清单配置
- [uno.config.ts](mdc:uno.config.ts) - UnoCSS 配置

## 主要目录结构
- `src/pages/` - 页面文件
- `src/components/` - 全局组件
- `src/layouts/` - 布局文件
- `src/api/` - API 接口定义
- `src/http/` - HTTP 请求封装
- `src/store/` - 状态管理
- `src/tabbar/` - 底部导航栏
- `src/App.ku.vue` - 全局根组件（类似 App.vue 的 template 入口）

## 关键约定速览
- 页面放在 `src/pages/`，使用约定式路由，页面配置通过 `definePage` 宏生成到 `pages.json`
- 组件分为全局组件（`src/components/`）与局部组件（`src/pages/**/components/`）
- 状态管理使用 Pinia，Store 放在 `src/store/`
- 请求与接口定义在 `src/http/` 与 `src/api/`
- 样式优先使用 UnoCSS，必要时配合 SCSS + scoped

## 规范与参考文档
以下文档位于 `docs/dev-spec/ainative-app/references/`，请按需阅读：
- [项目概览](references/project-overview.md)
- [开发流程](references/development-workflow.md)
- [uni-app 约定](references/uni-app-patterns.md)
- [Vue3 + TypeScript 规范](references/vue-typescript-patterns.md)
- [API 与 HTTP 规范](references/api-http-patterns.md)
- [样式与 CSS 规范](references/styling-css-patterns.md)
