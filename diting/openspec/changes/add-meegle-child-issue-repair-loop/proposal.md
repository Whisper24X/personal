# 引入 Meegle 父子 issue 修复闭环

## 目标

当飞书项目看板进入 titing 的父 issue 在开发/质量评测阶段出现 bug、测试失败或 quality failed 时，系统 MUST 不再直接重试父任务，而是在父 issue 的开发节点下创建或复用「任务」子任务，等待人工在「子任务描述」中补充修复方案。

## 方案

- 扩展 Meegle task-integration 能力，支持按失败指纹创建或复用父 issue 开发节点下的「任务」子任务。
- 父任务发生 quality failed 时进入 `needs_human`，repair goal 标记为 `needs_human`，并记录子任务 ID、失败指纹、失败摘要和失败检查项。
- 新增任务级 API `POST /api/tasks/:id/sync-human-repair-issue`，由前端控制台按钮显式触发读取子任务描述。
- 仅当子任务描述以 `【开发中】` 开头时，系统才将方案注入 repair goal 并把父任务恢复到 `queued`。
- 恢复后的 execution 使用 `repair_only` 语义，只修复失败检查项和人工方案指向的问题，不重新执行完整父需求。
- Meegle 子 issue 能力不可用或创建失败时 fail closed，父任务保持人工介入状态，不回到自动 repair。

## 影响范围

- `packages/plugin-api`：新增 child repair issue 插件契约。
- `packages/core`：调整 quality failed 到 needs_human 的编排、显式同步命令、repair goal metadata。
- `apps/server`：新增 HTTP 命令端点、Meegle CLI 子任务 adapter、repair-only execution prompt。
- `apps/web`：任务详情操作区新增“检查子任务方案”按钮和反馈。
- OpenSpec 能力：`human-intervention`、`execution-orchestration`、`plugins`、`http-api`。
