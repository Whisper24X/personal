## Why

当前仓库后端只完成了身份、用户与业务线域，第一阶段闭环所需的项目、模板、任务与执行流能力仍缺失，导致“创建任务→执行→查看日志与产物”无法落地。需要补齐这些剩余模块以实现可演示的 MVP 主链路。

## What Changes

- 新增项目管理能力：项目 CRUD、项目配置（Agent/Skills/MCP/并发策略）和业务线归属。
- 新增项目成员管理能力：项目成员增删改查与角色控制（owner/maintainer/developer/viewer）。
- 新增工作流模板能力：模板 CRUD、启用禁用、版本发布与节点顺序定义。
- 新增任务执行主链路：任务创建、模板实例化 TaskNode、执行/重试/取消接口与状态聚合。
- 新增任务日志流接口：提供 SSE 流式输出，支持前端实时展示任务节点日志。

## Capabilities

### New Capabilities
- `project-management`: 项目实体与配置管理（含业务线归属、Git 地址、默认分支、配置快照）。
- `project-membership`: 项目成员与角色管理，含成员授权约束与权限校验。
- `workflow-template-management`: 工作流模板及模板版本管理，支持有序节点定义。
- `task-execution-pipeline`: 任务/任务节点模型、模板实例化、状态聚合与执行动作。
- `task-log-streaming`: 任务日志事件发布与 SSE 订阅输出。

### Modified Capabilities
- _None_

## Impact

- 后端新增模块：`backend/src/projects`、`backend/src/project-members`、`backend/src/workflow-templates`、`backend/src/tasks`。
- 数据库新增实体与迁移：`projects`、`project_members`、`workflow_templates`、`workflow_template_versions`、`tasks`、`task_nodes`、`task_logs`。
- API 新增资源路径：`/api/v1/projects`、`/api/v1/workflow-templates`、`/api/v1/tasks`、`/api/v1/tasks/:id/stream`。
- 前端与集成测试可基于新增 API 打通第一阶段主链路。
