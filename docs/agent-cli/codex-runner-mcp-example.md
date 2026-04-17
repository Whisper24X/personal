# Codex：任务 Runner 环境下的 MCP 配置示例

适用于 **Docker bridge 任务容器**内跑 `codex exec` 的场景：容器内访问宿主机上的 MCP 应使用 **`http://host.docker.internal:端口/...`**，不要用 **`http://127.0.0.1:...`** 指向宿主机服务。

更完整的边界说明见 [task-container-execution-boundaries.md](../../backend/docs/task-container-execution-boundaries.md) 与 [codex-exec-config-design.md](./codex-exec-config-design.md) §3.4。

---

## 1. 宿主机：用 DBHub 的 HTTP 传输（推荐）

在**宿主机**终端长期运行（示例端口 `5980`，可按需修改）：

```bash
# 监听在 0.0.0.0（Node 默认对 HTTP 服务即监听所有网卡；若某版本只绑 127.0.0.1，见 DBHub 文档中的 host 选项）
npx @bytebase/dbhub@latest --transport http --port 5980 --dsn "postgresql://USER:PASSWORD@HOST:5433/DATABASE?sslmode=disable"
```

- 将 `USER`、`PASSWORD`、`HOST`、`5433`、`DATABASE` 换成你的真实连接信息（若数据库在宿主机且原先写 `127.0.0.1`，在 **DSN 里**仍应使用 Runner 容器能访问的地址：例如局域网 IP `10.x.x.x`，或宿主机映射端口，**不要**依赖任务容器里的 `127.0.0.1` 指到宿主机 Postgres）。
- DBHub 的 HTTP 模式下 MCP 端点以 [DBHub 命令行文档](https://dbhub.ai/config/command-line) 为准（常见为 `/mcp`；若你使用 `--transport sse`，则为 `/sse`）。

确认监听：

```bash
lsof -iTCP:5980 -sTCP:LISTEN
```

---

## 2. 项目：`configJson.containerRuntime.env`

在 **AINative 项目设置 → 容器环境变量**（多行 `KEY=value`），或 API/数据库中的 `Project.configJson`，增加：

```text
# 与下面 .codex/config.toml 中的 url 主机/端口一致（路径以 DBHub 实际为准）
CODEX_DBHUB_MCP_URL=http://host.docker.internal:5980/mcp
```

等价 JSON 片段：

```json
{
  "containerRuntime": {
    "env": {
      "CODEX_DBHUB_MCP_URL": "http://host.docker.internal:5980/mcp"
    }
  }
}
```

说明：任务 Runner 容器启动时会合并这些变量；`host.docker.internal` 依赖 bridge 下默认注入（勿将 `AINATIVE_RUNNER_ADD_HOST_DOCKER_INTERNAL` 设为禁用，除非你知道后果）。

---

## 3. 仓库内：`.codex/config.toml`（HTTP MCP）

将 **stdio 的 dbhub** 改为 **远程 URL**（与宿主机 DBHub HTTP 端口、路径一致）：

```toml
# DBHub：由宿主机进程提供 HTTP MCP，任务容器通过 host.docker.internal 访问
[mcp_servers.dbhub]
url = "http://host.docker.internal:5980/mcp"

# 若需 headers（例如网关鉴权），可按 Codex / MCP 文档添加：
# [mcp_servers.dbhub]
# url = "http://host.docker.internal:5980/mcp"
# headers = { Authorization = "Bearer xxx" }
```

若 Codex 版本要求 SSE 而非 Streamable HTTP，把 `url` 改为 DBHub 的 SSE 地址（例如 `http://host.docker.internal:5980/sse`），并与宿主机 `--transport sse` 一致。

**注意**：TOML 里通常**不会**自动展开 `containerRuntime.env` 里的变量；需保证这里的 `url` 与你在第 2 步中约定的地址一致（可直接写死 `host.docker.internal`，与 env 中的值相同即可）。

---

## 4. `chrome-devtools-mcp`（stdio）

该条目在**本机桌面**环境常用；在 **Runner 容器**内往往没有可用的本机 Chrome，stdio 方式容易失败。可选策略：

- **仅在本地开发**保留 `[mcp_servers.chrome-devtools]`；在用于 CI/Runner 的分支或配置中注释掉；或  
- 按 Chrome DevTools MCP 官方说明，在**宿主机**以浏览器远程调试 + 可达 URL 的方式接入（再按本文 **HTTP + host.docker.internal** 模式写入 `url`）。

---

## 5. 校验

1. 保存项目配置后重新执行任务（必要时让任务容器重建以带上新 env）。  
2. 查看 Runner 日志中 `runner_agent_spawn` 的 `envKeys` 是否包含 `CODEX_DBHUB_MCP_URL`（若仅写在 TOML 而未注入 env，至少 TOML 的 `url` 应对）。  
3. 在任务容器内、与 Agent 相同 cwd 执行：`codex mcp list`（见 backend `task-container-execution-boundaries.md`）。

---

## 6. 与「仅 stdio、不启 HTTP」的对比

| 方式 | 适用场景 |
|------|----------|
| `stdio` + `npx @bytebase/dbhub` | 本机 Codex/Cursor，子进程直连，无需端口。 |
| `http`/`sse` + 宿主机监听 + `url` + `host.docker.internal` | **任务 Runner 容器**内 `codex`，需跨 Docker 网络访问宿主机 MCP。 |

若坚持在容器内用 stdio 跑 `npx dbhub`，需保证 **DSN 指向从容器内可达的数据库地址**（不是宿主 `127.0.0.1`）；这与「把 DBHub 放宿主机 HTTP」相比更易踩网络策略与依赖问题，故推荐 HTTP 模式。
