# Proposal: improve web log timeline view

## 目标

- 改造 `apps/web` 的日志展示体验，让任务执行过程能够按照时间线性查看。
- 让用户默认看到最新进度和最新问题，同时支持从任务开始复盘完整执行过程。
- 强化 `Agents / Runs` 页面中的 Agent 日志观察能力，使 Agent 日志实时更新、最新优先排序，并通过更清晰的样式突出状态和错误。

## 方案

- 在任务详情页新增统一执行时间线，将 lifecycle transitions、execution logs、live events 归一到同一条时间主轴。
- 时间线默认按最新优先展示，并提供“从开始看 / 最新优先”双模式切换。
- 在 `Agents / Runs` 页保留现有三栏布局，但按最近活动排序 Agent 和 Run，并在详情区展示最新 Agent 日志摘要、阶段进度、错误高亮和 raw logs 入口。
- 继续复用现有 `EventSource` 实时事件通道；收到事件后刷新全局数据、选中任务详情、选中 run observability，以及打开中的 raw logs。
- 不新增后端 API，优先复用现有 `/tasks/:id/observability`、`/runs`、`/runs/:id/observability`、`/runs/:id/raw-logs` 和 `/events`。

## 影响范围

- 前端模块：`apps/web`
- 主要文件：
  - `apps/web/src/App.tsx`
  - `apps/web/src/run-observability.tsx`
  - `apps/web/src/raw-log-modal.tsx`
  - `apps/web/src/styles.css`
  - `apps/web/src/i18n/en.ts`
  - `apps/web/src/i18n/zh.ts`
- 新增测试与工具模块：
  - `apps/web/src/log-timeline.ts`
  - `apps/web/src/log-timeline.spec.ts`
  - `apps/web/src/log-timeline-view.tsx`
  - `apps/web/src/log-timeline-view.spec.tsx`
- 验证范围：
  - 时间线归一化与双模式排序
  - Agent/Run 最近活动排序
  - `EventSource` 触发后的实时刷新
  - raw logs 最新优先展示和样式高亮

## 非目标

- 不改造后端日志存储模型。
- 不新增任务级统一 timeline API。
- 不实现 raw logs cursor 自动加载更多。
- 不进入实现阶段；本次只完成阶段 1 和阶段 2 制品。
