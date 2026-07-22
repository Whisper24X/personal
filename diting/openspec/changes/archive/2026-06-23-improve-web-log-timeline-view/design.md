# 前端日志线性展示设计文档

## 澄清问题及结论

- 改造范围限定在前端日志展示体验，不进入后端数据结构改造，优先复用现有 API：`/tasks/:id/observability`、`/runs`、`/runs/:id/observability`、`/runs/:id/raw-logs` 与 `/events`。
- 布局方向采用 `A + B`：任务详情页新增统一线性时间线，`Agents / Runs` 页强化最新日志摘要与实时状态。
- 任务详情时间线采用双模式：默认最新优先，便于快速查看当前进度和最新问题；同时提供从开始查看，便于复盘完整执行过程。
- Agent 日志需要实时更新，并按最新时间排序；实时触发继续复用现有 `EventSource`，收到事件后刷新全局数据、选中任务详情、选中 run observability 与打开中的 raw logs。
- 不在本阶段进入实现；本 change 只完成设计、计划和 OpenSpec 制品。

## 候选方案对比

### 方案 A：任务时间线优先

优点：
- 把 lifecycle、execution logs、live events 放到同一条时间主轴，符合“按任务执行时间线性查看”的主要目标。
- 默认最新优先可以快速定位当前进度和最新错误。
- 能在任务上下文中保留 retry、block、eval、agent、plugin 等信号。

缺点：
- 需要对不同来源事件做归一化，避免重复、缺时间戳或字段不一致导致排序混乱。
- 只改任务详情时，对 `Agents / Runs` 页的 Agent 实时观察帮助有限。

### 方案 B：运行 / Agent 分栏联动

优点：
- 顺应当前 `AgentsRunsView` 三栏结构，改动边界清晰。
- 可强化 Agent 列表、Run 列表和详情区之间的联动，让“哪个 Agent 正在做什么”更直观。
- 适合展示最新 Agent 日志摘要、状态、运行阶段和原始日志入口。

缺点：
- 如果只做该方案，任务级完整执行过程仍然分散在多个区块里。
- 问题定位仍可能需要在 Run 详情、raw logs 和任务详情之间跳转。

### 方案 C：统一原始日志流

优点：
- 以 raw logs 为核心，最接近排障时需要的原始信息。
- 对 stdout、stderr、summary、event、file 等来源可提供统一筛选和搜索。

缺点：
- 容易把任务进度、阶段、生命周期状态淹没在原始日志里。
- 对快速判断“当前进行到哪一步”不如结构化时间线清晰。

## 最终选择及理由

采用 `A + B` 组合方案。

任务详情页负责解决“按任务执行时间线性查看”和“快速定位问题”：新增统一执行时间线，将 lifecycle transitions、execution logs、live events 归一为同一类时间线条目，默认按最新时间倒序展示，并提供从开始查看的正序切换。

`Agents / Runs` 页负责解决“Agent 日志实时更新”和“当前 Agent/Run 状态可观察”：保留现有三栏结构，但 Agent 列表和 Run 列表按最近活动排序；详情区展示阶段进度、最新 Agent 日志摘要、错误高亮和 raw logs 入口。

## 技术设计

### 技术栈 Profile

- Profile：`typescript`
- 子模块：`apps/web`
- 框架：React + Vite + TypeScript
- 测试：Vitest + Testing Library
- 构建：`npm run build -w apps/web`
- 类型检查：`npm run type-check -w apps/web`
- 单测：`npm run test -w apps/web -- <test-file>`
- 全量测试：`npm run test -w apps/web`

### 架构分层

- 归一化层：新增 `apps/web/src/log-timeline.ts`，把 transition、execution log、live event 归一为 `LogTimelineItem`，并提供排序、过滤、来源映射和 tone 分类能力。
- 展示层：新增 `apps/web/src/log-timeline-view.tsx`，渲染统一时间线、排序切换、来源标签、状态高亮、空状态和可读时间。
- 任务详情整合：修改 `apps/web/src/App.tsx`，用统一时间线替换当前分散的 execution logs + live events 组合视图，保留 lifecycle 和 eval 的关键入口，避免信息丢失。
- Agent/Run 展示：修改 `apps/web/src/run-observability.tsx`，按最近活动排序 Agents/Runs，展示选中 Run 的阶段进度与最新 Agent 日志摘要。
- Raw logs 体验：修改 `apps/web/src/raw-log-modal.tsx`，在打开时随 `EventSource` 刷新最新日志，保持最新优先排序和更清晰的日志卡片样式。
- 样式与文案：修改 `apps/web/src/styles.css`、`apps/web/src/i18n/en.ts`、`apps/web/src/i18n/zh.ts`，补充时间线、排序切换、实时更新提示和日志摘要文案。

### 关键决策

- 排序默认值：任务详情时间线和 Agent 最新日志默认最新优先；任务详情提供正序切换。
- 数据来源：实现阶段优先复用现有前端已拿到的数据，不新增后端 API；缺少 raw log 时使用 run steps 和 execution logs 作为摘要来源。
- 实时刷新：复用现有 `EventSource` 事件通道，收到事件后刷新 `refreshAll()`、当前任务详情、当前选中 run observability；若 raw logs modal 打开，同步刷新 raw logs。
- 日志去重：统一时间线以来源前缀和原始 id 组成稳定 id，例如 `transition:<taskId>:<timestamp || "missing">:<index>`、`log:<id>`、`event:<id>`。
- 最近活动排序：`Agents / Runs` 中优先展示 running/active，再按最近 step/plugin event 时间、`endedAt`、`startedAt` 依次回退，确保“最新”语义稳定。
- 高亮规则：错误类事件、`stderr`、failed 状态使用 danger；retry/block 使用 warn；succeeded/completed 使用 success；其余为 info。

### 风险与约束

- 不同数据源时间戳字段可能为空或精度不同，排序函数需要稳定回退，不能产生随机抖动。
- 当前 `EventSource` 只推事件摘要，raw logs 仍需重新请求；需要做防抖，避免连续事件导致过多请求。
- `App.tsx` 已经较大，实现阶段应优先把归一化和时间线视图拆到独立文件，避免继续堆叠复杂度。
- 原始日志可能包含较长内容，样式需要支持换行、折叠或合理截断，避免撑破布局。

### Open Questions（供 Code Review 阶段补充）

- 是否需要在后续后端能力中提供任务级统一 timeline API，以减少前端归一化逻辑。
- 是否需要为 raw logs 增加 cursor 自动加载更多，本 change 暂不纳入。
- 是否需要持久化用户选择的时间线排序模式，本 change 默认不持久化。
