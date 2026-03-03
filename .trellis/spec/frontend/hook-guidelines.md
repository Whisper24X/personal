# Hook Guidelines

> How hooks are used in this project.

---

## Overview

In this Vue project, "hooks" are Composition API composables stored in `src/hooks/`.

Current composables are lightweight state-and-action wrappers (auth, message, layout helpers, table/chart helpers).

---

## Custom Hook Patterns

- File naming: `use*.ts`.
- Compose with `ref`, `computed`, `watch`, and return explicit state/actions object.
- Use hooks to centralize reusable logic that appears in multiple views/components.
- Re-export via `src/hooks/index.ts` to provide one import entry.

Examples:
- `src/hooks/core/useAuth.ts`
- `src/hooks/core/useLayout.ts`
- `src/hooks/core/useTable.ts`

---

## Data Fetching

- Server data is usually fetched in views/components, then composed into local refs.
- Hooks can orchestrate fetching when logic is broad/shared (`useLayout` loads business lines/projects).
- API modules (`src/api/*.ts`) remain the only place constructing API calls.

Examples:
- `useLayout.ts` uses `projectsApi` + `businessLinesApi`
- `TaskCreatePanel.vue` loads via `workflowApi`, `projectsApi`, `businessLinesApi`

---

## Naming Conventions

- Always prefix composables with `use`.
- Keep names domain-specific (`useAuth`, `useMessage`, `useLayout`).
- Keep helper-only logic outside hooks when no reactive state is needed.

---

## Common Mistakes

- Putting route-specific one-off logic into global composables too early.
- Returning deeply nested structures instead of a flat state/action API.
- Duplicating logic already available in Pinia stores (`useUserStore`, `useMessageStore`).
- Mixing raw endpoint construction inside hooks instead of using `api/*` wrappers.
