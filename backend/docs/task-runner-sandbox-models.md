# Task runner vs reference sandbox models

This note fixes terminology between two patterns so we do not confuse **this repo’s per-task runner** with heavier **dev-stack sandboxes** (like a project-local `sandbox/` directory with Docker Compose + supervisord + nginx).

## Current model: per–workflow-run runner (docker execution mode)

- **Scope**: One Docker container per **workflow run** (default isolation key: `task.id`, or `task.configJson.workflowRunId`). Container names use the `ainative-run-*` prefix when `AINATIVE_TASK_ISOLATION_SCOPE=workflow_run`.
- **Purpose**: Run agent CLIs (`cursor` `agent`, etc.) with a **bind-mounted worktree** at `AINATIVE_RUNNER_WORKSPACE` (default `/workspace`).
- **Lifecycle**: `ensure` before agent invocations (nodes, step summaries, title suggestion), `docker exec` for each run, `remove` on task runtime cleanup.
- **What stays on the host**: Git worktree creation/removal, repo tooling in `TaskRuntimeService`, and orchestration remain host-centric.

**Orchestration boundary**: Task/workflow modules should call [`ContainerOrchestrationService`](../src/containers/container-orchestration.service.ts) to `ensure`/`remove` runners and to read docker-mode flags. Lower-level pieces (`ContainerExecutionConfigService`, `IsolatedRunnerContainerService`, `AgentProcessLauncherService`) stay in `backend/src/containers` for infrastructure use and tests.

This is appropriate for **CLI isolation + reproducible toolchains** without hosting a full multi-service dev environment inside every run.

## Reference “sandbox” model (e.g. compose + supervisord + nginx)

- **Scope**: Often one stack per **worktree** or per **feature branch**.
- **Purpose**: Run **multiple processes** (API, Vite, nginx, etc.) behind a single published port, with shared cache volumes and health checks.
- **Lifecycle**: Script-driven `up` / `down`, longer-lived services, operational commands (`logs`, `status`, `exec`).

This is appropriate for **human dev environments** or **preview stacks**, not as the default substrate for every automated task node.

## Boundary (when to use which)

| Concern | Per-task runner | Full sandbox stack |
|--------|------------------|--------------------|
| Agent CLI execution in container | Yes | Optional |
| Many tasks, short-lived containers | Yes | Heavy |
| In-container preview URL / HMR | No (by default) | Yes |
| Host git/worktree integration | Yes | Often duplicated or bridged |

## Extension: sandbox profiles

`AINATIVE_TASK_SANDBOX_PROFILE` supports **`runner-only`** (default), **`preview-web`**, and **`full-dev-sandbox`**.

- **`runner-only`** keeps today’s lightweight model: the orchestrator starts the container with `sleep infinity`, then task agents run through `docker exec`.
- **`preview-web`** and **`full-dev-sandbox`** now switch the runner to the image entrypoint instead of appending `sleep infinity`. The image entrypoint starts **`supervisord` + `nginx`** and waits for `http://127.0.0.1:8080/health` before the runner is considered ready.
- When the mounted worktree matches the classic `sandbox/` layout (`ainative-backend` + `ainative-shadow` + `ainative-app`), the runner reuses the checked-in [`sandbox/nginx.conf`](../../sandbox/nginx.conf) and [`sandbox/supervisord.conf`](../../sandbox/supervisord.conf).
- When the mounted worktree is the current mono-repo layout (`backend` + `frontend`), the runner generates a narrower supervisord/nginx config at startup and launches the services it can actually find instead of crash-looping on missing directories.
- Sandbox profiles additionally mount anonymous container-only volumes for `backend/node_modules`, `frontend/node_modules`, and `logs`, so `npm ci` inside the runner does not overwrite host-side dependencies.
- **`full-dev-sandbox`** still applies the heavier default **memory / pids** limits from `ContainerExecutionConfigService`.

---

Next: [Installing and running](installing-and-running.md)
