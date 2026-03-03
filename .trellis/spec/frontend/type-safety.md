# Type Safety

> Type safety patterns in this project.

---

## Overview

- Language: TypeScript across Vue SFCs and modules.
- Vue type-checking uses `vue-tsc` (`pnpm type-check`).
- Alias `@/*` maps to `src/*` in Vite and tsconfig.

---

## Type Organization

- API contracts live in `src/types/api/*.ts` by domain.
- Shared UI/runtime constants and derived unions live in `src/types/common/*.ts`.
- Router-specific types live in `src/types/router/*`.
- Component-level type contracts live in `src/types/component/*`.
- Store-local view models can be defined near the store when only locally needed.

Examples:
- `src/types/api/tasks.ts`
- `src/types/common/settings.ts`
- `src/stores/modules/user.ts` (`UserProfile`)

---

## Validation

Frontend runtime validation is lightweight and explicit:
- normalize external values (query/localStorage) through helper functions and type guards
- use typed constant arrays + derived union types (`as const`)
- rely on backend DTO/class-validator for authoritative request validation

Examples:
- `src/utils/ui-preferences.ts` (`asKnownValue` + resolvers)
- `src/types/common/settings.ts` (`SETTINGS_SECTIONS`, `isSettingsSection`)

---

## Common Patterns

- Typed composables and store return values.
- `withDefaults(defineProps<...>(), ...)` for optional props.
- Typed `defineEmits` signatures.
- Use `Record<string, unknown>` when payload keys are dynamic but still typed.

Examples:
- `src/components/settings/SettingsModal.vue`
- `src/components/tasks/TaskCreatePanel.vue`
- `src/utils/http/index.ts`

---

## Forbidden Patterns

- Using `any` for API payloads/responses where concrete types exist.
- Unchecked type assertions to force unknown route/query values.
- Untyped event emits and props in Vue components.
- Ad-hoc string literals for shared unions that already exist as constants/enums.
