# ainative-pc 开发指南

本指南是 ainative-pc 的入口索引，覆盖快速启动、目录概览与关键约定。更详细的实现规范请阅读 `references/` 目录中的文档。

## 项目特点
- Vue 3 + Vite + TypeScript 的 PC 端 Web 应用
- 使用 Vue Router + Pinia 作为路由与状态管理
- 单元测试使用 Vitest，端到端测试使用 Playwright
- 路径别名 `@` 指向 `src/`

## 快速开始
1. 进入项目：`cd ainative-pc`
2. 安装依赖：`pnpm install`
3. 启动开发：`pnpm dev`
4. 本地访问：`http://localhost:5173`

## 常用命令
- 本地开发：`pnpm dev`
- 生产构建：`pnpm build`
- 预览构建：`pnpm preview`
- 类型检查：`pnpm type-check`
- 代码检查：`pnpm lint`
- 代码格式化：`pnpm format`
- 单元测试：`pnpm test:unit`
- 端到端测试：`pnpm test:e2e`（首次需 `pnpm exec playwright install`）

## 核心配置文件
- `ainative-pc/package.json` - 依赖与脚本
- `ainative-pc/vite.config.ts` - Vite 构建与别名
- `ainative-pc/tsconfig*.json` - TypeScript 配置
- `ainative-pc/vitest.config.ts` - Vitest 配置
- `ainative-pc/playwright.config.ts` - Playwright 配置
- `ainative-pc/eslint.config.ts` - ESLint 规则
- `ainative-pc/prettierrc.json` - Prettier 规则

## 主要目录结构
- `ainative-pc/src/` - 应用源码
- `ainative-pc/src/views/` - 页面视图
- `ainative-pc/src/components/` - 复用组件
- `ainative-pc/src/router/` - 路由配置
- `ainative-pc/src/stores/` - Pinia 状态
- `ainative-pc/src/assets/` - 静态资源与样式
- `ainative-pc/public/` - 静态资源目录
- `ainative-pc/e2e/` - Playwright 端到端测试

## 关键约定速览
- 入口文件为 `src/main.ts`，根组件为 `src/App.vue`
- 路由集中在 `src/router/`，页面组件放在 `src/views/`
- 状态管理统一使用 Pinia，Store 放在 `src/stores/`
- 组件按可复用粒度放在 `src/components/`
- 使用 `@` 路径别名访问 `src/` 下资源

## 规范与参考文档
以下文档位于 `docs/dev-spec/ainative-pc/references/`，请按需阅读：
- [项目概览](references/project-overview.md)
- [开发流程](references/development-workflow.md)
- [目录结构](references/directory-structure.md)
- [路由与状态规范](references/routing-state.md)
- [API 与数据访问规范](references/api-patterns.md)
- [样式与资源规范](references/styling-assets.md)
- [测试规范](references/testing.md)
