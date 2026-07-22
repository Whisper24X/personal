# diting API

更新日期：2026-05-12

本文档描述当前 Fastify 服务端对外暴露的 HTTP API。默认基准地址（Base URL）：

```text
http://localhost:13000/api
```

通用约定：

- 所有请求和响应均为 JSON，除 SSE 端点外。
- 任务相关聚合响应会带 schemaVersion 字段，取值与运行中服务发布的观测模式版本一致。
- 失败响应统一为含 error 字段的 JSON 对象。
- 运行时日志现统一写入仓库根目录 logs/；/api/events、/api/tasks/:id/logs 等接口已改为读取文件日志插件，而不是 execution_logs 数据库表。

## Health

### GET /health

进程存活检查。

示例响应：

```json
{
  "ok": true,
  "status": "alive",
  "schemaVersion": "2026-05-11",
  "service": "diting",
  "timestamp": "2026-05-11T09:00:00.000Z"
}
```

### GET /readiness

服务就绪检查，聚合数据库与插件健康状态。

示例响应：

```json
{
  "ok": true,
  "status": "ready",
  "schemaVersion": "2026-05-11",
  "service": "diting",
  "timestamp": "2026-05-11T09:00:00.000Z",
  "checks": {
    "database": {
      "ok": true,
      "message": "Database connection is ready"
    },
    "plugins": {
      "ok": true,
      "message": "Required plugin kinds are ready",
      "total": 8,
      "healthy": 8,
      "requiredKinds": {
        "environment": true,
        "agent": true,
        "observability-governance": true
      },
      "items": []
    }
  }
}
```

说明：total / healthy 统计 **全部** 注册插件；内置栈当前包含 root-logs、meegle、git-worktree-local、codex、cursor、openspec-product-*、default-quality、default-observability-governance、gitlab 等插件实例。requiredKinds 仅检查 environment、agent、observability-governance 三类是否各自存在 **健康** 插件；Meegle 与 GitLab CLI 不参与 readiness 门禁，但会在 `/api/plugins` 与各自 integration auth 接口暴露健康状态。

## Tasks

### GET /tasks

按条件查询任务。

查询参数（Query）：

- status
- executor

### POST /tasks

创建手工任务。

请求体：

```json
{
  "title": "Fix build",
  "instruction": "Run build and fix errors",
  "repo": "https://example.com/repo.git",
  "branch": "main",
  "priority": "medium",
  "executor": "codex",
  "source": "manual",
  "externalId": "EXT-1",
  "constraints": ["do not force push"],
  "acceptanceCriteria": ["build passes"],
  "metadata": {
    "env": {
      "NODE_ENV": "test"
    }
  }
}
```

说明：

- branch 可选；省略、空字符串或仅空白时，系统会按当前服务进程时区生成 feature/YYYYMMDDHHmmss-<taskId前8位>。

必填字段：

- title
- instruction
- repo

### GET /tasks/:id

查询单个任务详情。

### POST /tasks/:id/validate

把任务推进到 validated。

### POST /tasks/:id/queue

把任务推进到 queued。

### POST /tasks/:id/retry

触发重试，通常用于 failed 或需要再次入队的任务。

### POST /tasks/:id/block

把任务置为 blocked。

请求体：

```json
{
  "reason": "Waiting for dependency owner"
}
```

### POST /tasks/:id/needs-human

把任务置为 needs_human。

自动进入 needs_human 的行为现在受环境变量 DITING_GOAL_ENABLE_NEEDS_HUMAN_LOOP 控制：

- false：自动 Goal Loop 在命中 high_risk / repeated_failure / no_effective_diff 等 stop signal 时继续 repair，并写 goal.stop_reason_continued；达到迭代上限后写 goal.budget_exhausted 并以 failed 结束。
- true：当任务来源插件支持人工回复闭环时，以上 stop signal 会自动转入 needs_human，并通过 integration 回写评论；后续收到用户评论回复后会自动恢复执行链。

请求体：

```json
{
  "reason": "High risk change requires review"
}
```

### POST /tasks/:id/sync-human-reply

手动检查任务来源集成中的人工回复评论。当前 Meegle 产品 Agent 交互要求人工在最新评论前加 `【回复】` 标签；接口会读取最新评论、剥离标签正文、写入任务指令并把 waiting 任务恢复到 ready。

返回体：

```json
{
  "ready": true,
  "recovered": true,
  "externalId": "MEEGLE-123",
  "replyId": "comment-1",
  "summary": "Human reply applied"
}
```

如果没有找到新的合规回复，接口返回 `ready=false`、`recovered=false`，任务保持 waiting。该接口不同于 `sync-human-repair-issue`：前者读取父任务评论中的 `【回复】`，后者读取修复子任务描述中的 `【开发中】`。

### POST /tasks/:id/recover

从 blocked / needs_human / failed 等人工恢复回执行链。

说明：

- needs_human 通常表示等待人工补充信息、审批或评论回复。
- blocked 通常表示自动重试已经停止，需要人工修复环境、依赖、配置或执行条件。

请求体：

```json
{
  "reason": "Dependency fixed"
}
```

### POST /tasks/:id/cancel

取消任务。

## Task Observability

### GET /tasks/:id/executions

查询任务 execution 列表。

### GET /tasks/:id/transitions

查询任务状态流转历史。

### GET /tasks/:id/logs

查询任务 execution logs。

说明：

- 当前返回结构保持兼容，但底层数据源来自 logs/tasks/<task-id>/task.log 等文件日志，而不是数据库 execution_logs 表。

### GET /tasks/:id/observability

查询聚合观测视图。

返回内容包括：

- schemaVersion
- task
- transitions
- executions
- executionLogs
- evalResults
- repairGoal

### GET /tasks/:id/eval-results

查询评测结果列表。

### GET /tasks/:id/repair-goal

查询当前 repair goal。

### GET /traces/:traceId

按 trace 维度聚合查询。

返回内容包括：

- tasks
- transitions
- executions
- executionLogs
- evalResults
- repairGoals

说明：

- executionLogs 字段当前由 logs/traces/<traceId>/trace.log 和 task 级文件日志聚合得到。

## Agents

### GET /agents

查询全部 agent。

### POST /agents/:id/heartbeat

刷新 agent heartbeat。

请求体：

```json
{
  "status": "idle"
}
```

### POST /agents/:id/disable

人工摘除 agent。

### POST /agents/:id/enable

重新启用 agent。

### POST /agents/:id/recover

把 agent 从异常态恢复。

## Plugins

### GET /plugins

查询运行中插件和健康状态。

### GET /plugin-configs

查询插件配置覆盖。

### POST /plugin-configs

更新或插入插件配置。

请求体：

```json
{
  "pluginId": "meegle",
  "kind": "task-integration",
  "enabled": true,
  "priority": 100,
  "config": {
    "mode": "poll"
  }
}
```

## Integrations

### GET /integrations/meegle/health

查看 Meegle integration readiness。

健康规则：

- `DITING_PLUGIN_MEEGLE_MODE=webhook` 时检查 webhook secret 是否配置。
- polling 且配置 tasks file 时视为文件型集成可用。
- polling 且未配置 tasks file 时调用 Meegle CLI；若配置 `MEEGLE_PROJECT_KEY`，执行项目搜索验证 CLI、授权与项目访问，否则执行 `meegle auth status --format json`。

### GET /integrations/meegle/auth/status

查看当前服务进程使用的 Meegle CLI profile 是否已授权。

### POST /integrations/meegle/auth/start

发起 Meegle 设备码授权，返回浏览器授权 URL、device code、client id、轮询间隔与过期时间。

### POST /integrations/meegle/auth/poll

轮询 Meegle 设备码授权状态。请求体需要带上 `auth/start` 返回的 device code、client id、轮询间隔与过期时间。

### POST /integrations/meegle/auth/logout

退出当前 Meegle CLI profile。

### POST /integrations/meegle/webhook

Meegle webhook 任务接入。

请求头：

```text
x-diting-webhook-secret: <secret>
```

请求体：

```json
{
  "task": {
    "id": "MEEGLE-1",
    "title": "Fix build",
    "instruction": "Run build and fix errors",
    "repo": "https://example.com/repo.git",
    "branch": "main",
    "executor": "codex"
  }
}
```

也支持：

```json
{
  "tasks": []
}
```

### GET /integrations/gitlab/auth/status

查看 GitLab CLI（`glab`）是否已对 `DITING_GITLAB_HOST` 授权。服务端执行：

```bash
glab auth status --hostname <DITING_GITLAB_HOST>
```

响应示例：

```json
{
  "status": "authenticated",
  "authenticated": true,
  "host": "gitlab.yc345.tv",
  "message": "GitLab CLI is authenticated"
}
```

### POST /integrations/gitlab/auth/start

发起 GitLab CLI 设备码授权。服务端执行：

```bash
glab auth login --hostname <DITING_GITLAB_HOST> --device
```

响应示例：

```json
{
  "status": "pending",
  "authenticated": false,
  "authorizationUrl": "https://gitlab.yc345.tv/oauth/device",
  "userCode": "ABCD-EFGH",
  "host": "gitlab.yc345.tv",
  "intervalSeconds": 5,
  "message": "Open the authorization URL and enter the GitLab device code"
}
```

### POST /integrations/gitlab/auth/poll

轮询 GitLab CLI 授权状态；实现上复用 `glab auth status --hostname <DITING_GITLAB_HOST>`。授权完成后返回 `authenticated: true`。

### POST /integrations/gitlab/auth/logout

退出当前 GitLab host 的 CLI 授权。服务端执行：

```bash
glab auth logout --hostname <DITING_GITLAB_HOST>
```

## Run Observability

### GET /runs

返回 Run（execution）列表，支持查询参数：

- `taskId`
- `agentId`
- `status`
- `limit`
- `cursor`

响应示例：

```json
[
  {
    "id": "exec-1",
    "taskId": "task-1",
    "agentId": "agent-1",
    "workspace": "/tmp/workspaces/task-1",
    "status": "completed",
    "summary": "Executor completed",
    "executor": "codex",
    "startedAt": "2026-05-11T00:00:00.000Z",
    "endedAt": "2026-05-11T00:05:00.000Z"
  }
]
```

### GET /runs/:id/observability

返回单 Run 的阶段进度、动态步骤、插件参与链和 raw log 元数据。

响应示例：

```json
{
  "schemaVersion": "2026-05-11",
  "run": { "id": "exec-1", "taskId": "task-1", "status": "completed" },
  "stages": [
    { "key": "workspace", "label": "Workspace", "status": "done" },
    { "key": "execute", "label": "Execute", "status": "done" }
  ],
  "steps": [
    {
      "id": "step-1",
      "runId": "exec-1",
      "stage": "execute",
      "status": "done",
      "title": "Executor completed",
      "message": "Executor completed",
      "pluginId": "cursor"
    }
  ],
  "plugins": [
    {
      "pluginId": "cursor",
      "kind": "execution",
      "participationSource": "actual",
      "status": "done",
      "health": "healthy"
    }
  ],
  "rawLogs": {
    "available": true,
    "endpoint": "/api/runs/exec-1/raw-logs",
    "sources": ["stdout", "stderr", "summary", "event"],
    "scope": "run",
    "redacted": true
  }
}
```

### GET /runs/:id/raw-logs

按 Run 读取 stdout、stderr、summary、event、file 原始日志，支持：

- `source`
- `q`（全文搜索）
- `limit`
- `cursor`

响应示例：

```json
{
  "schemaVersion": "2026-05-11",
  "runId": "exec-1",
  "taskId": "task-1",
  "scope": "run",
  "redacted": true,
  "items": [
    {
      "id": "exec-1:stderr:1",
      "source": "stderr",
      "text": "npm test failed",
      "redacted": true
    }
  ],
  "nextCursor": null
}
```

## Dashboard And Debug

### GET /dashboard

返回任务、agent、plugin 聚合统计。

### POST /debug/sync

手工触发 integration sync。

### POST /debug/scheduler

手工触发一次 scheduler dispatch。

## SSE

### GET /events

SSE 事件流端点。

说明：

- SSE 实时事件现在由文件日志插件维护的最近事件快照与订阅流提供。
- 事件仍保持原有 payload shape，但不再依赖内存事件流作为唯一数据源。

事件格式：

```text
event: <eventType>
data: <json>
```

事件 JSON 含：

- id
- schemaVersion
- eventType
- timestamp
- data.correlation
