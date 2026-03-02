# Component Guidelines

> How components are built in this project.

---

## Overview

Components use Vue 3 `<script setup lang="ts">` with Composition API. Props/emits are typed, and complex modal behavior is implemented with local refs + `watch` synchronization.

Representative files:
- `frontend/src/components/business/settings/modals/MemberPermissionModal.vue`
- `frontend/src/components/business/settings/modals/BusinessLineFormModal.vue`
- `frontend/src/components/core/layouts/Layout.vue`

---

## Component Structure

Typical structure:
1. `<script setup lang="ts">`
2. `defineOptions({ name: '...' })` for route-level or key reusable components
3. `defineProps` + `defineEmits` with explicit TS types
4. Local state via `ref`/`computed`
5. Event handlers and form validation
6. Template
7. Optional scoped CSS (used for specialized pages like login)

For modal components, use `Teleport to="body"` and manage close behavior via `update:open` events.

---

## Create/Edit UI Pattern

- Do not place entity create/edit forms directly in page content areas.
- Route pages should provide list, search, and action triggers only; clicking "create" or "edit" opens a modal form.
- Extract form UI into dedicated modal components (for example `UserFormModal.vue`, `ProjectFormModal.vue`) and keep parent views focused on orchestration.
- Prefer controlled modal props (`open`, `mode`, `submitting`, `initial*`, `errorMessage`) plus `submit`/`update:open` emits.
- Reset form state when the modal opens/closes to avoid stale values across operations.

Representative modal examples:
- `frontend/src/components/business/settings/modals/BusinessLineFormModal.vue`
- `frontend/src/components/business/settings/modals/ProjectFormModal.vue`

---

## Props Conventions

- Use typed `defineProps<...>()`, not untyped props objects.
- Prefer controlled components for dialogs/forms (`open`, `submitting`, `initial*` props).
- Use `defineEmits<...>()` with payload types.
- Avoid mutating props directly; copy to local refs and sync with `watch` when modal opens.

Examples:
- `frontend/src/components/business/settings/modals/ProjectFormModal.vue`
- `frontend/src/components/business/settings/modals/MemberPermissionModal.vue`

---

## Styling Patterns

- Primary styling uses utility classes (Tailwind-style tokens such as `bg-background`, `text-foreground`, `border-border`).
- Shared visual tokens come from global styles/themes under `src/assets/styles/*`.
- Use scoped CSS only when utility classes are not enough (for example rich auth page animation in `frontend/src/views/login/index.vue`).

---

## Accessibility

Current accessible patterns used in project:
- Dialog semantics: `role="dialog"`, `aria-modal="true"`, explicit close buttons (`aria-label`).
- Keyboard handling for modals (`@keydown.esc.prevent.stop`).
- Live regions for toasts/messages (`aria-live="polite"` in `AppMessageHost.vue`).
- Skip-to-content link in layout (`frontend/src/components/core/layouts/Layout.vue`).

New components should keep these patterns.

---

## Common Mistakes

- Mutating props instead of emitting updates.
- Leaving emits untyped, causing payload drift across parent/child.
- Reusing modal state between openings without reset (`watch(() => props.open, ...)` is required for forms).
- Missing `Teleport` for modal overlays, which causes stacking/z-index and scroll issues.
