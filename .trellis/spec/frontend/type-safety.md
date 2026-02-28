# Type Safety

> Type safety patterns in this project.

---

## Overview

Frontend is TypeScript-first (`vue-tsc --build` in CI/local workflow). Most public contracts are typed, especially API payloads and store interfaces.

---

## Type Organization

Primary type locations:
- API contracts: `frontend/src/types/api/*`
- Router/meta contracts: `frontend/src/types/router/*`
- UI contracts: `frontend/src/types/component/*`
- Common app constants/types: `frontend/src/types/common/*`

Note: some API files still co-locate types with methods (for example `frontend/src/api/business-lines.ts`). This is an accepted current pattern; extract only when shared reuse grows.

---

## Validation

Runtime validation on frontend is lightweight and mostly form-level checks inside components/hooks.

Examples:
- Login/register checks in `frontend/src/views/login/index.vue`
- Modal submit checks in `frontend/src/components/business/settings/modals/ProjectFormModal.vue`

Backend DTO validation is considered source of truth for strict request validation.

---

## Common Patterns

- Generic API wrappers: `apiHttp.get<T>()`, `apiHttp.post<T>()`
- Pagination generics: `InfinityPaginationResponse<T>`
- Narrow unions for role/status fields (for example project/business-line role strings)
- Typed emits payloads in Vue components

Examples:
- `frontend/src/api/http.ts`
- `frontend/src/utils/pagination/index.ts`
- `frontend/src/stores/modules/user.ts`

---

## Forbidden Patterns

- `any` for public API payloads or store state.
- Unsafe casts (`as unknown as`) to bypass missing type modeling.
- Unscoped string literals for permission/role values when a union type already exists.
- Untyped `defineEmits` for complex payload events.
