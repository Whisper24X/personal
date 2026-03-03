# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

- Stack: NestJS + TypeScript + TypeORM
- Formatting/linting: ESLint + Prettier (`npm run lint`)
- Tests: Jest unit tests + e2e tests

Core rule: keep feature boundaries clean (controller -> service -> repository port -> adapter).

---

## Forbidden Patterns

- Calling `configService.get/getOrThrow` without `{ infer: true }`.
- Test descriptions that do not start with `should`.
- DB access directly from controllers.
- Large generic repository methods that hide domain intent.

Enforced examples:
- `eslint.config.mjs` (`no-restricted-syntax` for `configService.get` typing and `it("should...")`)

---

## Required Patterns

- Keep controllers thin and place orchestration in services.
- Define DTO contracts and validate inputs through global `ValidationPipe`.
- Keep persistence interfaces abstracted behind repository ports.
- Cap paginated endpoints (current pattern: max `limit = 50`).
- Use typed enums for states/modes instead of string literals when shared.

Examples:
- `src/projects/projects.controller.ts` (pagination cap + thin controller methods)
- `src/tasks/tasks.module.ts` (feature wiring)
- `src/tasks/infrastructure/persistence/task.repository.ts` (repository port)

---

## Testing Requirements

- Unit tests for service logic in `src/**/*.spec.ts`.
- E2E tests for API behavior in `test/**/*.e2e-spec.ts`.
- For behavior changes in service logic, add or update unit tests in the same feature.

Commands:
- `npm run lint`
- `npm run test`
- `npm run test:e2e`

Reference examples:
- `src/tasks/tasks.service.spec.ts`
- `test/admin/auth.e2e-spec.ts`

---

## Code Review Checklist

- Are permission checks enforced before mutations/reads?
- Are all new env config reads typed with `{ infer: true }`?
- Are exceptions specific (`BadRequest/Conflict/Forbidden/NotFound`) and user-safe?
- Are repository/domain/mapper changes kept in sync?
- Are pagination/default limits and edge cases handled?
- Are unit/e2e tests updated for changed behavior?
