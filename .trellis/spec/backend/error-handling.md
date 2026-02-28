# Error Handling

> How errors are handled in this project.

---

## Overview

The project uses NestJS HTTP exceptions from service layer for business and authorization failures.

Common exception types:
- `NotFoundException`
- `ConflictException`
- `ForbiddenException`
- `BadRequestException`
- `UnauthorizedException`

---

## Error Types

- Validation errors are handled globally by `ValidationPipe` with custom `exceptionFactory` and return `422 Unprocessable Entity`.
- Business rule errors are thrown in services.
- Repository-level not-found checks can throw (for example relational repository `update` methods).

Examples:
- `backend/src/utils/validation-options.ts`
- `backend/src/business-lines/business-lines.service.ts`
- `backend/src/projects/infrastructure/persistence/relational/repositories/project.repository.ts`

---

## Error Handling Patterns

- Controllers are mostly pass-through and do not wrap service calls in `try/catch`.
- Services perform explicit authorization/resource checks before writes.
- Side-effect operations that should not fail primary flow may swallow errors intentionally (`void error`) and return degraded results.

Examples:
- Invitation/project sync fallback in `backend/src/business-lines/business-lines.service.ts`
- Notification side-effects in `backend/src/notifications/notifications.service.ts`

---

## API Error Responses

Observed response behavior:
- Validation: `{ status: 422, errors: { field: 'message' } }`
- Other exceptions: standard NestJS error payloads with status/message.

When adding new endpoints, follow existing exception classes rather than returning custom ad-hoc error objects.

---

## Common Mistakes

- Returning `null` for errors that should be explicit `4xx` exceptions.
- Throwing generic `Error` in services for client-facing failures.
- Catching and suppressing exceptions without preserving user-visible outcome (unless the operation is explicitly best-effort side effect).
- Using inconsistent error message keys for i18n-sensitive paths.
