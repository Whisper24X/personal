# Codex `exec` 配置设计

本文记录当前项目中 Codex Agent CLI 配置的**实际设计**，以当前实现为准。

适用范围：

- 业务线中的 Codex Agent CLI 配置
- 后端 `AgentRunnerService` 对 Codex 的参数编译
- 前端 Codex 配置编辑弹窗默认值与交互

不包含：

- `vibe-kanban` 的 `app-server` / JSON-RPC 协议式接入
- Claude、Gemini、Cursor、OpenCode 的配置设计
- 工作流节点 prompt 模板设计

## 1. 设计目标

这次设计的核心目标只有两点：

1. 前端可配置字段必须和后端实际生效字段一致
2. Codex 继续走 `codex exec` 路线，不引入额外协议层

因此，当前项目不再保留一批“UI 有字段、运行时却不一定生效”的 Codex 配置项，而是收缩为：

- `codex exec` 的显式参数
- 少量受控高级配置
- 环境变量注入

## 2. 为什么不是 `vibe-kanban` 那套设计

`vibe-kanban` 的 Codex 设计更丰富，但它的运行模型和当前项目不同。

它启动的是：

```text
codex app-server
```

然后通过协议层发送：

- `approval_policy`
- `sandbox`
- `base_instructions`
- `developer_instructions`
- `config`

所以它保留 `ask_for_approval`、`base_instructions`、`developer_instructions`、`sandbox=auto` 等字段是合理的。

当前项目不是这条路线，而是直接执行：

```text
codex exec ...
```

因此当前项目的 Codex 配置必须围绕 `codex exec --help` 的真实参数来建模，而不是照搬 `vibe-kanban` 的协议字段。

## 3. 当前 Codex 配置模型

当前项目中，Codex `configJson` 只保留以下字段：

```ts
type CodexConfig = {
  model?: string | null
  oss?: boolean | null
  local_provider?: string | null
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access' | null
  profile?: string | null
  execution_mode?:
    | 'standard'
    | 'full-auto'
    | 'dangerously-bypass-approvals-and-sandbox'
    | null
  config_overrides?: string[] | null
  env?: Record<string, string> | null
}
```

这些字段分为三类：

### 3.1 显式 CLI 参数

- `model`
- `oss`
- `local_provider`
- `sandbox`
- `profile`
- `execution_mode`

### 3.2 受控高级配置

- `config_overrides`

每一项都必须是：

```text
key=value
```

后端会把它编译成：

```text
-c key=value
```

### 3.3 环境变量

- `env`

用于把额外环境变量注入 Codex 子进程。

### 3.4 Runner 任务与 MCP

`config_overrides` 的每一项都是传给 `codex exec` 的 `-c` 参数，格式为 `key=value` 的**内联配置片段**（与全局/项目 `config.toml` 里 `[mcp_servers]` 表项等价，见 [Codex MCP 文档](https://developers.openai.com/codex/mcp)）。

**推荐架构（任务容器）**：在 **Docker 宿主机**运行 MCP（或监听在宿主机可路由地址），通过 **`Project.configJson.containerRuntime.env`** 把 `http://host.docker.internal:…` 等 URL 注入任务容器（与 Postgres/Redis 连接串同类）。Bridge 模式 Runner 默认会添加 `host.docker.internal` → 宿主机网关（见 [`task-container-execution-boundaries.md`](../../backend/docs/task-container-execution-boundaries.md)）。避免在配置里写死仅容器内可达的 `http://127.0.0.1:…` 去访问宿主机上的 MCP，除非 Runner `networkMode` 为 `host`。

可复制示例（含 `@bytebase/dbhub` HTTP 与 `.codex/config.toml`）：见 [codex-runner-mcp-example.md](./codex-runner-mcp-example.md)。

**可选**：仓库内 `.codex/config.toml` 仍可用于模型与本地路径；若 `.codex` 在 monorepo 子目录，配合 **`runnerWorkingSubdirectory`**。后端仍会对 Agent 工具 raw 里指向 **worktree 内文件**的宿主机绝对路径做 `/workspace/...` 改写（含 `config_overrides` 行内路径），见 [`rewriteRunnerWorktreeAbsolutePaths`](../../backend/src/agent-execution/runner-platform-mcp-augmentation.ts)。

## 4. 默认值

前端新建 Codex 配置时，会自动填入以下默认值：

```text
model = gpt-5.4
execution_mode = dangerously-bypass-approvals-and-sandbox
```

这表示：

- 默认模型是 `gpt-5.4`
- 默认权限是**最高权限**

这里的“最高权限”不是单纯的：

```text
--sandbox danger-full-access
```

而是：

```text
--dangerously-bypass-approvals-and-sandbox
```

也就是同时跳过审批并关闭沙箱。

## 5. 字段到 CLI 的映射

后端会把 Codex 结构化配置编译成固定的 `codex exec` 参数。

基础命令固定为：

```text
codex exec --json --skip-git-repo-check -
```

其中：

- `--json` 由平台强制追加，用于日志和事件流解析
- `--skip-git-repo-check` 由平台强制追加，用于避免工作目录状态异常时直接启动失败
- `-` 表示从 stdin 读取 prompt

### 5.1 普通字段映射

| 配置字段 | CLI 参数 |
| --- | --- |
| `model` | `--model <value>` |
| `oss=true` | `--oss` |
| `local_provider` | `--local-provider <value>` |
| `profile` | `--profile <value>` |
| `config_overrides` | `-c <item>`，每项一组 |

### 5.2 `execution_mode` 映射

#### `standard`

只在该模式下才允许使用 `sandbox`。

例如：

```json
{
  "execution_mode": "standard",
  "sandbox": "workspace-write"
}
```

会编译为：

```text
codex exec --json --skip-git-repo-check --sandbox workspace-write -
```

#### `full-auto`

会编译为：

```text
--full-auto
```

该模式下，单独的 `sandbox` 选择会被忽略。

#### `dangerously-bypass-approvals-and-sandbox`

会编译为：

```text
--dangerously-bypass-approvals-and-sandbox
```

该模式下，单独的 `sandbox` 选择也会被忽略。

## 6. 一个完整示例

配置：

```json
{
  "model": "gpt-5.4",
  "oss": true,
  "local_provider": "ollama",
  "profile": "workspace",
  "execution_mode": "standard",
  "sandbox": "danger-full-access",
  "config_overrides": [
    "model_reasoning_summary=\"concise\"",
    "model_reasoning_effort=\"high\""
  ],
  "env": {
    "OPENAI_API_KEY": "xxx"
  }
}
```

会被编译为：

```text
codex exec \
  --json \
  --skip-git-repo-check \
  --model gpt-5.4 \
  --oss \
  --local-provider ollama \
  --profile workspace \
  --sandbox danger-full-access \
  -c model_reasoning_summary="concise" \
  -c model_reasoning_effort="high" \
  -
```

并把 `OPENAI_API_KEY=xxx` 注入子进程环境变量。

## 7. 为什么删除了旧字段

以下字段不再作为 Codex 的独立配置字段保留：

- `append_prompt`
- `ask_for_approval`
- `sandbox=auto`
- `model_reasoning_effort`
- `model_reasoning_summary`
- `model_reasoning_summary_format`
- `base_instructions`
- `include_apply_patch_tool`
- `model_provider`
- `compact_prompt`
- `developer_instructions`
- `base_command_override`
- `additional_params`

原因分为三类。

### 7.1 与 `codex exec` 显式参数不一致

例如：

- `ask_for_approval`
- `sandbox=auto`

这些字段在当前项目的 `codex exec` 路线中没有稳定的一对一 CLI 映射。

### 7.2 当前项目后端并未真正接线

例如：

- `base_instructions`
- `developer_instructions`
- `model_provider`

这些字段在协议式接入里有意义，但在当前项目原来的 `exec` 路线里并没有完整映射链路。

### 7.3 会破坏平台控制边界

例如：

- `additional_params`
- `base_command_override`

这类字段会让配置退化成“手写命令参数”，使平台难以保证：

- 参数稳定性
- 安全边界
- 默认值行为
- 未来升级兼容性

因此当前设计只保留受控的：

- `config_overrides`
- `env`

## 8. 前端交互约束

Codex 配置弹窗中有以下约束：

- 默认 `execution_mode` 就是最高权限模式
- 当 `execution_mode !== standard` 时，`sandbox` 会被禁用
- 保存时，非 `standard` 模式下的 `sandbox` 会被清空
- `config_overrides` 必须是逐行 `key=value`

危险模式会展示明确提示，提醒用户当前配置会跳过审批并关闭沙箱。

## 9. 实现落点

当前实现主要位于：

- `backend/src/agent-execution/runner-agent-execution.service.ts`
- `backend/src/tasks/agent-runner.service.spec.ts`
- `frontend/src/components/business/settings/modals/AgentToolConfigModal.vue`
- `frontend/src/components/business/settings/__tests__/AgentToolConfigModal.spec.ts`

## 10. 后续扩展约束

如果将来要继续扩展 Codex 配置，优先顺序应固定为：

1. 先确认 `codex exec --help` 是否已有显式参数
2. 若不是显式参数，再判断是否适合通过 `config_overrides` 暴露
3. 只有在当前项目改成协议式接入时，才考虑重新引入 `base_instructions`、`developer_instructions`、`ask_for_approval` 这一类字段

换句话说：

- 只要当前项目还走 `codex exec`
- 就不要再回到“UI 字段很多，但后端只透传一小部分”的设计
