# Directory Structure

> How frontend code is organized in this project.

---

## Overview

The frontend is a Vue 3 + TypeScript + Vite app organized by layer:
- `views/` for route-level pages
- `components/` for reusable UI blocks
- `api/` for HTTP endpoint wrappers
- `stores/` for Pinia global state
- `hooks/` for shared Composition API logic
- `types/` for API/UI/type contracts

---

## Directory Layout

```txt
src/
├── main.ts
├── App.vue
├── api/
├── components/
│   ├── core/
│   ├── tasks/
│   ├── settings/
│   └── business/
├── views/
├── router/
│   ├── routes/
│   ├── guards/
│   └── core/
├── stores/
│   └── modules/
├── hooks/
│   └── core/
├── types/
│   ├── api/
│   ├── common/
│   ├── router/
│   └── component/
├── utils/
├── assets/styles/
└── directives/
```

---

## Module Organization

- Put route-entry pages in `views/<feature>/index.vue` (or `detail.vue` when needed).
- Put shared, non-route UI in `components/<feature>/`.
- Keep API calls in `src/api/*.ts`; components/views should not build raw URLs.
- Keep cross-page state in Pinia modules under `stores/modules/`.
- Keep route definitions in `router/routes/*.ts` and access control in `router/guards/*.ts`.

---

## Naming Conventions

- Vue components: PascalCase filenames (`TaskCreatePanel.vue`, `SettingsModal.vue`).
- Views: route-oriented lowercase files (`views/tasks/index.vue`, `views/tasks/detail.vue`).
- Hooks/composables: `use*.ts` in `hooks/core/`.
- Types: grouped by domain in `types/api/*.ts`, `types/common/*.ts`, etc.
- API wrappers: domain-oriented files in `api/*.ts` (`tasks.ts`, `projects.ts`).

---

## Examples

- `src/views/tasks/index.vue` + `src/components/tasks/TaskCreatePanel.vue`
  - Route page delegates feature UI to a component.
- `src/router/routes/system.ts` + `src/router/guards/auth-guard.ts`
  - Route definitions and guard logic are separated.
- `src/api/tasks.ts` + `src/types/api/tasks.ts`
  - Endpoint wrapper and typed payload contracts evolve together.
