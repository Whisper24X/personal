# State Management

> How state is managed in this project.

---

## Overview

State is split into clear layers:
- Local UI state: `ref`/`reactive` inside components/views
- Global app state: Pinia modules in `src/stores/modules/`
- Server state: fetched on demand via `src/api/*` + view-level refs
- URL state: router params/query for view context (for example selected project/settings tab)

---

## State Categories

- Local state
  - Form, modal, loading, tab, and transient interaction state in each component/view.
  - Example: `src/views/projects/detail.vue`

- Global state (Pinia)
  - Auth/session/profile: `stores/modules/user.ts`
  - Toast/message queue: `stores/modules/message.ts`
  - Theme and UI preferences: `stores/modules/setting.ts`
  - Menu/worktab state: `stores/modules/menu.ts`, `stores/modules/worktab.ts`

- Persistent local state
  - Uses `localStorage` keys from `src/types/common/storage.ts`.
  - Applied at startup in `src/main.ts` via `applyStoredUiPreferences()`.

- URL state
  - Query/params drive context (`projectId`, settings section, auth redirects).
  - Examples: `router/routes/system.ts`, `router/guards/auth-guard.ts`, `hooks/core/useLayout.ts`

---

## When to Use Global State

Use Pinia when data is needed across multiple routes/components or must survive navigation:
- authenticated user/token/profile
- app-level UI preferences and message queue
- cross-layout navigation state

Keep state local when only one page/component consumes it.

---

## Server State

- No dedicated caching library (for example Vue Query) is used currently.
- Fetch with API wrappers and keep data in local refs.
- Use shared helpers for repeated pagination flows (`fetchAllPages`).

Examples:
- `src/views/projects/index.vue`
- `src/components/tasks/TaskCreatePanel.vue`
- `src/utils/pagination/index.ts`

---

## Common Mistakes

- Promoting one-off local state to Pinia too early.
- Duplicating server data in multiple unrelated stores without sync strategy.
- Using inconsistent `localStorage` keys instead of `STORAGE_KEYS` constants.
- Forgetting to clear auth-related state/tokens on unauthorized responses.
