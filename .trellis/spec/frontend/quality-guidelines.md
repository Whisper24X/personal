# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

- Framework: Vue 3 + TypeScript + Vite
- Linting: Oxlint + ESLint (`pnpm lint`)
- Type-checking: `vue-tsc` (`pnpm type-check`)
- Unit tests: Vitest
- E2E tests: Playwright

---

## Forbidden Patterns

- Direct `fetch` usage from views/components when an API wrapper already exists.
- Introducing new `localStorage` string keys without `STORAGE_KEYS` constants.
- Untyped props/emits in SFCs.
- Large unhandled async flows without user feedback/error messaging.

---

## Required Patterns

- Use `<script setup lang="ts">` for Vue SFCs.
- Keep API contracts in `src/types/api/*` and endpoint calls in `src/api/*`.
- Convert unknown errors to user-safe text with `toErrorMessage` in UI workflows.
- Keep auth/session cleanup consistent through shared helpers/stores.
- Add accessible labels/roles for modal and icon-button interactions.

Examples:
- `src/api/tasks.ts` + `src/types/api/tasks.ts`
- `src/views/projects/index.vue` (`toErrorMessage` + async loading/error handling)
- `src/components/tasks/TaskCreateModal.vue` and `src/components/settings/SettingsModal.vue`

---

## Testing Requirements

- Run lint and type-check before merge.
- Add/update unit tests when store/composable/component behavior changes.
- Add/update e2e tests for critical route workflows.

Commands:
- `pnpm lint`
- `pnpm type-check`
- `pnpm test:unit`
- `pnpm test:e2e`

Example tests:
- `src/views/login/__tests__/index.spec.ts`
- `src/components/settings/__tests__/SettingsModal.spec.ts`
- `src/router/__tests__/system-routes.test.ts`

---

## Code Review Checklist

- Are new APIs wrapped in `src/api/*` with typed request/response models?
- Are reactive states split correctly (local vs Pinia vs URL)?
- Are async actions handling loading and error states clearly?
- Are route guards/permissions consistent with route metadata?
- Are accessibility attributes present for modals and icon-only buttons?
- Were related unit/e2e tests updated?
