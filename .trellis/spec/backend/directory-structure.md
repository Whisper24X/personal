# Directory Structure

> How backend code is organized in this project.

---

## Overview

Backend is a NestJS modular monolith with per-domain modules. Each domain commonly contains:
- `*.module.ts`
- `*.controller.ts`
- `*.service.ts`
- `domain/*`
- `dto/*`
- `infrastructure/persistence/*`

---

## Directory Layout

```text
backend/src/
├── app.module.ts
├── main.ts
├── auth/
├── business-lines/
├── projects/
├── tasks/
├── notifications/
├── database/
│   ├── config/
│   ├── migrations/
│   └── seeds/
└── utils/
```

---

## Module Organization

- Controllers are thin: parse request params/body and delegate to services.
- Services contain business rules, authorization checks, and domain orchestration.
- Persistence is abstracted via repository interfaces and relational implementations.

Examples:
- `backend/src/business-lines/business-lines.controller.ts`
- `backend/src/business-lines/business-lines.service.ts`
- `backend/src/business-lines/infrastructure/persistence/relational/repositories/business-line.repository.ts`

---

## Naming Conventions

- Files/folders use kebab-case (`business-lines`, `project-member.repository.ts`).
- DTO classes are suffixed with `Dto`.
- Repository abstractions live outside relational implementation folders (for swapability).
- Domain entities use singular class names (`Project`, `BusinessLineMember`).

---

## Examples

Well-structured modules to follow:
- `backend/src/projects/*`
- `backend/src/business-lines/*`
- `backend/src/tasks/*`

---

## Common Mistakes / Forbidden Patterns

- Putting business logic in controllers.
- Bypassing repository abstractions and querying TypeORM directly inside services that already depend on repositories.
- Cross-domain imports from deep relational implementation paths instead of abstract repository contracts.
