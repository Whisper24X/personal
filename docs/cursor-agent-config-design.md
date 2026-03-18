# Cursor Agent 配置设计

本文记录当前项目中 Cursor Agent CLI 配置的**实际设计**，以当前实现为准。

适用范围：

- 业务线中的 Cursor Agent CLI 配置
- 后端 `AgentRunnerService` 对 `agent` CLI 参数的编译
- 前端 Cursor Agent 配置编辑弹窗默认值与交互

不包含：

- Codex、Claude、Gemini、OpenCode 的配置设计
- 工作流 prompt 模板设计
- Cursor IDE 内部配置文件语义

## 1. 设计目标

Cursor Agent 的配置改造目标与 Codex / Claude 一致：

1. 前端可配字段必须和后端实际生效字段一致
2. 当前项目继续走 `agent -p` 非交互执行路线
3. 不再保留自由拼参字段

因此，当前项目不再继续保留 `base_command_override`、`additional_params` 这类会破坏平台控制边界的字段，而是围绕 `agent --help` 中真实存在的参数建模。

## 2. 当前 Cursor Agent 配置模型

当前项目中，Cursor Agent `configJson` 只保留以下字段：

```ts
type CursorAgentConfig = {
  api_key?: string | null
  model?: string | null
  headers?: string[] | null
  trust?: boolean | null
  force?: boolean | null
  sandbox?: 'enabled' | 'disabled' | null
  approve_mcps?: boolean | null
  env?: Record<string, string> | null
}
```

这些字段分为三类：

### 2.1 显式 CLI 参数

- `model`
- `headers`
- `trust`
- `force`
- `sandbox`
- `approve_mcps`

### 2.2 环境变量

- `api_key`
- `env`

其中：

- `api_key` 会被映射成 `CURSOR_API_KEY`
- `env` 用于注入额外环境变量

### 2.3 运行期 session 续写

续写不再由业务线配置声明，而是继续由任务节点运行期的 session id 驱动。

也就是说：

- 节点有 `agentCliSessionId` 时，平台会追加 `--resume`
- 业务线配置里不再保留 `resume`

## 3. 默认值

前端新建 Cursor Agent 配置时，会自动填入：

```text
trust = true
force = true
```

这表示 Cursor Agent 默认采用当前项目中的最高权限执行策略，对应真实 CLI 参数：

```text
--trust
--force
```

这里不使用 `--yolo`，因为它只是 `--force` 的别名，保留 `force` 更直接。

## 4. 字段到 CLI 的映射

后端会把 Cursor Agent 结构化配置编译成固定的 `agent -p` 参数。

基础命令固定为：

```text
agent -p --output-format stream-json
```

其中：

- `-p` 表示非交互打印模式
- `--output-format stream-json` 用于平台解析流式输出

### 4.1 普通字段映射

| 配置字段 | CLI 参数 |
| --- | --- |
| `model` | `--model <value>` |
| `headers` | `--header <item>`，每项一组 |
| `trust=true` | `--trust` |
| `force=true` | `--force` |
| `sandbox` | `--sandbox <value>` |
| `approve_mcps=true` | `--approve-mcps` |

### 4.2 一个完整示例

配置：

```json
{
  "api_key": "crsr_xxx",
  "model": "sonnet-4",
  "headers": ["X-Team: ainative", "X-Trace-Id: 123"],
  "trust": true,
  "force": true,
  "sandbox": "disabled",
  "approve_mcps": true,
  "env": {
    "HTTP_PROXY": "http://127.0.0.1:7890"
  }
}
```

会被编译为：

```text
agent -p \
  --output-format stream-json \
  --model sonnet-4 \
  --header "X-Team: ainative" \
  --header "X-Trace-Id: 123" \
  --trust \
  --force \
  --sandbox disabled \
  --approve-mcps
```

并把：

- `CURSOR_API_KEY=crsr_xxx`
- `HTTP_PROXY=http://127.0.0.1:7890`

注入子进程环境变量。

## 5. 为什么删除了旧字段

以下字段不再作为 Cursor Agent 的独立配置字段保留：

- `append_prompt`
- `base_command_override`
- `additional_params`
- `resume`

原因分为三类。

### 5.1 与当前项目运行模型不匹配

例如：

- `append_prompt`
- `resume`

这类字段本质上属于 prompt 编排层或运行期 session 层，而不是静态业务线默认配置。

### 5.2 会破坏平台控制边界

例如：

- `base_command_override`
- `additional_params`

这类字段会把结构化配置退化成“任意拼命令参数”，不利于平台维护默认值、安全边界和升级兼容性。

### 5.3 当前项目不暴露会改变执行语义的参数

例如以下 CLI 参数当前也不进入业务线配置模型：

- `--cloud`
- `--mode`
- `--plan`
- `--workspace`
- `--worktree`

因为这些参数会改变平台执行语义，不适合作为普通业务线默认参数暴露。

## 6. 前端交互约束

Cursor Agent 配置弹窗中有以下约束：

- 新建配置时默认启用 `trust` 和 `force`
- `headers` 使用多行输入，每行一个 `Name: Value`
- 高权限模式会展示明确警告文案
- 不再展示 `base_command_override` 和 `additional_params`

## 7. 实现落点

当前实现主要位于：

- `backend/src/tasks/agent-runner.service.ts`
- `backend/src/tasks/agent-runner.service.spec.ts`
- `frontend/src/components/business/settings/modals/AgentToolConfigModal.vue`
- `frontend/src/components/business/settings/__tests__/AgentToolConfigModal.spec.ts`

## 8. 后续扩展约束

如果后续继续扩展 Cursor Agent 配置，优先顺序固定为：

1. 先确认 `agent --help` 是否已有显式参数
2. 能用真实 CLI 参数表达的，就不要再引入平台自定义字段
3. 只有当平台未来引入新的 Cursor 协议层时，才重新讨论更高层的 prompt / session / workspace 设计
