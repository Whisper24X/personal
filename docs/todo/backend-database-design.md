# AINative 数据库表设计（重设计版，全部 UUID）

> 状态：`Draft v0.2`
>
> 设计依据：
> - 业务需求文档：`docs/ainative-requirement-design.md`
> - 参考表结构：你提供的 `vibework.db`（projects/tasks/workflows/work_nodes/...）
>
> 关键约束：**所有 `id` 字段均使用 UUID**。

## 1. 目标与设计取向

- 目标：在保留 AINative 需求能力的同时，尽量贴近你给的表结构，减少后续迁移成本。
- 范围：先聚焦执行主链路（项目→任务→工作流→节点→Agent 执行），再扩展模板与配置。
- 数据库：PostgreSQL + TypeORM。

## 2. 全局约束

## 2.1 ID 规则

- 每张业务表主键统一：`id uuid primary key default gen_random_uuid()`。
- 外键统一使用 `uuid`。

## 2.2 时间字段

- 统一使用：`timestamptz`。
- 命名统一：`created_at`, `updated_at`，运行态补充 `started_at`, `completed_at`。

## 2.3 状态字段

- 用 `varchar` + `check`（或 PostgreSQL enum）约束可选值。
- 默认值尽量与参考表一致（如 `todo`、`idle`）。

## 3. 核心执行链路表（P0）

## 3.1 `projects`

> 对齐你的 `projects`，保留 `path` 唯一约束。

| 字段 | 类型 | 空 | 约束/索引 | 说明 |
|---|---|---|---|---|
| id | uuid | 否 | PK | |
| name | varchar(150) | 否 | `index` | |
| path | text | 否 | `unique` | 项目本地路径或标识路径 |
| description | text | 是 | - | |
| project_type | varchar(32) | 否 | default `'normal'`, check in (`normal`,`template`,`sandbox`) | |
| git_url | text | 是 | - | 补充字段（AINative 项目模型） |
| default_branch | varchar(120) | 是 | default `'main'` | |
| created_at | timestamptz | 否 | - | |
| updated_at | timestamptz | 否 | - | |

## 3.2 `workflow_templates`

> 对齐你的 `workflow_templates`，支持全局/项目级作用域。

| 字段 | 类型 | 空 | 约束/索引 | 说明 |
|---|---|---|---|---|
| id | uuid | 否 | PK | |
| scope | varchar(16) | 否 | check in (`global`,`project`) | |
| project_id | uuid | 是 | FK -> `projects.id` on delete cascade, `index` | `scope=project` 时必填 |
| name | varchar(150) | 否 | `index` | |
| description | text | 是 | - | |
| is_enabled | boolean | 否 | default `true`, `index` | 补充启停控制 |
| version | int | 否 | default `1` | 补充版本 |
| created_at | timestamptz | 否 | - | |
| updated_at | timestamptz | 否 | - | |

建议唯一约束：`unique(scope, project_id, name, version)`。

## 3.3 `workflow_template_nodes`

> 对齐你的 `workflow_template_nodes`。

| 字段 | 类型 | 空 | 约束/索引 | 说明 |
|---|---|---|---|---|
| id | uuid | 否 | PK | |
| template_id | uuid | 否 | FK -> `workflow_templates.id` on delete cascade, `index` | |
| node_order | int | 否 | `index` | 节点顺序 |
| name | varchar(150) | 否 | - | |
| prompt | text | 否 | - | |
| node_type | varchar(32) | 否 | default `'agent'`, check in (`agent`,`skill`,`mcp`,`manual`) | 扩展AINative节点类型 |
| requires_approval | boolean | 否 | default `false` | |
| continue_on_error | boolean | 否 | default `false` | |
| timeout_seconds | int | 是 | - | 补充超时控制 |
| created_at | timestamptz | 否 | - | |
| updated_at | timestamptz | 否 | - | |

建议唯一约束：`unique(template_id, node_order)`。

## 3.4 `tasks`

> 对齐你的 `tasks`，并补充 AINative 任务字段。

| 字段 | 类型 | 空 | 约束/索引 | 说明 |
|---|---|---|---|---|
| id | uuid | 否 | PK | |
| session_id | uuid | 是 | `unique` | 任务会话（可选） |
| title | varchar(255) | 否 | `index` | |
| prompt | text | 否 | - | |
| description | text | 是 | - | AINative 扩展 |
| acceptance_criteria | jsonb | 否 | default `'[]'::jsonb` | AINative 扩展 |
| status | varchar(32) | 否 | default `'todo'`, `index` | check in (`todo`,`ready`,`queued`,`running`,`paused`,`waiting_input`,`succeeded`,`failed`,`timeout`,`canceled`) |
| project_id | uuid | 是 | FK -> `projects.id` on delete set null, `index` | |
| worktree_path | text | 是 | - | |
| branch_name | varchar(120) | 是 | - | |
| base_branch | varchar(120) | 是 | - | |
| workspace_path | text | 是 | - | |
| cli_tool_id | uuid | 是 | - | 先保留引用ID，后续决定是否建表 |
| agent_tool_config_id | uuid | 是 | FK -> `agent_tool_configs.id` on delete set null, `index` | |
| agent_tool_config_snapshot | jsonb | 是 | - | 运行快照 |
| workflow_template_id | uuid | 是 | FK -> `workflow_templates.id` on delete set null, `index` | |
| cost | numeric(12,4) | 是 | - | |
| duration | numeric(12,3) | 是 | - | 秒 |
| favorite | boolean | 否 | default `false`, `index` | |
| created_by | uuid | 是 | - | 预留（若用户改 UUID 后接入） |
| created_at | timestamptz | 否 | `index` | |
| updated_at | timestamptz | 否 | - | |

建议索引：

- `index(project_id, status)`
- `index(created_at desc)`

## 3.5 `workflows`

> 对齐你的 `workflows`。

| 字段 | 类型 | 空 | 约束/索引 | 说明 |
|---|---|---|---|---|
| id | uuid | 否 | PK | |
| task_id | uuid | 否 | FK -> `tasks.id` on delete cascade, `index` | |
| current_node_index | int | 否 | default `0` | |
| status | varchar(32) | 否 | default `'todo'`, `index` | check in (`todo`,`running`,`succeeded`,`failed`,`canceled`) |
| attempt | int | 否 | default `1` | 第几次执行 |
| template_snapshot | jsonb | 是 | - | AINative 扩展 |
| started_at | timestamptz | 是 | - | |
| completed_at | timestamptz | 是 | - | |
| created_at | timestamptz | 否 | - | |
| updated_at | timestamptz | 否 | - | |

建议唯一约束：`unique(task_id, attempt)`。

## 3.6 `work_nodes`

> 对齐你的 `work_nodes`，并兼容 AINative 节点执行追踪。

| 字段 | 类型 | 空 | 约束/索引 | 说明 |
|---|---|---|---|---|
| id | uuid | 否 | PK | |
| workflow_id | uuid | 否 | FK -> `workflows.id` on delete cascade, `index` | |
| template_node_id | uuid | 是 | FK -> `workflow_template_nodes.id` on delete set null, `index` | |
| node_order | int | 否 | `index` | |
| name | varchar(150) | 否 | - | |
| prompt | text | 否 | - | |
| node_type | varchar(32) | 否 | default `'agent'`, `index` | check in (`agent`,`skill`,`mcp`,`manual`) |
| requires_approval | boolean | 否 | default `false` | |
| continue_on_error | boolean | 否 | default `false` | |
| status | varchar(32) | 否 | default `'todo'`, `index` | check in (`todo`,`running`,`succeeded`,`failed`,`skipped`,`blocked`) |
| input_json | jsonb | 是 | - | AINative 扩展 |
| output_json | jsonb | 是 | - | AINative 扩展 |
| started_at | timestamptz | 是 | - | |
| completed_at | timestamptz | 是 | - | |
| created_at | timestamptz | 否 | - | |
| updated_at | timestamptz | 否 | - | |

建议唯一约束：`unique(workflow_id, node_order)`。

## 3.7 `agent_executions`

> 对齐你的 `agent_executions`，补充重试与错误信息。

| 字段 | 类型 | 空 | 约束/索引 | 说明 |
|---|---|---|---|---|
| id | uuid | 否 | PK | |
| work_node_id | uuid | 否 | FK -> `work_nodes.id` on delete cascade, `index` | |
| execution_index | int | 否 | - | 第几次执行 |
| status | varchar(32) | 否 | default `'idle'`, `index` | check in (`idle`,`running`,`succeeded`,`failed`,`timeout`,`canceled`) |
| started_at | timestamptz | 是 | - | |
| completed_at | timestamptz | 是 | - | |
| cost | numeric(12,4) | 是 | - | |
| duration | numeric(12,3) | 是 | - | 秒 |
| error_code | varchar(64) | 是 | `index` | CFG_/AUTH_/... |
| error_message | text | 是 | - | |
| output_summary | text | 是 | - | |
| created_at | timestamptz | 否 | - | |

建议唯一约束：`unique(work_node_id, execution_index)`。

## 3.8 `agent_tool_configs`

> 对齐你的 `agent_tool_configs`。

| 字段 | 类型 | 空 | 约束/索引 | 说明 |
|---|---|---|---|---|
| id | uuid | 否 | PK | |
| tool_id | uuid | 否 | `index` | 工具定义ID（可后续关联工具表） |
| name | varchar(120) | 否 | - | |
| description | text | 是 | - | |
| config_json | jsonb | 否 | - | 配置 |
| is_default | boolean | 否 | default `false`, `index` | |
| created_at | timestamptz | 否 | - | |
| updated_at | timestamptz | 否 | - | |

建议唯一约束：`unique(tool_id, name)`。

## 4. 可观测与产物表（P1，建议紧随 P0）

## 4.1 `task_logs`

| 字段 | 类型 | 空 | 约束/索引 | 说明 |
|---|---|---|---|---|
| id | uuid | 否 | PK | |
| task_id | uuid | 否 | FK -> `tasks.id` on delete cascade, `index` | |
| workflow_id | uuid | 是 | FK -> `workflows.id` on delete cascade, `index` | |
| work_node_id | uuid | 是 | FK -> `work_nodes.id` on delete cascade, `index` | |
| level | varchar(16) | 否 | default `'info'`, `index` | debug/info/warn/error |
| event_type | varchar(16) | 否 | default `'log'`, `index` | status/log/artifact/done |
| message | text | 是 | - | |
| payload | jsonb | 否 | default `'{}'::jsonb` | SSE payload |
| seq | bigint | 否 | - | 任务内顺序号 |
| created_at | timestamptz | 否 | `index` | |

建议唯一约束：`unique(task_id, seq)`。

## 4.2 `artifacts`

| 字段 | 类型 | 空 | 约束/索引 | 说明 |
|---|---|---|---|---|
| id | uuid | 否 | PK | |
| task_id | uuid | 否 | FK -> `tasks.id` on delete cascade, `index` | |
| workflow_id | uuid | 是 | FK -> `workflows.id` on delete set null, `index` | |
| work_node_id | uuid | 是 | FK -> `work_nodes.id` on delete set null, `index` | |
| type | varchar(32) | 否 | `index` | file/diff/report/bundle/... |
| name | varchar(255) | 否 | - | |
| storage_key | text | 否 | - | 对象存储 key |
| mime_type | varchar(128) | 是 | - | |
| size | bigint | 是 | - | |
| checksum | varchar(64) | 是 | - | |
| metadata | jsonb | 否 | default `'{}'::jsonb` | |
| expires_at | timestamptz | 是 | `index` | |
| created_at | timestamptz | 否 | - | |

## 5. 迁移顺序建议

1. `projects`
2. `workflow_templates` -> `workflow_template_nodes`
3. `agent_tool_configs`
4. `tasks`
5. `workflows`
6. `work_nodes`
7. `agent_executions`
8. `task_logs` -> `artifacts`

## 6. 与当前 backend 的兼容说明（重要）

当前 `backend` 代码里 `user.id` 与 `session.id` 仍是 `int`。你要求“id 字段必须 UUID”后，建议两种方案二选一：

### 方案 A（推荐，渐进式）

- 本文档范围内的**新业务表全部 UUID**（已满足你的要求）。
- `user/session` 先保持现状 `int`，避免一次性打断认证链路。
- 后续单开一次“认证体系 UUID 化”专项迁移。

### 方案 B（一次性）

- 把 `user/session` 也升级为 UUID。
- 同步改动 JWT payload、AuthGuard、SessionService、历史迁移、种子数据。
- 风险高、改动面大，不建议和业务表首批上线绑定。

## 7. 待你确认（确认后我就开始出 Entity+Migration）

1. 你要走方案 A 还是方案 B？
2. `tasks.session_id` 是否保留 `UNIQUE`（按你参考表我已保留）。
3. `workflows` 是否允许一个任务多次执行（我按 `attempt` + `unique(task_id, attempt)` 设计）。
4. `task_logs.id` 你要不要也改成 `bigint` 自增？（当前按你要求用 UUID）
5. `agent_tool_configs.tool_id` 是否需要单独工具主表（如 `agent_tools`）？

