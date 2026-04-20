# Task container execution boundaries

This document maps what runs **on the NestJS host (API/Worker)** versus **inside the per-task Docker runner** after the containerization work.

## Host (control plane)

| Concern | Location | Notes |
|--------|----------|--------|
| HTTP API, auth, persistence | `TasksController`, feature modules | Unchanged. |
| Dispatch, leases, project slots | `TaskSchedulerService`, `ProjectExecutionSlotRepository` | DB-backed; advisory lock serializes dispatch ticks. |
| Worktree creation, path policy, allowed-root checks | `TaskRuntimeService`, `TaskGitService` | **Phase 1**: Git and directory prep stay on host for compatibility. |
| Task / node status, logs, notifications | `TaskStatusService`, `TaskLogService`, `TaskOutputService` | `TaskStatusService` triggers runner removal + slot release when the task leaves active execution. |
| Scheduler timers, retention cleanup | `TaskSchedulerService` | Unchanged. |
| Docker CLI orchestration | `ContainerOrchestrationService`, `IsolatedRunnerContainerService` | Creates/removes long-lived runner containers; bind-mounts the host **task worktree** into the container (no separate business-line MCP bind mount). |
| Interactive PTY terminal (optional) | `TaskTerminalService` | Not migrated in Phase 1; still host-oriented unless product decides otherwise. |

## Inside task container (execution plane)

| Concern | Location | Notes |
|--------|----------|--------|
| Agent CLIs (Cursor, Codex, Claude, Gemini, etc.) | Invoked via `AgentProcessLauncherService` → `docker exec -i` | Subprocess **cwd** is the in-container workspace bind mount (default `/workspace` = host Git worktree root). Optional project `configJson.runnerWorkingSubdirectory` (relative to that worktree) resolves the **host** cwd in `AgentExecutionConfig.cwd` and a matching **container** path in `runnerContainerCwd` for `docker exec -w`, so CLIs discover `.codex`/`.cursor` under a monorepo subfolder. Prompt for non-Cursor adapters uses stdin; Cursor keeps argv prompt. |
| MCP / project tool config | **Ephemeral MCP inside the runner** or **host-side MCP + URL/env mapping** | Platform can **`docker exec -d`** HTTP MCP servers **inside the same task container** before Agent runs, injecting base URLs via env (`AINATIVE_EPHEMERAL_MCP_*_URL`, etc.); see [`docs/technical/runner-ephemeral-mcp.md`](../../docs/technical/runner-ephemeral-mcp.md) and [`RunnerEphemeralMcpService`](../src/agent-execution/runner-ephemeral-mcp.service.ts). Alternatively, run MCP on the **Docker host** (or another routable address) and pass **HTTP/SSE URLs** via `Project.configJson.containerRuntime.env` (same pattern as Postgres/Redis). Bridge-mode runners resolve `host.docker.internal` unless disabled (`AINATIVE_RUNNER_ADD_HOST_DOCKER_INTERNAL=false`). Repo `.codex` / `.cursor` still apply for discovery when paths exist **inside** the mounted worktree; see below. |
| Worktree path vs container path | Same bind mount exposes the Git worktree at `AINATIVE_RUNNER_WORKSPACE` (default `/workspace`) | Legacy Agent tool fields that reference **host** worktree **file** paths (e.g. `mcp_config` file lists) are rewritten to `/workspace/...` when `executionPlane: 'runner'` ([`rewriteRunnerWorktreeAbsolutePaths`](../src/agent-execution/runner-platform-mcp-augmentation.ts)). Prefer URL-based MCP for runner tasks. Local MCP probe on the host uses different semantics; see `docs/technical/LOCAL-MCP-PROBE.md`. |
| Codex | `.codex/config.toml` (and auth files) under the worktree | `codex exec` discovers MCP and other settings from the project tree at cwd; optional `config_overrides` in Agent tool config still compile to `-c` lines only from **user** config, not from a platform-side MCP merge. See `docs/agent-cli/codex-exec-config-design.md`. |
| Cursor | `.cursor/mcp.json` | Ensure `approve_mcps` (or equivalent) is set in **Agent tool config** when MCP approval is required; the CLI reads project MCP JSON from the worktree. |
| OpenCode | `.opencode/opencode.json` | MCP entries under `mcp` are read from the worktree; no backend merge. |
| stdio MCP tooling | Runner image | Includes Node/npm/pnpm; prefer `npx -y` for stdio servers. Custom host-only binaries are not available unless installed in the image or added via project deps. |
| Chromium / Chrome DevTools MCP | Runner image | **`chromium`** is installed from apt in [`runner/Dockerfile.runner`](../../runner/Dockerfile.runner); **`CHROME_PATH` / `CHROME_BIN`** default to `/usr/bin/chromium`. Headless/container runs usually still need flags such as `--no-sandbox` (supply via MCP or tool config). See [`docs/technical/runner-ephemeral-mcp.md`](../../docs/technical/runner-ephemeral-mcp.md) § *Runner 镜像中的 Chromium*. |
| Ephemeral LLM helpers (task title suggestion, step label summary) | `AgentRunnerService.runWithCustomPrompt` | Reuses `docker exec` when the same `task.id` already has a running container; otherwise returns runner-unavailable diagnostics and lets the caller decide fallback behavior. |
| Future: tests, builds, scripted tooling | `TaskCommandExecutionGateway` (Phase 2+) | Same `docker exec` path as agents once call sites are migrated. |

### Runner: MCP

1. **Ephemeral MCP (per task, in-container)** — declare `Project.configJson.containerRuntime.ephemeralMcp.templates`; the control plane starts processes in the runner before Agent, merges URL env into the Agent `docker exec` environment, and tears down after the node run. See [`docs/technical/runner-ephemeral-mcp.md`](../../docs/technical/runner-ephemeral-mcp.md).
2. **Host MCP + mapping** — run MCP on the host (or any address reachable from the task container): e.g. `npx @bytebase/dbhub` bound to `0.0.0.0:PORT` on the host.
3. **Map into the container via env** (like DB/Redis): set `Project.configJson.containerRuntime.env` with URLs, e.g. `MCP_DBHUB_URL=http://host.docker.internal:9xxx/sse`. Bridge runners resolve `host.docker.internal` via `--add-host=host.docker.internal:host-gateway` ([`IsolatedRunnerContainerService`](../src/containers/isolated-runner-container.service.ts)); use LAN IP or published ports if your Docker setup differs.
4. **Reference in Codex / Agent config**: use `config_overrides` or `.codex/config.toml` entries that reference those env vars or full URLs — avoid `http://127.0.0.1:...` for **host-only** listeners unless runner `networkMode` is `host` (ephemeral URLs intentionally use **container** `127.0.0.1`).
5. **Optional — cwd for repo-local discovery**: if `.codex` lives under a monorepo subfolder, still use **`runnerWorkingSubdirectory`** so `docker exec -w` matches that directory.

### Runner: CLI config discovery (summary)

| Adapter | Typical repo paths (under `/workspace`) | Notes |
|--------|-------------------------------------------|--------|
| Codex | `.codex/config.toml` | Primary source for `mcp_servers` and model wiring; `config_overrides` in Agent tool config only adds explicit `-c` lines from stored JSON. |
| Cursor | `.cursor/mcp.json` | Often requires `--approve-mcps` from Agent tool raw config. |
| Claude | Paths listed in tool `mcp_config` (often `.cursor/mcp.json`) | Paths under the host worktree are rewritten to `/workspace/...` at resolve time. |
| Gemini | Driven by tool `extensions`, `allowed_mcp_server_names`, `policy` | Same path rewrite rules where applicable. |
| OpenCode | `.opencode/opencode.json` | `mcp` block read from repo. |

### Task detail UI chat vs container Agent CLI MCP

The **task-detail product chat** (assistant in the web UI) and the **Agent CLI subprocess** inside the task runner are **different tool surfaces**:

| Surface | What defines “available tools” |
|--------|--------------------------------|
| Task detail chat session | Whatever the **chat host / gateway** registers for that session (e.g. fixed function names). It does **not** auto-import tools from `codex exec` or from MCP servers spawned inside the runner container. |
| Runner `docker exec` → Codex / Cursor / Claude / … | The CLI loads `.codex`, `.cursor/mcp.json`, `--mcp-config`, etc. MCP tools such as `list_pages` (from chrome-devtools MCP) exist **inside that child process**, not in the task chat tool palette. |

**How to verify MCP in runner tasks:** use **`runner_agent_spawn` / completion logs** and the CLI **`--json` stream** (or container-side `codex mcp list` when debugging). Do **not** use “whether the task chat lists `list_pages`” as the signal that MCP works.

**If the product must expose MCP tools to the task chat:** that requires **session-gateway work** (proxy or protocol bridge from the CLI process to the chat layer). That is **out of scope** for Nest Runner + worktree configuration alone; plan it on the frontend / orchestration product backlog.

## Hybrid: Nest on the host, isolated runners in Docker

Use this when you **start the API/Worker on the host** (e.g. `pnpm run start:dev` in `backend/`) but still want **Codex/Cursor/etc. inside `ainative-task-*` containers**.

1. Install and run **Docker Desktop** (or equivalent) so the host user can run `docker` and the daemon is reachable.
2. Ensure the **runner image** exists locally: `docker pull <AINATIVE_RUNNER_IMAGE>` (default `ainative/runner:latest`), or build it from the repo root with `pnpm run docker:build:runner` after setting `GITLAB_TOKEN` in the shell or `runner/.env.build` (and `GITLAB_USERNAME` as needed).
3. **`AINATIVE_DATA_ROOT_DIR`** worktrees must live on the **host filesystem** paths that Docker can bind-mount (`docker run -v hostWorktree:...`). Relative dirs resolve from the Nest process cwd.

Nest started **inside** `docker-compose` already mounts `docker.sock` into the backend container; the hybrid case relies on the **host** Docker CLI talking to the same daemon.

## Configuration quick reference

- `AINATIVE_RUNNER_ADD_HOST_DOCKER_INTERNAL` — when not `false`/`0`/`no`, bridge-mode task runners add `host.docker.internal` → Docker host gateway so in-container Agent CLIs can reach host-bound MCP/DB/Redis URLs. Set to `false` to skip.
- `AINATIVE_TASK_SANDBOX_PROFILE=runner-only|preview-web|full-dev-sandbox` — `runner-only` keeps the lightweight `sleep infinity` runner for `docker exec`; `preview-web` and `full-dev-sandbox` boot the image entrypoint, which starts `supervisord` + `nginx` and waits for `/health` before `ensureContainer()` returns.
- Sandbox profiles keep the worktree bind mount at `AINATIVE_RUNNER_WORKSPACE` and add container-local managed named volumes for `backend/node_modules`, `frontend/node_modules`, and `logs` so Linux dependencies do not leak back onto the host worktree.
- Task execution uses **effective** task-scoped isolation (container name `ainative-task-*`, one runner per `task.id`).
- `project_execution_slots` enforces **at most one active task container lease per project**, complementing in-memory concurrency counters.

## MCP networking caveats (HTTP/SSE)

MCP URLs that point at `http://127.0.0.1:...` only work when the MCP server shares the same network namespace as the process that opens the URL. TLS with private CAs may require extra `env` (e.g. `NODE_EXTRA_CA_CERTS`) on the business-line Agent tool config.

| Runner network mode (see `ContainerExecutionConfigService`) | `127.0.0.1` in MCP `url` | Reach Docker host from container | Typical fix when connection fails |
|--------------------------------|----------------------------|----------------------------------|-------------------------------------|
| `host` | Same namespace as host processes (for ports bound on host loopback) | N/A (shares host network) | Use LAN IP or a hostname that resolves on the host if loopback is wrong |
| `bridge` | Refers to **container** loopback, not the Docker host | Use host gateway IP, published host port, or `host.docker.internal` where Docker provides it | Point MCP `url` at a routable host/IP:port |

## Runner log redaction

`RunnerAgentExecutionService` logs use [`summarizeAgentCliArgsForLog`](../src/agent-execution/runner-agent-cli-args-log.ts) so long paths after `--mcp-config` are truncated in structured logs (spawn / result payloads), reducing accidental leakage of full data-directory paths.

## Related code

- Ephemeral MCP: [`../src/agent-execution/runner-ephemeral-mcp.service.ts`](../src/agent-execution/runner-ephemeral-mcp.service.ts), [`docs/technical/runner-ephemeral-mcp.md`](../../docs/technical/runner-ephemeral-mcp.md)
- Orchestration facade: [`../src/containers/container-orchestration.service.ts`](../src/containers/container-orchestration.service.ts)
- Agent spawn resolution: [`../src/containers/agent-process-launcher.service.ts`](../src/containers/agent-process-launcher.service.ts)
- Sandbox terminology: [`task-runner-sandbox-models.md`](task-runner-sandbox-models.md)
- Rollout phases: [`task-container-rollout.md`](task-container-rollout.md)
