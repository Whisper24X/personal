# 前端日志线性展示实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 改造前端日志展示，让任务执行过程能按时间线性查看，并让 Agent 日志实时更新、最新优先且更易读。

**Architecture:** 在 `apps/web` 新增日志时间线归一化模块和展示组件，把 task transitions、execution logs、live events 合并成统一时间线。`Agents / Runs` 页继续复用现有三栏结构，增加最近活动排序、最新日志摘要和更清晰的状态/错误样式。

**Tech Stack:** TypeScript / React / Vite / Vitest，子模块 `apps/web`

---

## File Structure

- Create: `apps/web/src/log-timeline.ts`
  - 负责 `LogTimelineItem` 类型、数据归一化、稳定排序、tone 分类和上下文字段映射。
- Create: `apps/web/src/log-timeline.spec.ts`
  - 覆盖归一化、双模式排序、缺失时间戳回退、tone 分类和去重 id。
- Create: `apps/web/src/log-timeline-view.tsx`
  - 渲染统一日志时间线、排序切换、来源标签、状态高亮和空状态。
- Create: `apps/web/src/log-timeline-view.spec.tsx`
  - 覆盖默认最新优先、切换从开始查看、错误高亮和空状态。
- Modify: `apps/web/src/App.tsx`
  - 整合统一时间线，收到 `EventSource` 后刷新当前 run observability 和打开中的 raw logs。
- Modify: `apps/web/src/App.spec.tsx`
  - 覆盖任务详情统一时间线、实时事件触发后的刷新和 raw logs modal 刷新。
- Modify: `apps/web/src/run-observability.tsx`
  - Agents/Runs 列表按最近活动排序，详情区展示最新 Agent 日志摘要。
- Modify: `apps/web/src/raw-log-modal.tsx`
  - 保证 raw logs 按最新时间排序展示，强化日志卡片层级和实时更新提示。
- Modify: `apps/web/src/styles.css`
  - 补充线性时间线、排序切换、日志摘要、raw log 卡片和响应式样式。
- Modify: `apps/web/src/i18n/en.ts`
  - 添加英文文案。
- Modify: `apps/web/src/i18n/zh.ts`
  - 添加中文文案。

## Commands

- 单文件测试：`npm run test -w apps/web -- apps/web/src/log-timeline.spec.ts`
- 组件测试：`npm run test -w apps/web -- apps/web/src/log-timeline-view.spec.tsx`
- 应用集成测试：`npm run test -w apps/web -- apps/web/src/App.spec.tsx`
- 全量前端测试：`npm run test -w apps/web`
- 类型检查：`npm run type-check -w apps/web`
- 构建：`npm run build -w apps/web`

---

### Task 1: 日志时间线归一化

**Files:**
- Create: `apps/web/src/log-timeline.ts`
- Create: `apps/web/src/log-timeline.spec.ts`

- [ ] **Step 1: Write the failing test**

在 `apps/web/src/log-timeline.spec.ts` 中创建测试，覆盖：
- transition、execution log、live event 归一为统一 `LogTimelineItem`
- 默认按 `createdAt` / `timestamp` 最新优先
- `sortDirection: "asc"` 时按开始到结束排序
- 缺失时间戳时稳定排到列表末尾
- failed/stderr/error 为 danger，retry/block 为 warn，succeeded/completed 为 success

```ts
import { describe, expect, it } from 'vitest'
import { buildLogTimelineItems, sortLogTimelineItems } from './log-timeline'

describe('log timeline', () => {
  it('normalizes task signals and sorts newest first by default', () => {
    const items = buildLogTimelineItems({
      transitions: [{
        taskId: 'task-1',
        traceId: 'trace-1',
        from: 'running',
        to: 'failed',
        reason: 'test failed',
        operator: 'controller',
        timestamp: '2026-06-23T09:10:00.000Z',
      }],
      executionLogs: [{
        id: 'log-1',
        taskId: 'task-1',
        executionId: 'exec-1',
        eventType: 'executor.started',
        message: 'agent started',
        data: {},
        createdAt: '2026-06-23T09:09:00.000Z',
      }],
      liveEvents: [{
        id: 'event-1',
        eventType: 'execution.retry_scheduled',
        message: 'retry scheduled',
        traceId: 'trace-1',
        taskId: 'task-1',
        createdAt: '2026-06-23T09:11:00.000Z',
      }],
    })

    expect(items.map((item) => item.id)).toEqual([
      'event:event-1',
      'transition:task-1:2026-06-23T09:10:00.000Z:0',
      'log:log-1',
    ])
    expect(items[0].tone).toBe('warn')
    expect(items[1].tone).toBe('danger')
  })

  it('can sort from the beginning', () => {
    const sorted = sortLogTimelineItems([
      {
        id: 'new',
        source: 'event',
        tone: 'info',
        title: 'new event',
        message: 'newest event',
        occurredAt: '2026-06-23T09:11:00.000Z',
        sequence: 1,
        context: [],
      },
      {
        id: 'old',
        source: 'log',
        tone: 'info',
        title: 'old log',
        message: 'oldest log',
        occurredAt: '2026-06-23T09:09:00.000Z',
        sequence: 0,
        context: [],
      },
    ], 'asc')

    expect(sorted.map((item) => item.id)).toEqual(['old', 'new'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- apps/web/src/log-timeline.spec.ts`

Expected: FAIL because `log-timeline.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

创建 `apps/web/src/log-timeline.ts`，导出：
- `LogTimelineSortDirection = "desc" | "asc"`
- `LogTimelineTone = "info" | "warn" | "danger" | "success"`
- `LogTimelineItem`
- `buildLogTimelineItems(input)`
- `sortLogTimelineItems(items, direction)`

实现必须使用稳定 sequence 回退，避免同时间戳或缺失时间戳时排序抖动。

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/web -- apps/web/src/log-timeline.spec.ts`

Expected: PASS.

### Task 2: 任务详情统一时间线组件

**Files:**
- Create: `apps/web/src/log-timeline-view.tsx`
- Create: `apps/web/src/log-timeline-view.spec.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Write the failing test**

在 `apps/web/src/log-timeline-view.spec.tsx` 中创建组件测试，覆盖：
- 默认展示最新优先
- 点击 `View from start` / `从开始看` 后变为正序
- danger 条目有错误样式
- 空列表展示空状态文案

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- apps/web/src/log-timeline-view.spec.tsx`

Expected: FAIL because `LogTimelineView` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

创建 `LogTimelineView`：
- Props：`items`、`defaultDirection`、`formatDate`
- 内部维护 `sortDirection`
- 使用 `sortLogTimelineItems`
- 渲染标题、排序切换按钮、条目标题、消息、来源 badge、时间、上下文字段和空状态

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/web -- apps/web/src/log-timeline-view.spec.tsx`

Expected: PASS.

### Task 3: 整合任务详情页与实时刷新

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.spec.tsx`

- [ ] **Step 1: Write the failing test**

在 `apps/web/src/App.spec.tsx` 中补充测试，覆盖：
- 打开 Tasks 后选中任务，看到统一时间线标题和来自 execution log / live event / transition 的条目
- 默认最新事件在最上方，切换后最早事件在最上方
- `EventSource` 收到事件后会刷新当前任务详情、runs 和选中 run observability
- raw logs modal 打开时，收到实时事件会重新请求 `/runs/:id/raw-logs`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- apps/web/src/App.spec.tsx`

Expected: FAIL because App still renders分散的 execution logs/live events，并且未刷新选中 run/raw logs。

- [ ] **Step 3: Write minimal implementation**

修改 `App.tsx`：
- 使用 `buildLogTimelineItems` 构造 `selectedTimelineItems`
- 用 `LogTimelineView` 替换任务详情中的 execution logs 和 live events 分散区块
- `EventSource` 防抖刷新中补充：
  - 若 `selectedRunIdRef.current` 存在，刷新 `getRunObservability`
  - 若 `rawLogRunIdRef.current` 存在，刷新 `getRunRawLogs`
- 保留 eval results 与 lifecycle 的必要摘要或入口，避免现有信息完全丢失

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/web -- apps/web/src/App.spec.tsx`

Expected: PASS.

### Task 4: Agents / Runs 最新日志摘要

**Files:**
- Modify: `apps/web/src/run-observability.tsx`
- Modify: `apps/web/src/App.spec.tsx`
- Modify: `apps/web/src/i18n/en.ts`
- Modify: `apps/web/src/i18n/zh.ts`

- [ ] **Step 1: Write the failing test**

在 `apps/web/src/App.spec.tsx` 中补充测试，覆盖：
- Agents/Runs 页中 Runs 按 `startedAt` 最新优先
- Agent 列表按关联 run 的最近时间或活跃状态排序
- 选中 run 详情显示最新 step/log 摘要、阶段状态和错误摘要

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- apps/web/src/App.spec.tsx`

Expected: FAIL because current `AgentsRunsView` does not expose latest log summary and sorting is not guaranteed.

- [ ] **Step 3: Write minimal implementation**

修改 `run-observability.tsx`：
- 派生 `displayedRuns` 时按 `startedAt` / `endedAt` 最新优先排序
- 派生 `displayedAgents` 时按 `running/active` > 最近 step/plugin event > `endedAt` > `startedAt` 的优先级排序
- 在详情区按 `endedAt ?? startedAt` 降序取最近 step 作为日志摘要，并对 failed/error 做 danger 高亮；没有 step 时回退到 run summary
- 保留 raw logs 按钮

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/web -- apps/web/src/App.spec.tsx`

Expected: PASS.

### Task 5: Raw logs 最新优先与样式清晰化

**Files:**
- Modify: `apps/web/src/raw-log-modal.tsx`
- Modify: `apps/web/src/App.spec.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Write the failing test**

在 `apps/web/src/App.spec.tsx` 中补充测试，覆盖：
- raw logs modal 中日志按 `createdAt` 最新优先
- stderr/error 条目具有 danger 样式
- source/search 仍然会带 query 请求后端

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w apps/web -- apps/web/src/App.spec.tsx`

Expected: FAIL because raw logs 当前按后端返回顺序展示，未显式排序。

- [ ] **Step 3: Write minimal implementation**

修改 `raw-log-modal.tsx`：
- 渲染前按 `createdAt` 最新优先排序
- 保持复制文本使用排序后的可见文本
- 补充实时更新提示和更清晰的 source/tone 样式 class

修改 `styles.css`：
- 新增 `.log-timeline-*`
- 优化 `.raw-log-item`、`.raw-log-title`、`.raw-log-meta`、`.raw-log-fields`
- 确保长日志 `overflow-wrap: anywhere`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w apps/web -- apps/web/src/App.spec.tsx`

Expected: PASS.

### Task 6: 前端验证

**Files:**
- Modify: `apps/web/src/*`

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test -w apps/web -- apps/web/src/log-timeline.spec.ts
npm run test -w apps/web -- apps/web/src/log-timeline-view.spec.tsx
npm run test -w apps/web -- apps/web/src/App.spec.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full frontend checks**

Run:

```bash
npm run test -w apps/web
npm run type-check -w apps/web
npm run build -w apps/web
```

Expected: PASS.
