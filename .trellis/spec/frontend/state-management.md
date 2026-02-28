# State Management

> How state is managed in this project.

---

## Overview

State is split across:
- Local component/composable state (`ref`, `computed`, `watch`)
- Global app state with Pinia
- Server state fetched on demand with API clients (no centralized server-state library)

---

## State Categories

1. Local UI state
- Form fields, modal visibility, temporary validation text.
- Examples: `frontend/src/views/login/index.vue`, `frontend/src/components/business/settings/modals/*.vue`.

2. Global application state (Pinia)
- Auth/session user profile: `frontend/src/stores/modules/user.ts`
- Global message queue: `frontend/src/stores/modules/message.ts`
- Other app-level concerns: `menu.ts`, `setting.ts`, `worktab.ts`

3. Server state
- Loaded through `src/api/*` and composed in hooks/views (`useLayout`, `BusinessLineModal`).

4. Persistence state
- Tokens and selected UI preferences in `localStorage` (`STORAGE_KEYS`, `utils/ui-preferences.ts`).

---

## When to Use Global State

Promote to Pinia only if state is shared across unrelated routes/components or must survive navigation.

Use Pinia for:
- authentication tokens/profile
- cross-page message notifications
- persistent UI toggles

Keep local if:
- only used in a single view/modal
- tied to one form lifecycle

---

## Server State

Current project pattern:
- API methods return typed payloads.
- Components/hooks fetch on open/mount and refresh after mutations.
- Pagination is backend-driven (`page`, `limit`, `hasNextPage`) and helper-driven for full scans.

Examples:
- `frontend/src/api/business-lines.ts`
- `frontend/src/hooks/core/useLayout.ts`
- `frontend/src/components/business/settings/BusinessLineModal.vue`

---

## Common Mistakes

- Storing large server lists globally without reuse need.
- Coupling API payload shape directly to template without normalization.
- Forgetting to clear auth state on 401 refresh failure (handled centrally in `frontend/src/utils/http/index.ts`).
- Using Pinia for one-off modal state that should stay local.
