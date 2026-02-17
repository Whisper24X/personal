## Context

当前后端实现已覆盖认证、用户和业务线，但缺少第一阶段闭环关键模块：项目、项目成员、工作流模板、任务执行链路与日志流。前端页面已具备基础壳结构，缺失的主要是后端可用能力与接口契约。现阶段目标是以最小可用架构补齐核心域，保证后续可平滑演进到 Worker + 队列模式。

约束条件：
- 保持与现有 NestJS + TypeORM 分层风格一致（domain/repository/relational 实现）。
- 避免引入 Redis/Kafka 等新基础设施，第一阶段优先进程内能力。
- 任务状态遵循文档定义：`todo` / `in_progress` / `in_review` / `done`。

## Goals / Non-Goals

**Goals:**
- 提供项目、项目成员、工作流模板与任务的完整 API 与数据模型。
- 任务创建时生成有序 TaskNode，并支持执行/重试/取消等基础动作。
- 提供可认证的任务 SSE 日志流接口，支持前端实时展示。
- 将权限规则固化在服务层：管理员、业务线 owner/admin 隐式权限、项目成员显式权限。

**Non-Goals:**
- 不在本次实现独立 Runner Worker、分布式队列和多副本日志总线。
- 不引入复杂可视化编排 DSL，仅使用 JSON 节点定义和顺序执行。
- 不覆盖 Skills/MCP 市场完整治理能力（仅保留项目配置中的白名单快照入口）。

## Decisions

### 1) 采用“垂直模块 + 仓储抽象”扩展方式
- 决策：新增 `projects`、`project-members`、`workflow-templates`、`tasks` 等 feature module，保持与现有 `business-lines` 模块一致的 repository 抽象与 relational 实现。
- 原因：与仓库既有代码风格一致，降低维护成本，并支持后续替换持久化实现。
- 备选方案：直接在 service 层注入 TypeORM repository；放弃原因是会破坏现有架构一致性并增加耦合。

### 2) 任务执行采用“任务即运行实例”模型
- 决策：不新增 WorkflowRun/WorkNodeRun，使用 `tasks + task_nodes + task_logs` 承载执行链路。
- 原因：与需求文档第 8/9 节一致，降低状态同步复杂度。
- 备选方案：保留独立运行表；放弃原因是 MVP 复杂度过高，且与文档目标不一致。

### 3) 工作流模板采用“模板主表 + 版本快照表”
- 决策：`workflow_templates` 保存当前可编辑内容，`workflow_template_versions` 保存发布快照；任务创建固定写入模板版本号与节点快照。
- 原因：满足可追溯和可复现要求，同时不阻塞模板迭代。
- 备选方案：仅维护模板主表；放弃原因是任务不可复现且无法审计版本。

### 4) 日志流采用“进程内事件总线 + 数据库持久化”
- 决策：任务执行时写入 `task_logs`，同时通过进程内事件发布给 SSE 订阅者；断线后可从 DB 回放。
- 原因：第一阶段无需额外基础设施，能够快速闭环。
- 备选方案：纯内存日志不落库；放弃原因是无法追溯且客户端重连丢失上下文。

### 5) 权限策略下沉服务层统一校验
- 决策：在项目/任务相关服务中统一通过业务线成员与项目成员校验访问、管理和执行权限。
- 原因：避免控制器分散鉴权逻辑，减少遗漏。
- 备选方案：仅依赖路由守卫；放弃原因是对象级权限难以在 guard 中完整表达。

## Risks / Trade-offs

- [单进程事件总线无法跨实例广播] → 第一阶段限定单实例；第二阶段引入 Redis PubSub 并保持 `task_logs` 回放兼容。
- [任务状态聚合与节点更新并发冲突] → 使用数据库事务与行级锁处理节点推进，更新后统一重算任务状态。
- [模板 JSON 灵活但缺少强约束] → 通过 DTO 校验节点字段与 `nodeOrder` 唯一性，后续再演进为更严格 schema。
- [权限规则较多容易遗漏] → 抽象可复用的访问校验方法，并补充 e2e 覆盖关键越权场景。

## Migration Plan

1. 新增数据表与索引迁移（projects、project_members、workflow_templates、workflow_template_versions、tasks、task_nodes、task_logs）。
2. 接入新模块到 `AppModule`，发布后仅暴露新 API，不影响现有 auth/users/business-lines。
3. 前端按模块逐步切换到真实 API：先项目与模板，再任务执行与日志流。
4. 若上线异常，可回滚到上一版本并执行 migration revert（不触碰现有用户/业务线核心表）。

## Open Questions

- 第一阶段任务“取消”语义是否直接将当前节点置为 `in_review` 并记录取消原因（建议如此）。
- 模板发布是否需要审批流（当前默认管理员/项目 owner 可直接发布）。
- 日志 SSE 断线重连是否需要 `Last-Event-ID` 精确续传（当前计划先支持基于时间戳回放）。
