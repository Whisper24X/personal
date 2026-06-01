# Runner 内按需 MCP（Ephemeral MCP）

任务节点在 **Runner 容器**中执行 Agent CLI 前，控制面可按项目配置**在同一容器内**用 `docker exec -d` 拉起短生命周期 HTTP MCP 进程，并通过环境变量把 **`http://127.0.0.1:<port>…`** 传给 Agent（与 Codex `config.toml` / `.cursor/mcp.json` 中引用环境变量一致）。

## 配置位置

在 **`Project.configJson.containerRuntime.ephemeralMcp`** 声明模板（参见后端类型 [`ephemeral-mcp.types.ts`](../../backend/src/agent-execution/ephemeral-mcp.types.ts) 与 [`parse-ephemeral-mcp-config.ts`](../../backend/src/agent-execution/parse-ephemeral-mcp-config.ts)）。

最小示例：

```json
{
  "containerRuntime": {
    "ephemeralMcp": {
      "maxConcurrentPerRunner": 4,
      "injectAuditEnv": true,
      "templates": [
        {
          "id": "example",
          "enabled": true,
          "listenPort": 5980,
          "command": "npx",
          "args": ["-y", "@your-scope/mcp-package", "--", "--port", "5980"],
          "healthPath": "/health",
          "urlPath": "/sse",
          "envVarName": "MY_EXAMPLE_MCP_URL",
          "spawnTimeoutMs": 120000
        }
      ]
    }
  }
}
```

- **`listenPort`**：在容器环回上监听；与任务内 Agent 同源，**不要用**宿主机 `host.docker.internal` 指常驻 MCP（本能力替代该类手工映射）。
- **`healthPath`**：就绪探测 GET 路径，默认 `/`；返回 HTTP 状态码 200–499 即视为就绪（需镜像内存在 `curl` 等）。
- **`urlPath`**：注入到 `envVarName` 的路径后缀，默认 `/sse`。
- **`envVarName`**：注入完整 base URL 的环境变量名；缺省为 `AINATIVE_EPHEMERAL_MCP_<id>_URL`（`id` 会规范为大写蛇形）。

## 生命周期与隔离

- 每个任务节点执行：**启动模板 → 健康检查 → 执行 Agent → `finally` 中停止进程**（见 [`RunnerEphemeralMcpService`](../../backend/src/agent-execution/runner-ephemeral-mcp.service.ts)、[`TaskNodeExecutionService`](../../backend/src/tasks/application/task-node-execution.service.ts)）。
- **`AINATIVE_*`** 与 **`AINATIVE_EPHEMERAL_MCP_CONTEXT`**（JSON）会注入 MCP 子进程环境，便于审计与下游区分任务（参见 [`RunnerEphemeralMcpService.buildAuditEnv`](../../backend/src/agent-execution/runner-ephemeral-mcp.service.ts)）。

## Runner 镜像中的 Chromium（Chrome DevTools MCP）

官方 **任务 Runner** 镜像（[`runner/Dockerfile.runner`](../../runner/Dockerfile.runner)）已通过 `apt` **预装 Debian `chromium`** 与 **`fonts-liberation`**，并设置：

- `CHROME_PATH=/usr/bin/chromium`
- `CHROME_BIN=/usr/bin/chromium`

便于 **Chrome DevTools MCP**、`PUPPETEER_EXECUTABLE_PATH` 等约定发现浏览器。更新行为：需**重新构建并部署** Runner 镜像后，新起的任务容器才含上述文件。

在 Docker 内跑 Chromium 时，多数场景还需 **沙箱相关参数**（如 `--no-sandbox`、`--disable-dev-shm-usage`），请按 **MCP / CLI** 文档在模板 `args` 或业务线 env 中配置，而不是仅依赖镜像预装。

若在 ephemeral 模板里仍找不到浏览器，可在该模板的 **`env`** 中显式增加例如：`PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`。

## 限制

- 当前实现针对 **HTTP/SSE 类**在容器内可监听端口的 MCP。**纯 stdio** 且无 HTTP 出口的 MCP 需自行在模板命令中包一层 HTTP 代理或使用支持 HTTP 的发行版。
- Runner 镜像需具备 **`curl`**（健康检查）与常见 **`bash`**；停止时优先 `kill` PID 文件，其次 `fuser` 释放端口。
- 与 [任务容器边界](../../backend/docs/task-container-execution-boundaries.md) 一致：任务详情页聊天工具列表 ≠ Runner 内 MCP 工具面。

## 相关代码

- 编排入口：[`RunnerEphemeralMcpService.startSessions`](../../backend/src/agent-execution/runner-ephemeral-mcp.service.ts)
- Agent 环境合并：[`RunnerAgentExecutionService`](../../backend/src/agent-execution/runner-agent-execution.service.ts) `prepareExecution` 的 `additionalRunnerEnv`
- 项目配置持久化：[`ProjectsService.sanitizeProjectConfigJson`](../../backend/src/projects/projects.service.ts) 保留 `containerRuntime.ephemeralMcp`
