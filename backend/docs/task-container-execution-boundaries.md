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
| Docker CLI orchestration | `ContainerOrchestrationService`, `IsolatedRunnerContainerService` | Creates/removes long-lived runner containers; bind-mounts host worktree. |
| Interactive PTY terminal (optional) | `TaskTerminalService` | Not migrated in Phase 1; still host-oriented unless product decides otherwise. |

## Inside task container (execution plane)

| Concern | Location | Notes |
|--------|----------|--------|
| Agent CLIs (Cursor, Codex, Claude, Gemini, etc.) | Invoked via `AgentProcessLauncherService` → `docker exec -i` | Prompt for non-Cursor adapters uses stdin; Cursor keeps argv prompt. |
| Ephemeral LLM helpers (task title suggestion, step label summary) | `AgentRunnerService.runWithCustomPrompt` | May use host `spawn` when no `ainative-task-*` runner exists yet; uses `docker exec` if that container is already running for the same `task.id`. |
| Future: tests, builds, scripted tooling | `TaskCommandExecutionGateway` (Phase 2+) | Same `docker exec` path as agents once call sites are migrated. |

## Hybrid: Nest on the host, isolated runners in Docker

Use this when you **start the API/Worker on the host** (e.g. `pnpm run start:dev` in `backend/`) but still want **Codex/Cursor/etc. inside `ainative-task-*` containers**.

1. Keep **`AINATIVE_TASK_EXECUTION_MODE=docker`**. Do **not** set `host` if you want isolation.
2. Install and run **Docker Desktop** (or equivalent) so the host user can run `docker` and the daemon is reachable.
3. Ensure the **runner image** exists locally: `docker pull <AINATIVE_RUNNER_IMAGE>` (default `ainative/runner:latest`), or build it from the repo root with `docker build -f backend/Dockerfile.runner -t ainative/runner:latest .`.
4. **`AINATIVE_DATA_ROOT_DIR`** worktrees must live on the **host filesystem** paths that Docker can bind-mount (`docker run -v hostWorktree:...`). Relative dirs resolve from the Nest process cwd.
5. Optional: **`AINATIVE_DOCKER_STRICT_EXECUTION=false`** during local Bring-up if you need temporary host fallback when the daemon is down.

Nest started **inside** `docker-compose` already mounts `docker.sock` into the backend container; the hybrid case relies on the **host** Docker CLI talking to the same daemon.

## Configuration quick reference

- `AINATIVE_TASK_EXECUTION_MODE=host|docker` — set `docker` to run agent CLIs inside runner containers; unset or `host` keeps execution on the NestJS host via `spawn`.
- `AINATIVE_DOCKER_STRICT_EXECUTION` — when `docker` + strict, agent runs must use isolation (no silent host fallback). Set `false` to allow host fallback if a runner cannot be started.
- `AINATIVE_TASK_SANDBOX_PROFILE=runner-only|preview-web|full-dev-sandbox` — `runner-only` keeps the lightweight `sleep infinity` runner for `docker exec`; `preview-web` and `full-dev-sandbox` boot the image entrypoint, which starts `supervisord` + `nginx` and waits for `/health` before `ensureContainer()` returns.
- Sandbox profiles keep the worktree bind mount at `AINATIVE_RUNNER_WORKSPACE` and add container-local anonymous volumes for `backend/node_modules`, `frontend/node_modules`, and `logs` so Linux dependencies do not leak back onto the host worktree.
- Docker mode forces **effective** isolation scope to `task` (container name `ainative-task-*`, one runner per `task.id`).
- `project_execution_slots` enforces **at most one active task container lease per project** when Docker mode is on, complementing in-memory concurrency counters.

## Related code

- Orchestration facade: [`../src/containers/container-orchestration.service.ts`](../src/containers/container-orchestration.service.ts)
- Agent spawn resolution: [`../src/containers/agent-process-launcher.service.ts`](../src/containers/agent-process-launcher.service.ts)
- Sandbox terminology: [`task-runner-sandbox-models.md`](task-runner-sandbox-models.md)
- Rollout phases: [`task-container-rollout.md`](task-container-rollout.md)
