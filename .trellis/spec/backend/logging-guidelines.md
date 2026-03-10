# Logging Guidelines

> How logging is done in this project.

---

## Overview

This codebase has two logging channels:
- Process/runtime logs via Nest `Logger` for infrastructure events
- Domain execution logs persisted as structured task-scoped JSONL files for task timeline/audit

There is currently minimal `Logger` usage; most task execution tracing is stored as structured file-backed task logs.

---

## Log Levels

- `log` (info-equivalent): startup/shutdown lifecycle
- `warn`: recoverable failures or missing optional config
- `error`: represented in task domain logs via `TaskLogLevel.error`
- `debug`: available in task log enum, but used sparingly

Examples:
- `src/worker.main.ts` (`logger.log` for worker lifecycle)
- `src/notifications/notification-email.service.ts` (`logger.warn` for missing SMTP config)
- `src/tasks/dto/task-log-level.enum.ts`

---

## Structured Logging

- Task logs are structured records with `taskId`, optional `taskNodeId`, `level`, `message`, and JSON `payload`.
- `TasksService.appendLog(...)` is the canonical entrypoint for task timeline logs.
- Task logs are persisted under `AINATIVE_DATA_ROOT_DIR/<businessLineId>/projects/<projectId>/tasks/<taskId>/task-log.jsonl` and streamed to clients (SSE).

Examples:
- `src/tasks/tasks.service.ts` (`appendLog`)
- `src/tasks/infrastructure/persistence/file/repositories/task-log.repository.ts`
- `src/tasks/tasks.controller.ts` (`@Sse(':taskId/stream')`)

---

## What to Log

- Task lifecycle transitions and operator actions (execute, retry, approve, cancel)
- Infrastructure lifecycle events (worker start/shutdown)
- Delivery failures for optional notification channels (email/webhook)

---

## What NOT to Log

- Secrets and credentials (tokens, passwords, SMTP secrets)
- Full unbounded command output without truncation/sanitization
- Repetitive noisy logs in hot paths without a clear operational purpose
- `console.log`/`console.error` in production service code
