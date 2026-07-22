# Tasks

## 1. Stage 1 and Stage 2 artifacts

- [x] 完成阶段 1 Brainstorming：确认 `A + B` 方案与双模式排序。
- [x] 编写阶段 1 设计文档。
- [x] 编写阶段 1 实现计划。
- [x] 创建 OpenSpec change 目录与 `proposal.md`。
- [x] 创建 `specs/web-log-observability/spec.md`。
- [x] 创建本任务清单。
- [x] User Review Gate: 用户确认阶段 2 OpenSpec 制品后，方可进入实现阶段。

## 2. Log timeline normalization

- [x] RED: 在 `apps/web/src/log-timeline.spec.ts` 中编写失败测试，覆盖 transitions、execution logs、live events 归一化、默认最新优先、从开始排序、缺失时间戳稳定回退和 tone 分类。
- [x] GREEN: 创建 `apps/web/src/log-timeline.ts`，实现 `LogTimelineItem`、`buildLogTimelineItems`、`sortLogTimelineItems` 和 tone 分类。
- [x] REFACTOR: 运行 `npm run test -w apps/web -- apps/web/src/log-timeline.spec.ts` 并保持通过，清理重复类型和排序回退逻辑。

## 3. Task log timeline component

- [x] RED: 在 `apps/web/src/log-timeline-view.spec.tsx` 中编写失败测试，覆盖默认最新优先、切换从开始查看、错误高亮和空状态。
- [x] GREEN: 创建 `apps/web/src/log-timeline-view.tsx`，渲染统一时间线、排序切换、来源标签、状态高亮和空状态。
- [x] REFACTOR: 补充 `apps/web/src/i18n/en.ts` 与 `apps/web/src/i18n/zh.ts` 文案，运行组件测试并保持通过。

## 4. Task detail integration and realtime refresh

- [x] RED: 在 `apps/web/src/App.spec.tsx` 中补充失败测试，覆盖任务详情统一时间线、双模式排序、实时事件触发后的任务详情刷新、选中 run observability 刷新和 raw logs 刷新。
- [x] GREEN: 修改 `apps/web/src/App.tsx`，使用统一时间线替换分散的 execution logs/live events 视图，并在 `EventSource` 防抖刷新中补充选中 run 与 raw logs 刷新。
- [x] REFACTOR: 保留 eval/lifecycle 的关键入口，运行 `npm run test -w apps/web -- apps/web/src/App.spec.tsx` 并保持通过。

## 5. Agents / Runs latest activity

- [x] RED: 在 `apps/web/src/App.spec.tsx` 中补充失败测试，覆盖 Runs 最新优先、Agents active 优先、最近活动排序和 run 详情最新日志摘要。
- [x] GREEN: 修改 `apps/web/src/run-observability.tsx`，按 `running/active` > 最近 step/plugin event > `endedAt` > `startedAt` 排序，并展示最新 step/log 摘要。
- [x] REFACTOR: 保留 raw logs 入口，补充必要 i18n 文案，运行相关测试并保持通过。

## 6. Raw logs newest-first and clearer styling

- [x] RED: 在 `apps/web/src/App.spec.tsx` 中补充失败测试，覆盖 raw logs 最新优先、stderr/error danger 样式和 source/search query 保持可用。
- [x] GREEN: 修改 `apps/web/src/raw-log-modal.tsx`，按 `createdAt` 最新优先渲染 raw logs，并保留当前筛选与复制行为。
- [x] REFACTOR: 修改 `apps/web/src/styles.css`，补充 `.log-timeline-*`、raw log 卡片、source badge、长日志换行和响应式样式。

## 7. Verification

- [x] 运行 `npm run test -w apps/web -- apps/web/src/log-timeline.spec.ts`。
- [x] 运行 `npm run test -w apps/web -- apps/web/src/log-timeline-view.spec.tsx`。
- [x] 运行 `npm run test -w apps/web -- apps/web/src/App.spec.tsx`。
- [x] 运行 `npm run test -w apps/web`。
- [x] 运行 `npm run type-check -w apps/web`。
- [x] 运行 `npm run build -w apps/web`。

## 8. Manual / human tasks

- [x] 用户在终端执行 `openspec validate improve-web-log-timeline-view --strict` 或进行等价人工格式检查。（Agent 2026-06-23 执行：PASS）
- [x] 用户确认归档前是否执行 `openspec archive improve-web-log-timeline-view --yes`。（Agent 2026-06-23 执行：归档为 `2026-06-23-improve-web-log-timeline-view`）
