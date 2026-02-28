# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

Backend quality gates:
- `npm run lint`
- `npm run test`
- `npm run test:e2e` when API contracts/flows change
- migration commands for schema updates (`migration:run`, `migration:revert`)

Core configs:
- `backend/eslint.config.mjs`
- `backend/tsconfig.json`
- `backend/test/jest-e2e.json`

---

## Forbidden Patterns

- Business logic in controllers.
- Direct DB access in services when repository abstraction exists.
- Skipping DTO validation decorators for request payloads.
- Calling `configService.get/getOrThrow` without `{ infer: true }` (explicitly restricted by ESLint rule).

---

## Required Patterns

- DTO classes with `class-validator` + Swagger decorators.
- Service-layer authorization checks before mutation operations.
- Repository abstraction for persistence and mapping layers.
- Explicit HTTP status via exceptions for domain failures.

Examples:
- `backend/src/projects/dto/create-project.dto.ts`
- `backend/src/business-lines/business-lines.service.ts`
- `backend/src/tasks/tasks.controller.ts`

---

## Testing Requirements

- Add/update unit tests for changed service/controller behavior.
- Keep jest test naming readable; existing ESLint rule expects `it('should ...')` style.
- For stream/pagination/auth logic, include regression tests around query/permission behavior.

Examples:
- `backend/src/tasks/tasks.controller.spec.ts`
- `backend/src/notifications/notifications.service.spec.ts`
- `backend/src/observability/observability.service.spec.ts`

---

## Code Review Checklist

- Does controller remain thin and delegate to service?
- Are all request DTOs validated and documented?
- Are authorization and ownership rules enforced in service methods?
- Are migration and entity/repository updates consistent?
- Are tests/lint updated for changed behavior?
