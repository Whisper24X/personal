# 项目概览

ainative-pc 是 PC 端 Web 应用，基于 Vue 3 + Vite + TypeScript 构建，使用 Vue Router 与 Pinia 作为路由与状态管理。

## 技术栈
- Vue 3、Vue Router、Pinia
- Vite、TypeScript
- Vitest、Playwright

## 入口与结构
- 入口文件：`src/main.ts`
- 根组件：`src/App.vue`
- 路由：`src/router/index.ts`
- 状态：`src/stores/`
- 页面：`src/views/`

## 构建与产物
- 开发服务：`pnpm dev`，默认访问 `http://localhost:5173`
- 生产构建：`pnpm build`，产物输出到 `dist/`
