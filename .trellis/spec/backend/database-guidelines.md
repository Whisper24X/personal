# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

Database layer uses TypeORM with PostgreSQL, repository abstractions, and SQL migrations.

Key points:
- Runtime ORM config: `backend/src/database/typeorm-config.service.ts`
- CLI data source for migrations: `backend/src/database/data-source.ts`
- Migrations are source of schema truth (do not rely on `synchronize` in production workflows).

---

## Query Patterns

- Domain services call repository interfaces, not TypeORM repositories directly.
- Relational repositories map persistence entities <-> domain models through dedicated mappers.
- Pagination uses `page/limit` and query builder `offset/limit` patterns.

Examples:
- `backend/src/projects/infrastructure/persistence/project.repository.ts`
- `backend/src/projects/infrastructure/persistence/relational/repositories/project.repository.ts`
- `backend/src/business-lines/infrastructure/persistence/relational/repositories/business-line-invitation.repository.ts`

---

## Migrations

- Migration files are timestamp-prefixed and use explicit SQL via `queryRunner.query(...)`.
- `up` and `down` must both be implemented.
- Keep enum/index/constraint names explicit and stable.

Examples:
- `backend/src/database/migrations/1771002000000-CreateProjectsWorkflowTasks.ts`
- `backend/src/database/migrations/1771003000000-CreateBusinessLineInvitations.ts`
- `backend/src/database/migrations/1771002700000-AddTableAndColumnComments.ts`

---

## Naming Conventions

- Tables use snake_case plural (`projects`, `business_line_invitations`).
- FK/index/unique constraints use explicit names (`FK_*`, `IDX_*`, `UQ_*`).
- Entity fields map to camelCase in TypeScript and quoted camelCase columns in SQL where already established.

---

## Common Mistakes

- Skipping migration generation for schema changes.
- Forgetting soft-delete filters (`deletedAt IS NULL`) in read queries for soft-deleted tables.
- Returning raw TypeORM entities from services instead of mapping to domain objects.
- Allowing multiple active invitation links where business rule requires revoking previous links first (current behavior is enforced in `BusinessLinesService.createInvite`).
