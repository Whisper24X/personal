# Component Guidelines

> How components are built in this project.

---

## Overview

- Standard component style is Vue 3 Composition API with `<script setup lang="ts">`.
- Components are strongly typed with `defineProps`, `defineEmits`, and local TS types.
- Tailwind utility classes are primary styling method; scoped CSS is used for special animations/effects.

---

## Component Structure

Expected order in `.vue` files:
1. `<script setup lang="ts">`
2. `defineOptions({ name: '...' })` when useful for DevTools clarity
3. typed props/emits and composition logic
4. `<template>`
5. optional `<style scoped>` for component-specific effects

Examples:
- `src/components/settings/SettingsModal.vue`
- `src/components/tasks/TaskCreateModal.vue`
- `src/components/tasks/TaskCreatePanel.vue`

---

## Props Conventions

- Type props inline with `defineProps<...>()`.
- Use `withDefaults(...)` for optional props and explicit defaults.
- Type emits with `defineEmits` function signatures.

Examples:
- `TaskCreatePanel.vue`: typed `projectId?` with default
- `TaskCreateModal.vue`: typed `open` + optional `projectId`
- `SettingsModal.vue`: typed section events (`update:open`, `select-section`)

---

## Styling Patterns

- Prefer Tailwind utility classes in template markup.
- Use design tokens from theme variables (`bg-background`, `text-foreground`, etc.).
- Keep scoped CSS only for non-trivial animations/background effects.

Examples:
- Utility-first classes across `SettingsModal.vue` and `TaskCreateModal.vue`
- Scoped animation block in `TaskCreatePanel.vue`
- Rich scoped auth visuals in `views/login/index.vue`

---

## Accessibility

- Dialog-like components use `role="dialog"`, `aria-modal`, and labeled titles.
- Action-only icon buttons include `aria-label`.
- Keyboard close behavior is supported on modal overlays (`@keydown.esc`).

Examples:
- `src/components/tasks/TaskCreateModal.vue`
- `src/components/settings/SettingsModal.vue`

---

## Common Mistakes

- Leaving props or emits untyped.
- Embedding raw fetch/API calls directly in deeply nested presentational components.
- Duplicating modal behavior instead of extracting reusable patterns.
- Using long scoped CSS blocks for styles that should be utility classes.
