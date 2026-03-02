# brainstorm: 项目仓库存储路径设计

## Goal

在当前“业务线 -> 项目”的模型下，明确项目仓库在本地磁盘的标准存储布局，保证与现有 `.ainative/data/<business_line_id>/skills|mcp` 约定一致，同时兼容任务级 git worktree 运行时、项目配置覆盖能力（`repoLocalPath` / `repoCacheBaseDir` / `worktreeBaseDir`）、以及后续运维排障。

## What I already know

* 用户提出的候选方案：`.ainative/data/{{business_line_id}}/project/{{project_id}}/{{git_name}}`。
* 当前项目创建接口要求 `gitUrl`，并保存到 `projects.gitUrl`（后端 `CreateProjectDto` + `ProjectsService`）。
* 当前运行时已支持两层目录概念：
  - 仓库根（用于 clone/fetch 缓存，`resolveRepositoryRoot`）
  - 任务 worktree（用于每次任务执行隔离，`resolveGitWorktreePath`）
* 当前默认目录是 `tmp/worktrees`（不是 `.ainative/data`），可通过项目配置和环境变量覆盖。
* 业务线本地 Skill/MCP 已固定读取：
  - `.ainative/data/<business_line_id>/skills`
  - `.ainative/data/<business_line_id>/mcp`
* 项目上下文与项目本地 skill/mcp 依赖 `repoLocalPath|contextBaseDir|workspacePath` 来定位项目根目录。

## Assumptions (temporary)

* 项目级仓库存储希望纳入 `.ainative/data` 命名空间，形成业务线内资源一致性。
* 一个项目只需要一个“仓库缓存根”，任务 worktree 为临时/短期目录。
* 项目 `name` 和 git 仓库名可能变化，不适合作为唯一键；`project_id` 稳定可作为主键目录。

## Open Questions

* 暂无阻塞问题（已确认采用推荐目录方案）。

## Requirements (evolving)

* 目录布局需区分“仓库缓存”和“任务 worktree”，避免混放。
* 目录命名主键优先使用 `business_line_id + project_id`，避免重名和 rename 风险。
* 默认路径应与业务线现有 `.ainative/data/<business_line_id>/...` 保持同一命名空间。
* 需保留配置覆盖能力：
  - `repoLocalPath` 指定固定仓库根
  - `repoCacheBaseDir` 指定仓库缓存根目录
  - `worktreeBaseDir` 指定任务 worktree 根目录
* 路径必须可做安全校验（allowedRoot）与清理操作（worktree remove + fs rm）。

## Acceptance Criteria (evolving)

* [ ] 给出一个默认目录规范，能同时容纳 repo cache 与 worktree，并与业务线 skills/mcp 约定一致。
* [ ] 目录规范在项目改名、git 地址变更后不发生路径主键冲突。
* [ ] 目录规范能映射到当前 `TaskRuntimeService` 的 `repoLocalPath/repoCacheBaseDir/worktreeBaseDir` 配置模型。
* [ ] 明确说明 `git_name` 在路径中是“主键”还是“可读别名”。

## Definition of Done (team quality bar)

* 测试 added/updated（如涉及实现变更）
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 本轮不实现完整的迁移脚本（例如从 `tmp/worktrees` 自动迁移历史数据）。
* 本轮不覆盖 git 凭据管理方案（SSH key/token 持久化策略）。
* 本轮不引入容器级隔离，仅讨论目录级布局和约束。

## Technical Approach

推荐默认布局（Approach A）：

* `.ainative/data/<business_line_id>/projects/<project_id>/repo`
  - 项目仓库缓存根（clone/fetch 目标）
* `.ainative/data/<business_line_id>/projects/<project_id>/worktrees/<task_id>`
  - 每次任务执行独立 worktree
* 可选可读别名（非主键）：`meta` 或 `display` 字段记录 git repo 名，不作为目录关键键。

说明：

* 你的原始想法方向是对的（按 business_line + project 分层），但建议把 `git_name` 从“路径主键”降级为“展示信息”。
* 若一定要保留 `git_name` 目录，可作为软链接/附加层，而不是主路径键，防止改仓库名后迁移成本高。

## Research Notes

### What similar tools do

* 常见做法是将“仓库缓存”和“执行工作目录（worktree/temp checkout）”分离管理：
  - 缓存目录稳定、生命周期长
  - worktree 短生命周期、可自动清理

### Constraints from our repo/project

* `TaskRuntimeService` 已区分 repo root 与 worktree path，并支持 allowedRoot 安全检查和清理。
* 业务线已有 `.ainative/data/<business_line_id>/skills|mcp` 约定，扩展到 `projects` 子树成本最低、认知一致性最好。
* 项目侧已有配置项能覆盖路径，无需推翻现有配置模型。

### Feasible approaches here

**Approach A: business-line + project_id 双层固定键（Recommended）**

* How it works:
  - 默认落盘到 `.ainative/data/<business_line_id>/projects/<project_id>/{repo,worktrees}`
  - 通过 configJson 覆盖 repo/worktree 根路径
* Pros:
  - 稳定、避免重名与 rename 问题
  - 与业务线目录体系一致
  - 与现有 runtime 设计天然匹配
* Cons:
  - 人眼可读性稍弱（目录名不是 git 名）

**Approach B: 在路径主键中包含 git_name**

* How it works:
  - `.ainative/data/<business_line_id>/project/<project_id>/<git_name>`
* Pros:
  - 人眼可读性好
* Cons:
  - git 迁移/改名后路径漂移
  - 重复 clone/迁移风险更高
  - 路径规范和当前 runtime 的 repo/worktree 分离不够清晰

**Approach C: 维持当前 tmp/worktrees 默认，仅依赖项目配置覆盖**

* How it works:
  - 保持 `tmp/worktrees` 与 `.repos` 默认策略，按项目手工配置
* Pros:
  - 改动最小
* Cons:
  - 与 `.ainative/data` 体系割裂
  - 多业务线部署时目录治理成本高

## Decision (ADR-lite)

**Context**: 需要在“业务线 -> 项目”模型下定义稳定、可治理、与 runtime 匹配的目录规范。  
**Decision**: 已确认采用 Approach A；`git_name` 不作为主键目录字段，仅作可读元信息。  
**Consequences**: 稳定性和可迁移性更好；若未来需要人类可读目录，可增设别名层但不破坏主路径。

## Implementation Plan (small PRs)

* PR1: 统一默认路径约定
  - 将 runtime 默认 `repoCacheBaseDir/worktreeBaseDir` 对齐到 `.ainative/data/<business_line_id>/projects/<project_id>/...` 体系（通过项目配置生成默认值或服务端计算）。
  - 保持 `repoLocalPath` 覆盖优先级不变。
* PR2: 配置与展示对齐
  - 在项目配置页明确展示“仓库缓存目录”和“worktree 目录”最终解析路径。
  - 文档同步更新（包含运维清理建议）。
* PR3: 兼容与验证
  - 增加/更新单测：路径解析、allowedRoot 校验、cleanup 行为。
  - 验证旧配置兼容（`tmp/worktrees` 或自定义路径不受破坏）。

## Technical Notes

* Inspected files:
  - `backend/src/projects/dto/create-project.dto.ts`
  - `backend/src/projects/projects.service.ts`
  - `backend/src/tasks/task-runtime.service.ts`
  - `backend/src/project-context/project-context.service.ts`
  - `backend/src/utils/local-agent-catalog.ts`
  - `frontend/src/views/projects/detail.vue`
  - `frontend/src/components/business/settings/BusinessLineModal.vue`
  - `docs/ainative-requirement-design.md`
* Relevant existing paths:
  - business-line skills: `.ainative/data/<business_line_id>/skills`
  - business-line mcp: `.ainative/data/<business_line_id>/mcp`
  - runtime default base: `tmp/worktrees`
