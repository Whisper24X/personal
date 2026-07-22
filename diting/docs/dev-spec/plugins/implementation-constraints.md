# 插件实现约束（一页清单）

本文从 [`diting-plugin-development.md`](../../architecture/diting-plugin-development.md) 提炼实现侧约束。细则、示例与测试建议仍以该文档及 [`openspec/specs/plugins/spec.md`](../../../openspec/specs/plugins/spec.md) 为准。

## 通用字段

每类插件至少具备：

- `id` — 全局稳定，与插件配置表 `plugin_id` 对应
- `kind` — `task-integration` | `execution` | `environment` | `quality` | `observability-governance` | `log`
- `priority` — 默认可被数据库覆盖
- `capabilities` — 执行器/环境选型标签
- `health` — 健康检查

可选 `init`：宿主注入与该 `id` 匹配的插件配置行。

## 运行时选择（PluginRuntime）

- 按插件配置 `enabled` 过滤（无配置行视为启用）
- 环境、质量、日志等同 kind 按有效优先级降序取**第一个**
- 执行器按任务 `executor` 与 `capabilities` 匹配并考虑优先级
- **必须**存在至少一个可用 **log** 插件（日志与 SSE 数据源）
- readiness 聚合 environment、execution、observability-governance 的健康；log/quality/task-integration 不参与就绪门禁，但缺失会破坏业务链路

## 各 kind 最小约束

### task-integration

- 拉取外部任务，映射为本域模型，回写执行结果
- 建议：拉取列表、上报结果、健康检查
- 外部任务用 `source` + `externalId` 唯一标识
- **不得**在插件内自行推进任务状态机

### execution

- 调用真实 CLI 或远端执行单元，返回统一结构
- 建议区分错误/超时类别，会话标识一致，可会话续跑
- stdout/stderr 宜经治理脱敏；工作目录须在任务已准备工作区内

### environment

- 克隆/更新仓库、准备工作区、注入环境变量、按策略清理
- 准备接口返回：工作区路径、仓库路径、分支、缓存路径、产物路径、环境变量映射

### quality

- 串联自动化检查，输出检查项、结构化报告、风险等级
- 脚本缺失时**明确标记跳过**，不可用模糊结论影响 Goal Loop

### observability-governance

- 命令前策略、命令后清理、评测后策略
- 阻断须给出可读原因；脱敏不破坏结构化数据基本可读性

### log

- 结构化日志写入仓库根 `logs/` 树，支持 SSE 与按任务/trace 查询
- 支持追加、订阅、快照；执行器控制台输出归入任务子目录

## 外置插件（createPlugin）

| kind | 环境变量 |
| --- | --- |
| task-integration | `DITING_PLUGIN_TASK_INTEGRATION_PACKAGE` |
| execution | `DITING_PLUGIN_EXECUTION_PACKAGE` |
| environment | `DITING_PLUGIN_ENVIRONMENT_PACKAGE` |
| quality | `DITING_PLUGIN_QUALITY_PACKAGE` |
| observability-governance | `DITING_PLUGIN_OBSERVABILITY_GOVERNANCE_PACKAGE` |
| log | `DITING_PLUGIN_LOG_PACKAGE` |

- 模块须导出 `createPlugin`（命名导出、默认函数或默认对象上的字段）
- 工厂入参：当前配置快照 + 期望 `kind`；返回对象 `kind` 须一致，字段与契约方法齐全
- **execution 外置**：内置 Codex 与 Cursor **同时移除**，仅剩外置单个 execution；常在 `capabilities` 内同时声明两者并在 `execute` 内分支

### HTTP 路由扩展（task-integration）

Webhook 等场景可在满足运行时插件形状的实现上额外提供 `registerRoutes`，挂到 Fastify。

## 设计边界（禁止）

- 除宿主约定的路由扩展外，业务逻辑与 HTTP 传输解耦
- **不得**绕过服务层直接改写 SQLite
- **不得**绕过服务层自建任务状态机
- 幂等/重试语义以 `source` + `externalId` 及服务层迁移为准
- 业务可读日志集中于 log 插件落盘，不在其他插件自建散落日志根
