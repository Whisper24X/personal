# 本地 MCP 探测（Local MCP Probe）

使用 `@modelcontextprotocol/sdk` 的 `Client` 连接 MCP Server（stdio / SSE / HTTP），执行 `listTools` 并统计工具数量。探测时子进程/请求所用的 **环境变量** 与真实控制面执行 Agent CLI 时一致，由 `AgentCliSmokeTestService.buildProbeEnvironmentForAgentToolConfig` 根据所选业务线 Agent 工具配置生成。

**与 Runner 任务的区别**：探测在**宿主机/控制面**进程内执行；任务节点中的 Agent 在 **Docker runner** 内通过 `docker exec` 运行，**MCP 以任务 worktree 内已提交的配置为准**（无单独业务线 MCP 目录挂载）；路径类字段在解析时可能从宿主机 worktree 绝对路径改写为容器 `/workspace/...`（见 `backend/docs/task-container-execution-boundaries.md`）。探测成功不保证 runner 内 stdio/网络环境完全一致。

### 任务 Runner 与「会话 MCP」对照

| 维度 | 本地 MCP 探测（本文） | 任务详情里的容器 Agent（Runner） |
|------|----------------------|-----------------------------------|
| 进程位置 | Nest 宿主机 / 控制面 | 任务容器内 `docker exec` → 各 CLI |
| MCP 配置来源 | 项目本地 MCP 文件 + 所选 Agent 工具配置（用于环境对齐） | **推荐**：在 **Docker 宿主机**跑 MCP（stdio 转监听或独立 HTTP/SSE），通过 **`containerRuntime.env` 注入 URL**（与 Postgres/Redis 同类映射）；可选 worktree 内 `.codex` 仅当文件与 cwd 在挂载内可用 |
| 与「聊天里 list_mcp_resources」的关系 | **无关** | **无关**；任务内以 CLI + 可达 URL 为准 |

### 任务详情聊天里「没有 list_pages」说明什么

- **任务详情里的模型**所看到的工具列表，由 **产品聊天宿主**在会话建立时下发，**不会**因为 Runner 里 Codex 已加载 chrome-devtools MCP 就自动出现 `list_pages` 等同名工具。
- **验证 Runner 内 MCP 是否生效**：看 **Runner 日志**与 **CLI 的 JSON 输出**，不要以任务页聊天侧是否列出工具为准（详见 `backend/docs/task-container-execution-boundaries.md` 中 **Task detail UI chat vs container Agent CLI MCP**）。
- **若必须让任务聊天也能调 MCP**：属于 **会话网关 / 前端** 的产品需求（桥接或透传），本仓库 Runner 配置无法单独实现。

排查「任务里 MCP 不生效」时：确认 **bridge** 下 `host.docker.internal` 是否启用（默认注入，见 `backend/docs/task-container-execution-boundaries.md`）、**MCP 是否监听在宿主机可访问地址**、以及 Agent 配置里的 URL 是否仍写成容器内 `127.0.0.1`。

---

## 目标

- 针对**项目维度**解析出的本地 MCP 条目（名称、`sourcePath`、服务端配置），验证能否完成 MCP 握手并 **`listTools`**。
- **stdio**：子进程环境 = 上述 Agent 环境 + MCP 配置中的 `env`。
- **远程 URL**（`url` 存在）：按 `type === 'sse'` 走 SSE，否则走 Streamable HTTP；支持自定义 `headers`。

## 探测流程图

```mermaid
flowchart TD
  A["POST /mcps/project-local/test"] --> B["assertCanAccessProject"]
  B --> C["assertBusinessLineCapability: businessLine.agentCli.read"]
  C --> D["getProjectLocalMcpConfig(name, sourcePath)"]
  D --> E["getAgentToolConfigForBusinessLine(agentToolConfigId)"]
  E --> F["probeWithResolvedLocal"]
  F --> G["解析 Agent configJson"]
  G --> H["buildProbeEnvironmentForAgentToolConfig"]
  H --> I["sanitize + collectAgentMcpWarnings"]
  I --> J["classifyMcpServerConfig"]
  J --> K{"配置形态"}
  K -->|无 url 且无 command| L["400 占位条目不可探测"]
  K -->|有 url| M{"type 为 sse?"}
  M -->|是| N["SSEClientTransport"]
  M -->|否| O["StreamableHTTPClientTransport"]
  K -->|stdio: command| P["StdioClientTransport，env 合并 agentEnv 与 MCP"]
  N --> Q["MCP Client.connect"]
  O --> Q
  P --> Q
  Q --> R["listTools"]
  R --> S["withTimeout 包裹整段连接与列举"]
  S --> T{"成功?"}
  T -->|是| U["ok: true，toolsCount，可选 warnings"]
  T -->|超时| V["errorCode: TIMEOUT"]
  T -->|其它异常| W["errorCode: PROBE_FAILED，可选 stderrPreview"]
  U --> X["返回 LocalMcpProbeResultDto"]
  V --> X
  W --> X
  L --> Y["抛出 BadRequestException"]
```

## 核心实现

| 项目 | 说明 |
|------|------|
| 服务类 | `backend/src/business-lines/local-mcp-probe.service.ts`（`LocalMcpProbeService`） |
| SDK | `@modelcontextprotocol/sdk`：`Client` + `StdioClientTransport` / `SSEClientTransport` / `StreamableHTTPClientTransport` |
| 环境对齐 | `AgentCliSmokeTestService.buildProbeEnvironmentForAgentToolConfig({ toolId, configJson })` |
| 超时 | 默认与 Agent CLI 嗅探共用同一套上限；优先读 `AINATIVE_LOCAL_MCP_PROBE_TIMEOUT_MS`，未设置则回落到 `AINATIVE_AGENT_CLI_SMOKE_TEST_TIMEOUT_MS` 的解析结果（见 `resolveLocalMcpProbeTimeoutMs`） |

## 配置分类（`classifyMcpServerConfig`）

- 有 **`url`**：`type` 为 `sse` → `transport: sse`；否则 → `transport: http`；均可带 `headers`。
- 无 `url`：必须提供 **`command`**（stdio）；`args` 为字符串数组，`env` 为 string 键值对。
- 既无 `url` 又无 `command`：返回 `400`，提示占位条目无法探测。

## 与 Agent CLI 配置的一致性警告（非阻断）

在探测成功或失败时都可能附带 `warnings`：

| 代码 | 含义（简述） |
|------|----------------|
| `AGENT_MCP_CONFIG_MAY_NOT_REFERENCE_BUSINESS_LINE_FILE` | Claude：`mcp_config` 列表中可能未包含当前业务线 MCP 配置文件解析路径 |
| `AGENT_GEMINI_MCP_MAY_NOT_REFERENCE_BUSINESS_LINE_FILE_OR_NAME` | Gemini：`extensions` 与 `allowed_mcp_server_names` 可能都未引用当前文件或 MCP 名 |

## 错误码

- 超时：`errorCode: TIMEOUT`，`message` 含耗时说明。
- 其他失败：`errorCode: PROBE_FAILED`；若 stdio 有收集到 stderr，会带 `stderrPreview`。

## HTTP API

- **方法/路径**：`POST /api/v1/mcps/project-local/test`
- **请求体**（`TestProjectLocalMcpDto`）：
  - `projectId`（UUID）
  - `name`：MCP 服务名
  - `sourcePath`：配置文件路径（用于解析该 server 块）
  - `agentToolConfigId`：用于对齐环境变量的业务线 Agent 工具配置 ID
- **鉴权**：JWT；需能访问项目，且具备 `businessLine.agentCli.read` 能力（见 `McpsService.testProjectLocalMcp`）。

## 响应 DTO

`LocalMcpProbeResultDto`（`backend/src/business-lines/dto/local-mcp-probe-result.dto.ts`）：

- 成功：`ok: true`，`transport`，`toolsCount`，可选 `warnings`
- 失败：`ok: false`，`transport`，`errorCode`，`message`，可选 `stderrPreview`、`warnings`

## 前端入口

- API：`frontend/src/api/mcps.ts` → `testProjectLocalMcp`
- MCP 页面：`frontend/src/pages/mcp/use-mcp-page.ts` → `testProjectLocalMcp`；按 MCP 来源（provider）过滤可选的 Agent CLI 配置，需用户先选择「用于探测的 Agent CLI 配置」；文案映射见同文件内 `formatMcpProbeWarnings` 与 `mcp-probe-provider-map.ts`。

## 环境变量

| 变量 | 作用 |
|------|------|
| `AINATIVE_LOCAL_MCP_PROBE_TIMEOUT_MS` | MCP 探测超时（毫秒，有与 smoke 相同的上限）；未设置则沿用 Agent CLI 嗅探测试的超时配置 |

## 模块归属

`LocalMcpProbeService` 源码在 `business-lines`，由 `McpsModule` 引入并在 `McpsController` 上暴露 `project-local/test`。

## 自动化测试

`backend/src/business-lines/local-mcp-probe.service.spec.ts`：stdio 探测与工具数量等（测试中对 `AgentCliSmokeTestService` 使用 mock）。

## 扩展 Agent CLI 类型时（与 MCP 联动）

若新适配器需要在 MCP 侧做「配置是否引用本文件」的启发式警告，需在 `LocalMcpProbeService.collectAgentMcpWarnings` 中补充对应字段逻辑；环境变量覆盖需保证 `buildProbeEnvironmentForAgentToolConfig` 已包含所需密钥。
