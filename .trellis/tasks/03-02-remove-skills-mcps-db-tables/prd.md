# brainstorm: remove skills/mcps db tables

## Goal

评估并决定：在当前 Skill/MCP 已主要通过本地文件查询的情况下，是否应移除数据库中的 `skills` 与 `mcps` 表，以及对应后端/前端功能；目标是在减少冗余维护成本的同时，不破坏任务执行链路与现有工作流兼容性。

## What I already know

- 用户提出：当前 skill/mcp 主要通过本地文件读取，希望评估是否可去掉数据库表与相关功能。
- 后端仍存在完整的数据库 CRUD 模块：`/v1/skills` 与 `/v1/mcps`（含 create/list/detail/update/delete）。
- `SkillsService`/`McpsService` 在 `projectId` 存在时会走本地文件读取；否则仍走数据库 repository。
- `TasksService` 运行 `skill/mcp` 节点时，当前仍通过 `SkillRepository`/`McpRepository` 解析并校验 `enabled` 状态。
- `BusinessLinesService` 已提供 `local-skills` / `local-mcps` 接口，数据来自 `.ainative/data/<businessLineId>/(skills|mcp)`。
- 前端 `/skills` 与 `/mcp` 页面目前只按 `projectId` 读取并展示“项目本地配置”。
- 代码中仍保留 `TaskNodeType.skill/mcp` 与 `WorkflowNodeType.skill/mcp`，历史模板/任务理论上仍可包含该节点类型。
- 数据库 migration 已创建 `skills`、`mcps` 表及注释。

## Assumptions (temporary)

- 当前线上/现网仍可能存在依赖 DB skill/mcp 目录的历史数据或任务模板。
- 如果直接删表但未替换 `TasksService` 的解析逻辑，`skill/mcp` 节点执行会失败。
- 全量移除应包含 API、模块注入、权限点、前端菜单/路由与测试调整。

## Open Questions

- MVP 目标是：
  - 仅停止新功能使用 DB（保留兼容读取），还是
  - 完全删除 DB 表与 API（包含历史兼容迁移）？

## Requirements (evolving)

- 明确 skills/mcps DB 表在“运行时任务执行、配置管理、历史兼容”中的真实职责。
- 给出至少 2 个可落地方案，并比较改动范围、回归风险、实施成本。
- 产出建议的迁移顺序（避免一次性硬切造成中断）。

## Acceptance Criteria (evolving)

- [ ] 明确列出当前仍依赖 `skills/mcps` 数据库表的代码路径。
- [ ] 给出 2-3 个方案并标注推荐方案。
- [ ] 明确推荐方案下的 MVP 范围与 out-of-scope。
- [ ] 明确若执行“删表”需要同步删除或迁移的功能清单。

## Definition of Done (team quality bar)

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes
- Rollout/rollback considered if risky

## Out of Scope (explicit)

- 直接在本轮讨论中实施大规模代码删除或数据库结构变更。
- 未确认兼容策略前直接下线 `skill/mcp` 节点执行能力。

## Technical Notes

- 关键文件：
  - `backend/src/skills/*`
  - `backend/src/mcps/*`
  - `backend/src/tasks/tasks.service.ts`
  - `backend/src/business-lines/business-lines.service.ts`
  - `backend/src/utils/local-agent-catalog.ts`
  - `frontend/src/views/skills/index.vue`
  - `frontend/src/views/mcp/index.vue`
  - `frontend/src/router/routes/system.ts`
  - `backend/src/database/migrations/1771002200000-CreateSkillsAndMcps.ts`
- 当前观察：项目与业务线 UI 已明显转向“本地文件目录”，但任务执行链路仍保留 DB 目录依赖。

## Research Notes

### What similar tools do

- 模式 1（Registry-first）：保留中心注册表（DB），运行时与 UI 均以注册表为准，本地配置作为导入源。
- 模式 2（Local-first）：运行时直接读取本地配置文件，DB 仅保留审计/缓存，或完全不保留。
- 模式 3（Hybrid migration）：先把运行时解析改为“本地优先 + DB 回退”，完成观测期后再下线 DB。

### Constraints from our repo/project

- `TasksService` 当前解析 `skill/mcp` 节点必须依赖 `SkillRepository/McpRepository`，这是删表最大阻塞。
- `skills/mcps` 模块被 `AppModule` 与 `TasksModule` 显式引入，直接删除会导致 DI 和路由断裂。
- 前端 `/skills`、`/mcp` 页面已转为项目本地视图，但菜单权限与路由仍保留旧语义。
- 数据库层面 `skills/mcps` 当前未发现被其他表外键依赖，schema 删除相对独立。

### Feasible approaches here

**Approach A: Keep DB now (No destructive change)**  

- How it works:
  - 保留 `skills/mcps` 表与模块，仅继续推动 UI/服务走本地读取。
- Pros:
  - 风险最低，不影响历史任务与模板。
  - 无需迁移计划，可快速稳定。
- Cons:
  - 保留冗余代码与表结构，长期维护成本高。
  - 认知负担仍在（本地与DB双轨并存）。

**Approach B: Soft-deprecate DB (Recommended)**  

- How it works:
  - 第一步：`TasksService` 改为本地目录解析（可保留 DB 回退），并增加观测日志。
  - 第二步：下线 `/skills` `/mcps` 的写接口与前端入口，仅保留只读或兼容路径。
  - 第三步：确认无回归后再删表与模块。
- Pros:
  - 可以逐步验证，避免一次性硬切。
  - 最终可达成“无 skills/mcps 表”的目标。
- Cons:
  - 迁移周期更长，需要阶段性双轨兼容。
  - 需要额外回归测试与观察窗口。

**Approach C: Hard-remove DB now**

- How it works:
  - 一次性删除 `skills/mcps` 表、模块、API，并同步改造 `TasksService` 为纯本地解析。
- Pros:
  - 结构最干净，立即去冗余。
- Cons:
  - 回归风险最高，容易打断历史模板/任务执行。
  - 变更面大（后端模块、前端路由权限、测试、迁移脚本需同步落地）。
