# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Frontend quality gates are driven by lint, type-check, and tests:
- `npm run lint`
- `npm run type-check`
- `npm run test:unit`
- `npm run test:e2e` (when behavior/UI flow changes)

Tooling is configured in:
- `frontend/eslint.config.ts`
- `frontend/vitest.config.ts`
- `frontend/playwright.config.ts`

---

## Forbidden Patterns

- Direct `fetch` usage in components when project API clients already exist.
- Unhandled async errors in UI actions (must show message or fallback behavior).
- Mutating props in child components.
- Deeply coupling view components to raw backend response fields without local mapping.

---

## Required Patterns

- Use `<script setup lang="ts">` for Vue SFCs.
- Keep API access in `src/api/*` and shared logic in hooks.
- Add/maintain typed props and emits for reusable components.
- Use centralized message/toast flow (`useMessage`) for user-visible failures.

---

## Testing Requirements

- Unit tests for changed composables/stores/components with meaningful behavior assertions.
- For route-level UX updates (auth/business-line flows), add/adjust view/component tests.
- Use existing test style (`vitest`, `@vue/test-utils`, `pinia` setup, mocks via `vi.mock`).

Examples:
- `frontend/src/views/login/__tests__/index.spec.ts`
- `frontend/src/components/business/settings/__tests__/BusinessLineModal.spec.ts`
- `frontend/src/stores/modules/__tests__/message.spec.ts`

---

## Code Review Checklist

- Is data flow split correctly among component local state, hook logic, and Pinia?
- Are API calls typed and placed in `src/api/*`?
- Are loading/error states visible and testable?
- Are modal/dialog interactions keyboard accessible and closable?
- Did this change run at least lint + type-check + relevant tests?
