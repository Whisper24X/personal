# Logging Guidelines

> How logging is done in this project.

---

## Overview

Logging currently uses Nest `Logger` in selected modules (not universally across all services).

Current usage examples:
- `backend/src/notifications/notifications.service.ts`
- `backend/src/notifications/notification-email.service.ts`
- `backend/src/worker.main.ts`

No centralized structured logging pipeline is implemented yet.

---

## Log Levels

Current practical usage:
- `logger.log(...)` for worker lifecycle/startup/shutdown events.
- `logger.warn(...)` for missing optional infra configuration (SMTP disabled case).
- Error scenarios are often represented through thrown exceptions instead of explicit logs.

---

## Structured Logging

There is no global JSON log schema today. Messages are plain text with module-scoped logger names.

When adding logs:
- Keep logger instance scoped by class name.
- Include stable identifiers in message text (`taskId`, `userId`, `eventType`) when useful.
- Prefer one concise log line per event over verbose multi-line logs.

---

## What to Log

- Runtime lifecycle events (worker boot/shutdown).
- External integration fallback/disable events (SMTP missing config, webhook retry exhaustion).
- Important async background failures that do not surface directly to API responses.

---

## What NOT to Log

- Passwords, JWT tokens, refresh tokens.
- Full sensitive payloads from auth/profile endpoints.
- Large raw objects when a few identifiers are enough.
- `console.log` in production backend modules (use `Logger`).
