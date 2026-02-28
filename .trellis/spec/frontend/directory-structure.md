# Directory Structure

> How frontend code is organized in this project.

---

## Overview

The frontend is a Vue 3 + TypeScript SPA organized by technical layers (`api`, `router`, `stores`, `types`) plus UI domains (`views`, `components`).

Use this rule when placing new code:
- Page-level screens go to `src/views/*`.
- Reusable UI blocks go to `src/components/*`.
- Shared stateful logic goes to `src/hooks/core/*`.
- API calls stay in `src/api/*` and keep HTTP details out of views/components.

---

## Directory Layout

```text
frontend/src/
├── api/                 # API clients per backend resource
├── assets/              # global styles, images
├── components/          # reusable UI components (core + business)
├── hooks/               # composables (mostly in hooks/core)
├── router/              # route tables, guards, router factory
├── stores/              # Pinia stores
├── types/               # shared TS types by domain
├── utils/               # generic helpers (http, pagination, storage)
└── views/               # route-level pages
```

---

## Module Organization

1. Keep route pages thin and move reusable logic into hooks/components.
2. Group domain-specific UI under a feature folder.
3. Keep API contracts close to API clients; if cross-module reuse grows, move to `src/types/api/*`.

Examples from current codebase:
- `frontend/src/views/business-lines/index.vue` + `frontend/src/components/business/settings/*`
- `frontend/src/router/routes/system.ts` + `frontend/src/router/guards/*`
- `frontend/src/api/business-lines.ts` + `frontend/src/types/api/projects.ts`

---

## Naming Conventions

- Vue SFC component filenames: `PascalCase.vue`.
- Route pages usually use `index.vue` in a feature folder.
- Composables use `useXxx.ts` naming.
- Store modules are lower-case feature names (for example `user.ts`, `message.ts`).
- API files use kebab-case domain names (for example `business-lines.ts`).

---

## Examples

Well-structured modules to follow:
- `frontend/src/components/business/settings/BusinessLineModal.vue`
- `frontend/src/hooks/core/useLayout.ts`
- `frontend/src/router/routes/system.ts`

---

## Common Mistakes / Forbidden Patterns

- Putting `fetch`/HTTP logic directly in pages instead of `src/api/*` and hooks.
- Creating cross-feature imports from deep internal files when a shared type/helper should be extracted.
- Mixing route definitions inside view files instead of `src/router/routes/*`.
