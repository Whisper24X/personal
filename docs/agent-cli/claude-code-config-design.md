# Claude Code 配置设计

本文记录当前项目中 Claude Code Agent CLI 配置的**实际设计**，以当前实现为准。

适用范围：

- 业务线中的 Claude Code Agent CLI 配置
- 后端 `AgentRunnerService` 对 Claude CLI 参数的编译
- 前端 Claude Code 配置编辑弹窗默认值与交互

不包含：

- 非 `claude -p` 的 Claude 接入方式
- 其它 CLI 工具的配置设计
- 工作流 prompt 模板设计

## 1. 设计目标

Claude Code 的配置改造目标与 Codex 一致：

1. 前端可配字段必须和后端实际生效字段一致
2. 当前项目继续走 `claude -p` 非交互执行路线
3. 默认权限直接落到最高权限模式

因此，当前项目不再保留一批历史表单字段，而是围绕 `claude --help` 中真实存在的参数建模。

## 2. 当前 Claude Code 配置模型

当前项目中，Claude Code `configJson` 只保留以下字段：

```ts
type ClaudeCodeConfig = {
  model?: string | null
  effort?: 'low' | 'medium' | 'high' | 'max' | null
  permission_mode?:
    | 'acceptEdits'
    | 'bypassPermissions'
    | 'default'
    | 'dontAsk'
    | 'plan'
    | 'auto'
    | null
  dangerously_skip_permissions?: boolean | null
  allowed_tools?: string[] | null
  disallowed_tools?: string[] | null
  settings?: string | null
  mcp_config?: string[] | null
  env?: Record<string, string> | null
}
```

这些字段分为三类：

### 2.1 显式 CLI 参数

- `model`
- `effort`
- `permission_mode`
- `dangerously_skip_permissions`
- `allowed_tools`
- `disallowed_tools`
- `settings`
- `mcp_config`

### 2.2 环境变量

- `env`

用于给 Claude Code 子进程注入额外环境变量。

### 2.3 运行期 session 续写

续写不再由业务线配置声明，而是继续由任务节点运行期的 session id 驱动。

也就是说：

- 节点有 `agentCliSessionId` 时，平台会追加 `--resume`
- 业务线配置里不再保留 `resume`

## 3. 默认值

前端新建 Claude Code 配置时，会自动填入：

```text
dangerously_skip_permissions = true
```

这表示 Claude Code 默认以最高权限模式执行，对应真实 CLI 参数：

```text
--dangerously-skip-permissions
```

这里不使用：

```text
--permission-mode bypassPermissions
```

作为默认最高权限映射，而是直接采用更明确的危险参数。

## 4. 字段到 CLI 的映射

后端会把 Claude Code 结构化配置编译成固定的 `claude -p` 参数。

基础命令固定为：

```text
claude -p --output-format stream-json --verbose
```

其中：

- `-p` 表示非交互打印模式
- `--output-format stream-json` 用于平台解析日志流
- `--verbose` 保持现有平台日志行为

### 4.1 普通字段映射

| 配置字段 | CLI 参数 |
| --- | --- |
| `model` | `--model <value>` |
| `effort` | `--effort <value>` |
| `permission_mode` | `--permission-mode <value>` |
| `dangerously_skip_permissions=true` | `--dangerously-skip-permissions` |
| `allowed_tools` | `--allowed-tools <...>` |
| `disallowed_tools` | `--disallowed-tools <...>` |
| `settings` | `--settings <value>` |
| `mcp_config` | `--mcp-config <...>` |

### 4.2 权限字段约束

当：

```text
dangerously_skip_permissions = true
```

时：

- 会编译为 `--dangerously-skip-permissions`
- 单独的 `permission_mode` 会被忽略

原因是当前项目把这视为一个更高优先级的明确危险模式，而不是同时叠加两套权限表达。

### 4.3 Runner 与 MCP

当任务的 `executionPlane` 为 `runner` 时，**`mcp_config` 所列 JSON 文件应以仓库内路径为准**（例如 `.cursor/mcp.json`），经 git 同步进入 worktree。若 Agent 工具配置里仍使用**宿主机 worktree 的绝对路径**，[`AgentExecutionConfigResolverService`](../../backend/src/agent-execution/agent-execution-config-resolver.service.ts) 会将其重写为容器内 `/workspace/...`（见 [`rewriteRunnerWorktreeAbsolutePaths`](../../backend/src/agent-execution/runner-platform-mcp-augmentation.ts)）。

**`allowed_tools` 白名单**仅反映工具配置 raw 中的列表；若需放行 MCP 工具，请在配置中显式加入 `mcp__...` 形式项（见 Claude Code 权限文档），或避免在非空 `allowed_tools` 下列出过窄列表导致 MCP 被挡在门外。详见 [`task-container-execution-boundaries.md`](../../backend/docs/task-container-execution-boundaries.md)。

**任务详情聊天 UI** 里模型可见的工具列表与 **Runner 内 Claude 子进程** 不是同一套能力；即使容器内 MCP 已加载，聊天侧也不会自动出现 `mcp__...` 工具名。验证 Runner 内 MCP 请看日志与 CLI 输出；若聊天侧也要可调 MCP，属产品会话网关范围（见 boundaries 文档 **Task detail UI chat vs container Agent CLI MCP**）。

## 5. 一个完整示例

配置：

```json
{
  "model": "claude-sonnet-4-6",
  "effort": "max",
  "permission_mode": "plan",
  "dangerously_skip_permissions": false,
  "allowed_tools": ["Read", "Edit"],
  "disallowed_tools": ["Bash(rm:*)"],
  "settings": "{\"theme\":\"dark\"}",
  "mcp_config": ["/tmp/mcp-a.json", "/tmp/mcp-b.json"],
  "env": {
    "ANTHROPIC_API_KEY": "xxx"
  }
}
```

会被编译为：

```text
claude -p \
  --output-format stream-json \
  --verbose \
  --model claude-sonnet-4-6 \
  --effort max \
  --permission-mode plan \
  --allowed-tools Read Edit \
  --disallowed-tools Bash(rm:*) \
  --settings '{"theme":"dark"}' \
  --mcp-config /tmp/mcp-a.json /tmp/mcp-b.json
```

并把 `ANTHROPIC_API_KEY=xxx` 注入子进程环境变量。

## 6. 为什么删除了旧字段

以下字段不再作为 Claude Code 的独立配置字段保留：

- `append_prompt`
- `claude_code_router`
- `plan`
- `approvals`
- `disable_api_key`
- `base_command_override`
- `additional_params`
- `resume`

原因分为三类。

### 6.1 与真实 CLI 参数不一致

例如：

- `claude_code_router`
- `approvals`

这些字段不属于当前 `claude --help` 中稳定可用的一对一参数。

### 6.2 当前项目没有明确平台语义

例如：

- `append_prompt`
- `plan`

如果平台没有专门的 prompt 编排层或独立运行模式映射，保留这些字段只会制造“UI 有、实际不一定生效”的假能力。

### 6.3 会破坏平台控制边界

例如：

- `additional_params`
- `base_command_override`

这类字段会把结构化配置退化成“任意拼命令参数”，不利于平台维护默认值、安全边界和升级兼容性。

### 6.4 续写不应作为静态配置

`resume` 本质上是运行期 session 能力，不适合继续作为业务线默认配置。

当前设计中：

- 静态配置只描述“怎么启动 Claude”
- 续写由节点已有的 session id 驱动

## 7. 前端交互约束

Claude Code 配置弹窗中有以下约束：

- 新建配置时默认启用 `dangerously_skip_permissions`
- 当危险权限开启时，`permission_mode` 会被禁用
- 保存时，危险权限开启状态下的 `permission_mode` 会被清空
- 危险模式会展示明确警告文案

## 8. 实现落点

当前实现主要位于：

- `backend/src/agent-execution/runner-agent-execution.service.ts`
- `backend/src/tasks/agent-runner.service.spec.ts`
- `frontend/src/components/business/settings/modals/AgentToolConfigModal.vue`
- `frontend/src/components/business/settings/__tests__/AgentToolConfigModal.spec.ts`

## 9. 后续扩展约束

如果后续要继续扩展 Claude Code 配置，优先顺序固定为：

1. 先确认 `claude --help` 是否已有显式参数
2. 能用真实 CLI 参数表达的，就不要再引入平台自定义字段
3. 只有在当前项目未来引入新的 Claude 协议层时，才重新讨论更高层的 session / router / prompt 设计

换句话说：

- 只要当前项目还走 `claude -p`
- 就不要再回到“前端字段很多，后端只透传一部分”的设计
