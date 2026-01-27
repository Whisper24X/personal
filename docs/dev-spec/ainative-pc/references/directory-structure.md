# 目录结构

本目录说明当前 ainative-pc 的主要结构与用途，新增模块请尽量遵循此结构。

## 根目录
- `src/` - 应用源码
- `public/` - 静态资源（原样拷贝）
- `e2e/` - Playwright 端到端测试
- `index.html` - Vite 模板入口
- `env.d.ts` - 全局类型声明

## src/ 目录
- `src/main.ts` - 应用入口
- `src/App.vue` - 根组件
- `src/router/` - 路由配置
- `src/stores/` - Pinia 状态管理
- `src/views/` - 页面级组件
- `src/components/` - 复用组件
- `src/assets/` - 样式与本地资源
