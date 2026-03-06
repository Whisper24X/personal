# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

- ORM: TypeORM (`@nestjs/typeorm` + `typeorm` 0.3.x)
- Primary DB: PostgreSQL
- Migrations are SQL-first TypeORM migration classes in `src/database/migrations/`
- Runtime DB config is validated from env before app startup

---

## Query Patterns

- Use repository ports in services; do not query TypeORM directly from controllers/services.
- Use relational adapter repositories for DB-specific logic.
- Use QueryBuilder for filtering/pagination/aggregations.
- Keep mapping between domain and persistence explicit with dedicated mapper classes.

Examples:
- `src/tasks/infrastructure/persistence/task.repository.ts` (repository port)
- `src/tasks/infrastructure/persistence/relational/repositories/task.repository.ts` (QueryBuilder, pagination, counters)
- `src/tasks/infrastructure/persistence/relational/mappers/task.mapper.ts` (domain <-> entity mapping)

---

## Migrations

- Create migrations with TypeORM scripts in `package.json`.
- Migration files use `timestamp-Description.ts` naming.
- Prefer explicit SQL in `queryRunner.query(...)` for enum/table/index/constraint control.
- Include reverse operations in `down()` for rollback.

Commands:
- `npm run migration:generate -- src/database/migrations/<Name>`
- `npm run migration:run`
- `npm run migration:revert`

Examples:
- `src/database/migrations/1771002000000-CreateProjectsWorkflowTasks.ts`
- `src/database/migrations/1771002700000-AddTableAndColumnComments.ts`

---

## Naming Conventions

- Tables: snake_case plural (`projects`, `task_nodes`, `notification_events`)
- PKs: UUID `id` via `@PrimaryGeneratedColumn('uuid')`
- Foreign keys in entities: camelCase (`projectId`, `workflowTemplateId`)
- Entity field order: place scope foreign keys such as `businessLineId` and `projectId` immediately after `id`; then keep other foreign keys, business fields, relation fields, and timestamps in a stable order
- Timestamps: `createdAt`, `updatedAt`, optional `deletedAt` (soft delete)
- Index names are explicit (`IDX_tasks_project_id`, `UQ_projects_business_line_name`)
- Enum types in DB are explicit (`task_status_enum`, `task_mode_enum`)

Entity examples:
- `src/projects/infrastructure/persistence/relational/entities/project.entity.ts`
- `src/tasks/infrastructure/persistence/relational/entities/task.entity.ts`

### Convention: Entity Foreign Key Ordering

**What**: In TypeORM entity declarations, keep scope-defining foreign keys near the top of the class for readability.

**Why**: `businessLineId` and `projectId` define the ownership/scope of most domain records. Putting them right after `id` makes entity structure easier to scan and keeps related entities visually consistent.

**Preferred order**:

1. `id`
2. Scope foreign keys like `businessLineId`, `projectId`
3. Other foreign keys like `workflowTemplateId`, `createdBy`
4. Business fields
5. Relation fields (`@ManyToOne`, etc.)
6. Timestamp fields

**Example**:

```typescript
export class TaskEntity extends EntityRelationalHelper {
  id: string;
  businessLineId: string;
  projectId: string;
  workflowTemplateId?: string | null;
  title: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Common Mistakes

- Querying TypeORM repositories directly in services instead of using repository ports.
- Adding DB fields without updating both mapper and domain model.
- Placing `businessLineId` / `projectId` deep in the entity body, making scope fields harder to discover during review.
- Forgetting soft-delete filters (`deletedAt IS NULL`) in custom queries.
- Writing migration `up()` changes without matching `down()` rollback.
