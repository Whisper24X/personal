# Error Handling

> How errors are handled in this project.

---

## Overview

- Business and access errors are raised in services with NestJS HTTP exceptions.
- Controllers generally do not catch errors; they delegate and allow Nest to format responses.
- Validation errors are globally normalized through `ValidationPipe` configuration.

---

## Error Types

Use NestJS exception classes that match intent:
- `BadRequestException` for invalid input or failed preconditions
- `ConflictException` for state conflicts or duplicates
- `ForbiddenException` for authorization/scope failures
- `NotFoundException` for missing resources
- `UnauthorizedException` for auth token failures

Examples:
- `src/projects/projects.service.ts`
- `src/tasks/tasks.service.ts`
- `src/skills/skills.service.ts`

---

## Error Handling Patterns

- Validate access first (`ensureCanAccess...` / `ensureCanManage...` style methods).
- Throw early with explicit messages when preconditions fail.
- Return `null` only for internal read helpers where callers decide whether to throw.
- Wrap external process failures (`git`) into user-facing HTTP exceptions.

Examples:
- `src/projects/projects.service.ts` (`inspectRepository`, `create`, member management)
- `src/git/git.service.ts` (command failure formatting + `BadRequestException`)
- `src/tasks/tasks.service.ts` (`getTaskOrThrow`, retry/approve/cancel checks)

---

## API Error Responses

- Standard exceptions use NestJS default JSON response shape.
- Validation failures are customized to HTTP 422 with field-level `errors` map.

Validation response source:
- `src/utils/validation-options.ts`

---

## Common Mistakes

- Catching and swallowing exceptions in controllers.
- Throwing generic `Error` for API-facing failures instead of NestJS exceptions.
- Returning ambiguous booleans where richer exceptions are expected.
- Leaking raw infrastructure errors/messages to clients without sanitizing context.
