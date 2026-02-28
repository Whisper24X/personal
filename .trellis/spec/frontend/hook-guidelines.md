# Hook Guidelines

> How hooks are used in this project.

---

## Overview

This project uses Vue composables under `src/hooks/core/*` for stateful cross-component logic.

Common composables:
- `frontend/src/hooks/core/useAuth.ts`
- `frontend/src/hooks/core/useLayout.ts`
- `frontend/src/hooks/core/useTable.ts`
- `frontend/src/hooks/core/useMessage.ts`

---

## Custom Hook Patterns

- Naming: always `useXxx`.
- Return refs/computed/actions as a plain object.
- Encapsulate loading/error handling in composables that call APIs.
- Use composables to orchestrate multiple APIs and stores (example: `useLayout` combines route, business line APIs, project APIs, and user store).

Recommended shape:
- State: `const loading = ref(false)`
- Derived: `const canX = computed(...)`
- Actions: async functions with `try/finally`

---

## Data Fetching

Server data is fetched directly through API clients (`src/api/*`) inside hooks/components. There is no React Query/SWR equivalent in this codebase yet.

Current patterns:
- Batch page fetch via `fetchAllPages` (`frontend/src/utils/pagination/index.ts`).
- Simple local cache for tables in `useTable`.
- Error messages surfaced through `useMessage` + `toErrorMessage` helper.

---

## Naming Conventions

- File names: `use-` prefix is not used; use `useXxx.ts`.
- Hook folders: grouped by `core` currently.
- Hook exports are re-exported from `frontend/src/hooks/index.ts` for stable imports.

---

## Common Mistakes

- Doing duplicate API calls in each component when a shared composable already exists.
- Returning mutable internal state without clear action methods.
- Forgetting to clear/reset transient state on mode switches (for example login/register forms or modal open state).
- Hiding store writes inside utility functions without clear hook ownership.
