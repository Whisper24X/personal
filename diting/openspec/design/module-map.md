# Module Map

> 来源：[docs/architecture/diting-architecture-description.md](../../docs/architecture/diting-architecture-description.md) §8、§12、§13；与当前仓库布局对照

## 模块协作（目标态流程）

### 创建任务

```
Presentation (POST /tasks, webhook)
  → Application (TaskCommandService)
  → Task Intake / 持久化
  → Task Lifecycle (created)
```

### 调度执行

```
Scheduler tick
  → 选取 queued 任务 + idle Agent
  → Execution Orchestration (Goal Loop)
  → Environment → Execution → Quality → RepairLoop（循环）
  → Task Lifecycle 状态迁移 + Observability 事件
```

### 人工接管

```
Stop signal / API needs-human
  → Human Intervention
  → task-integration 回写（若启用）
  → recover → queued → 重新调度
```

### 插件调用

```
PluginRuntime 按 kind + capability + priority 选型
  → 各 kind 插件实现（plugin-api 契约）
  → Log 插件统一落盘 logs/
```

## 当前仓库目录（已实现）

```
apps/
  server/          # Fastify 宿主、repositories、migrations、内置插件
  web/             # React 控制台
packages/
  core/            # 领域、状态机、调度、Goal Loop、PluginRuntime
  plugin-api/      # 稳定插件与领域类型契约
openspec/
  specs/           # 工程规范（本迁移新增）
  design/          # 目标态摘要（本迁移新增）
docs/
  architecture/    # 叙事文档（保留）
```

## 推荐 core 模块映射（目标 ↔ 现状）

| 目标模块 | 当前主要代码 |
| --- | --- |
| Task Lifecycle | `packages/core/src/diting/state-machine.ts`、`task-command-service.ts` |
| Scheduler | `scheduler-service.ts`、`service-scheduler.ts` |
| Execution Orchestration | `execution-orchestrator.ts`、`service-execution.ts` |
| Repair Loop | `repair-loop-service.ts` |
| Human Intervention | `human-intervention-service.ts` |
| Plugin Management | `plugin-runtime.ts`、`plugin-lifecycle-manager.ts`、`plugin-admin-service.ts` |
| Persistence | `apps/server/src/diting/repositories.ts`、`migrations/` |
| Presentation / BFF | `apps/server/src/diting/server.ts`、`ops-view.ts` |

## 架构约束（摘自目标文档 §13）

1. 状态迁移只能经状态机与应用服务
2. 插件不得直接改库或自建状态机
3. 命令与查询 API 分离
4. 结构化事件必须可观测（logs + SSE）
5. 长流程必须可 recover/retry/repair
6. core 不得依赖 HTTP/DB 框架

上述已纳入 `openspec/specs/overview`、`task-lifecycle`、`plugins` 等 spec。

## 迁移建议

历史 NestJS/TypeORM 数据使用 `npm run migration:legacy -w apps/server`；新功能优先在 `packages/core` 扩展领域逻辑，宿主仅做装配与传输。详见 [diting-architecture-description.md §14](../../docs/architecture/diting-architecture-description.md)。
