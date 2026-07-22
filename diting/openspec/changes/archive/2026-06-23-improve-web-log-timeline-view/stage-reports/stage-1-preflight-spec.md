# Stage 1 Preflight & Spec Report

## Change ID

`improve-web-log-timeline-view`

## 规格路径

- Proposal: `openspec/changes/improve-web-log-timeline-view/proposal.md`
- Design: `openspec/changes/improve-web-log-timeline-view/design.md`
- Plan: `openspec/changes/improve-web-log-timeline-view/plan.md`
- Tasks: `openspec/changes/improve-web-log-timeline-view/tasks.md`
- Spec: `openspec/changes/improve-web-log-timeline-view/specs/web-log-observability/spec.md`

## 技术栈 Profile

| 项 | 值 |
|---|---|
| Profile | `typescript` |
| 子模块 | `apps/web` |
| 框架 | React + Vite + TypeScript |
| 测试 | Vitest + Testing Library |
| 构建 | `npm run build -w apps/web` |
| 类型检查 | `npm run type-check -w apps/web` |
| 单测 | `npm run test -w apps/web` |

## 任务包完整性

| 制品 | 状态 |
|---|---|
| `proposal.md` | 存在 |
| `design.md` | 存在 |
| `plan.md` | 存在 |
| `tasks.md` | 存在 |
| `workflow-state.md` | 存在 |
| `specs/web-log-observability/spec.md` | 存在 |
| `openspec-workflow-preflight-spec` skill | 存在（`.cursor/skills/`） |
| `openspec-workflow-implementation` skill | 存在（`.cursor/skills/`） |

阶段 1 Brainstorming 与阶段 2 OpenSpec 制品已完成；User Review Gate 已确认（任务包已物化并请求进入实现）。

## 需求摘要

- 任务详情页新增统一执行时间线，归一 lifecycle transitions、execution logs、live events，默认最新优先，支持从开始查看。
- `Agents / Runs` 页按最近活动排序 Agent/Run，展示最新日志摘要与错误高亮。
- 复用现有 `EventSource` 实时刷新任务详情、选中 run observability 与打开中的 raw logs。
- 不新增后端 API；优先复用现有 observability 与 raw-logs 接口。

## 假设与风险

- 不同数据源时间戳可能为空或精度不一致，排序需稳定 sequence 回退（已在 design 中约定）。
- `EventSource` 仅推事件摘要，raw logs 需重新请求；实现阶段需防抖避免过多请求。
- 用户时间线排序偏好本 change 不持久化（design Open Questions）。
- `openspec validate improve-web-log-timeline-view --strict` 需在归档前由用户或平台执行。

## 是否允许进入 Implement

**是。** 关键制品齐全，规格与计划一致，无阻断项。
