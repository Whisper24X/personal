# ainative-shadow 项目概览

## 技术栈
- Vue 3 + Vite 7 + TypeScript
- Vue Router 4、Pinia、Element Plus
- Tailwind CSS 4 + SCSS
- axios + vue-i18n + mitt

## 项目定位
- 管理后台 UI 与权限框架
- 支持前端/后端权限模式
- 内置主题切换、菜单布局、工作台标签页、多语言与锁屏能力

## 关键入口
- `ainative-shadow/src/main.ts` - 应用启动入口
- `ainative-shadow/src/App.vue` - 根组件
- `ainative-shadow/src/views/index/index.vue` - 布局容器

## 核心配置文件
- `ainative-shadow/package.json` - 依赖与脚本
- `ainative-shadow/vite.config.ts` - 构建、代理、插件
- `ainative-shadow/tsconfig.json` - TS 配置与路径别名
- `ainative-shadow/.env` / `.env.development` / `.env.production` - 环境变量
- `ainative-shadow/src/config/index.ts` - 系统级配置
- `ainative-shadow/src/config/setting.ts` - 默认设置

## 目录结构
- `ainative-shadow/src/api/` - API 接口定义
- `ainative-shadow/src/assets/` - 静态资源与样式
- `ainative-shadow/src/components/` - 组件库（core/business）
- `ainative-shadow/src/config/` - 系统配置
- `ainative-shadow/src/directives/` - 指令
- `ainative-shadow/src/enums/` - 枚举定义
- `ainative-shadow/src/hooks/` - 组合式函数
- `ainative-shadow/src/locales/` - 多语言
- `ainative-shadow/src/router/` - 路由与权限
- `ainative-shadow/src/store/` - Pinia 状态管理
- `ainative-shadow/src/types/` - 类型定义
- `ainative-shadow/src/utils/` - 工具函数
- `ainative-shadow/src/views/` - 页面视图

## 路径别名
- `@/` → `ainative-shadow/src/`
- `@views/` → `ainative-shadow/src/views/`
- `@imgs/` → `ainative-shadow/src/assets/images/`
- `@icons/` → `ainative-shadow/src/assets/icons/`
- `@utils/` → `ainative-shadow/src/utils/`
- `@stores/` → `ainative-shadow/src/store/`
- `@plugins/` → `ainative-shadow/src/plugins/`
- `@styles/` → `ainative-shadow/src/assets/styles/`
