## Context

当前布局由 `frontend/src/hooks/core/useLayout.ts` 统一管理，左侧栏第二列菜单来自 `baseMenuItems`，其中同时包含项目域功能（如 `workflow`、`tasks`）与工作区管理功能（如 `about`、`business-lines`、`projects`、`users`）。这与第一列“项目选择器”形成职责冲突。

现状中 `settings` 通过 `openSettingsPage()` 跳转到 `/settings` 独立页面（`frontend/src/views/settings/index.vue`），而多个管理页又散落为独立路由，导致：
- 导航语义不一致（项目菜单中混入系统管理）。
- 设置能力入口分散，用户需要频繁跨页面切换。
- 后续扩展设置项时，菜单复杂度持续上升。

约束：
- 前端为 Vue 3 + Composition API + TypeScript（需保持 `script setup` 风格）。
- 当前权限基于 `meta.permissions` 与 `userStore.profile.permissions`。
- 已有页面如 `business-lines`/`projects`/`users` 逻辑较重，需要可渐进迁移，避免一次性重写风险。

## Goals / Non-Goals

**Goals:**
- 将左侧栏第二列菜单收敛为“项目域导航”，移除不应归属项目域的管理项。
- 将 `about`、`business-lines`、`projects`、`users` 与现有设置能力统一到一个 Settings 弹窗，并按功能分组。
- 将 `home` 从主菜单中移除（默认不展示），减少低价值入口占用。
- 提供旧路由到 Settings 分组的兼容跳转，避免外部链接立即失效。
- 保持权限控制一致，非管理员不可见管理员分组（如 `users`）。

**Non-Goals:**
- 不重构业务 API 协议与后端数据模型。
- 不在本次改造中改写所有管理页的内部交互细节，只做容器归位与必要的 UI 适配。
- 不引入新的全局状态库，继续沿用现有 composable/store 模式。

## Decisions

### 1) 采用“双域导航”模型：项目域菜单 vs 设置域菜单
- 决策：
  - 第一列保留“项目选择器”。
  - 第二列仅保留项目域功能（如 `dashboard`、`workflow`、`tasks`、`kanban`、`automations`、`skills`、`mcp`）。
  - `about`、`business-lines`、`projects`、`users` 从 `baseMenuItems` 移除，转入 Settings 弹窗分组。
  - `home` 从默认菜单移除（可通过配置开关决定是否保留兼容入口）。
- 原因：恢复导航语义一致性，减少误导。
- 备选方案：
  - 保留现有菜单，仅在视觉上分组。该方案无法解决第二列职责混乱，放弃。

### 2) 将 `/settings` 页面升级为全局 Settings 弹窗中心
- 决策：
  - 新增 `SettingsModal` 容器组件（建议挂载于 `Layout.vue`，与 `BusinessLineModal` 并列）。
  - 在 `useLayout` 中新增 `settingsModalOpen`、`settingsSection`、`openSettings(section?)`、`closeSettings()`。
  - 现有 `openSettingsPage()` 改为打开弹窗，而非页面跳转。
  - Settings 内按分组组织：
    - 个人与通知：复用现有 `/settings` 内容。
    - 工作区信息：`about`。
    - 组织管理：`business-lines`、`projects`。
    - 权限与用户：`users`（管理员可见）。
- 原因：统一设置体验并减少路由跳转成本。
- 备选方案：
  - 使用独立 `/settings` 大页面承载分组。仍会造成“离开当前上下文”的切换，不满足目标。

### 3) 使用“路由兼容重定向 + 弹窗深链”保证迁移平滑
- 决策：
  - 保留旧路径入口（`/about`、`/business-lines`、`/projects`、`/users`、`/settings`、`/home`）作为兼容路由。
  - 旧路径统一重定向到主工作页（例如 `/dashboard`）并附带查询参数（如 `?settings=users`）。
  - `Layout/useLayout` 监听路由查询参数，自动打开 Settings 指定分组；关闭弹窗时清理查询参数。
- 原因：兼容外链与书签，避免一次性破坏历史链接。
- 备选方案：
  - 直接删除旧路由。破坏性太强，运维和用户迁移成本高。

### 4) 分组面板采用“渐进抽离”而非整页内嵌复制
- 决策：
  - 将 `views/settings/index.vue` 拆为若干可复用 section 组件。
  - `about`、`business-lines`、`projects`、`users` 逐步抽离核心列表/表单为可嵌入的 settings panels，复用现有 API hooks。
- 原因：控制改造风险，避免大规模重复代码。
- 备选方案：
  - 在弹窗内 iframe/直接嵌套整页。会引入状态冲突与样式耦合问题，放弃。

## Risks / Trade-offs

- [Risk] 弹窗承载复杂管理功能后体量较大、交互密度高  
  → Mitigation: 使用分组侧栏 + 懒加载面板，限制首屏渲染体积。

- [Risk] 旧路由重定向可能影响依赖 `route.name` 的面包屑与高亮逻辑  
  → Mitigation: 在 `breadcrumbs` 逻辑中新增“settings 分组映射”，并增加路由回归测试。

- [Risk] 非管理员权限下分组可见性处理不当会导致空白面板  
  → Mitigation: 统一基于权限过滤 Settings 分组并设置安全默认分组。

- [Trade-off] 为兼容链接保留过渡路由会增加一段时间的路由复杂度  
  → Mitigation: 在变更文档中标注弃用窗口，后续版本再移除兼容路由。

## Migration Plan

1. 新增 Settings 弹窗骨架与分组模型，保持旧 `/settings` 页面可用。
2. 将左侧栏“设置”入口切换为打开弹窗；第二列先移除 `home/about/business-lines/projects/users`。
3. 增加旧路由到 Settings 分组的重定向与查询参数深链。
4. 分阶段迁移各管理能力到 Settings 分组面板，并补充权限与回归测试。
5. 稳定后将旧页面实现降级为兼容壳或移除（按发布策略执行）。

## Open Questions

- Settings 弹窗默认打开分组应为“个人设置”还是“上次访问分组”？
- `home` 的“可删除”是仅默认隐藏，还是需要提供管理员开关可动态启用？
- `projects` 与“第一列项目选择器”边界是否需要在文案上进一步区分（例如“项目管理” vs “项目切换”）？
