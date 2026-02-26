## Why

当前左侧栏第二列菜单混合了项目域功能与工作区管理功能，信息架构不清晰，导致用户在“项目操作”和“系统设置”之间频繁切换语境。与此同时，`home` 菜单长期占位但业务价值低，且现有 `settings` 独立页面与管理类功能分散，增加了导航成本与维护复杂度。

## What Changes

- 重构左侧栏信息架构：第一列继续用于项目选择，第二列仅保留项目域导航菜单，不再承载工作区设置类入口。
- 将 `about`、`business-lines`、`projects`、`users` 从第二列菜单迁移到统一的 Settings 中，并按功能分组展示。
- 将当前 `/settings` 页面改造为全局 Settings 弹窗（Modal），由左侧栏底部“设置”入口打开。
- `home` 从主菜单中移除，并提供“可删除/可不显示”的导航策略（默认不展示，避免占用主导航位）。
- 为历史入口提供兼容跳转策略（旧路由访问时可重定向到 Settings 指定分组），降低迁移成本。
- **BREAKING**：导航结构和部分路由语义调整（`/home`、`/about`、`/business-lines`、`/projects`、`/users` 不再作为主侧栏常驻菜单项）。

## Capabilities

### New Capabilities
- `workspace-navigation-settings`: 统一定义“项目域导航 + Settings 弹窗中心”的导航行为、菜单归属规则、分组结构与兼容跳转要求。

### Modified Capabilities
- （无）

## Impact

- 前端布局与导航：
  - `frontend/src/hooks/core/useLayout.ts`
  - `frontend/src/components/core/layouts/Sidebar.vue`
  - `frontend/src/components/core/layouts/Layout.vue`
- 路由与权限：
  - `frontend/src/router/routes/system.ts`
  - `frontend/src/stores/modules/user.ts`
- 设置相关视图与组件：
  - `frontend/src/views/settings/index.vue`
  - 新增/拆分 Settings 弹窗与分组子组件（待设计细化）
- 可能影响依赖：
  - 与 `/settings` 直链相关的页面跳转点（如 `dashboard`、`automations`）需要统一改为打开 Settings 弹窗或跳转锚点策略。
