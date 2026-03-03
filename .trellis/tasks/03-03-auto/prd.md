# 项目级 Git 功能页面

## Goal

在前端新增项目级 Git 页面（`/git`），支持查看分支与拉取主分支最新代码，提供无需命令行的基础仓库运维能力。

## Requirements

- 新增路由页面：`/git`。
- 支持查看当前仓库分支信息（当前分支、本地分支、远端分支）。
- 支持触发拉取主分支（`main`）最新代码。
- 操作失败时在页面提示明确错误原因。

## Acceptance Criteria

- [x] 访问 `http://127.0.0.1:5173/git` 可打开 Git 功能页。
- [x] 点击“拉取主分支最新代码”会调用后端接口并返回结果。
- [x] 页面可展示当前分支、本地分支、远端分支。
- [x] 前后端构建/类型检查通过（backend build + frontend type-check）。

## Definition of Done (team quality bar)

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes
- Rollout/rollback considered if risky

## Technical Approach

- 后端新增 `GitModule`，提供：
  - `GET /api/v1/git/branches`：读取当前仓库分支信息
  - `POST /api/v1/git/pull-main`：执行 `git pull --ff-only origin main`
- 前端新增：
  - `frontend/src/api/git.ts`
  - `frontend/src/types/api/git.ts`
  - `frontend/src/views/git/index.vue`
- 路由注册：`frontend/src/router/routes/system.ts` 增加 `/git`。

## Decision (ADR-lite)

- **Context**: 需求只要求“项目级页面”查看分支与拉取主分支，未要求多项目切换。
- **Decision**: MVP 作用于当前服务工作仓库（workspace root），不引入项目选择器。
- **Consequences**:
  - 优点：实现简单、交付快。
  - 风险：若未来要支持“按业务线/项目操作仓库”，需要扩展 API 入参与权限模型。

## Out of Scope

- 多仓库选择器
- 分支创建/删除/切换
- 冲突解决 UI

## Technical Notes

- 前端按 Vue 3 Composition API + `<script setup lang="ts">` 实现。
- 后端在执行 pull 前校验当前分支为 `main`，防止误更新非主分支工作区。
