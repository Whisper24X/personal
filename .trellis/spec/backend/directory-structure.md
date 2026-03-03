# Directory Structure

> How backend code is organized in this project.

---

## Overview

The backend follows a feature-first NestJS structure with a hexagonal persistence split:
- API layer: controller + DTOs
- Business layer: service + domain models
- Infrastructure layer: repository ports and relational adapters

A feature folder owns its API, domain model, and persistence wiring.

---

## Directory Layout

```txt
src/
├── main.ts
├── worker.main.ts
├── app.module.ts
├── <feature>/
│   ├── <feature>.controller.ts
│   ├── <feature>.service.ts
│   ├── <feature>.module.ts
│   ├── dto/
│   ├── domain/
│   └── infrastructure/persistence/
│       ├── <feature>.repository.ts
│       └── relational/
│           ├── entities/
│           ├── mappers/
│           ├── repositories/
│           └── relational-persistence.module.ts
├── database/
│   ├── config/
│   ├── migrations/
│   ├── seeds/
│   ├── data-source.ts
│   └── typeorm-config.service.ts
└── utils/
```

---

## Module Organization

- Create one module per business capability (for example `tasks`, `projects`, `skills`, `mcps`).
- Keep controllers thin and put orchestration rules in services.
- Put request/response contracts in `dto/` and domain objects in `domain/`.
- Define repository ports as abstract classes in `infrastructure/persistence/*.repository.ts`.
- Bind ports to relational adapters in `infrastructure/persistence/relational/relational-persistence.module.ts`.

---

## Naming Conventions

- Files are lower-kebab-case: `task-runtime.service.ts`, `create-task.dto.ts`.
- NestJS suffixes are mandatory: `.module.ts`, `.controller.ts`, `.service.ts`.
- DTO files end with `.dto.ts`; enums are split as `*.enum.ts` when shared.
- Persistence adapters keep the same repository name as the port under `relational/repositories/`.

---

## Examples

- `src/tasks/`
  - Full feature module with controller/service/dto/domain and relational persistence adapters.
- `src/projects/`
  - Feature with controller + service plus membership and repository workflows.
- `src/skills/`
  - Same structure applied to skill lifecycle and project-local skill operations.
