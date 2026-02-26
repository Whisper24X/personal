## 1. Navigation Domain Refactor

- [x] 1.1 Update `frontend/src/hooks/core/useLayout.ts` to remove `home/about/business-lines/projects/users` from default second-column menu and keep only project-scoped items.
- [x] 1.2 Add explicit menu policy for `home` (default hidden/removable) and align breadcrumb mapping for the new structure.
- [x] 1.3 Update `frontend/src/components/core/layouts/Sidebar.vue` labels/interactions to reflect project-domain-only second-column navigation.

## 2. Settings Modal Hub

- [x] 2.1 Create a new Settings modal container component and mount it in `frontend/src/components/core/layouts/Layout.vue`.
- [x] 2.2 Extend `useLayout` state/actions with `settingsModalOpen`, `settingsSection`, `openSettings(section?)`, and `closeSettings()`.
- [x] 2.3 Refactor current `frontend/src/views/settings/index.vue` content into reusable sections suitable for modal rendering (profile, security, notifications, UI density).

## 3. Settings Group Consolidation

- [x] 3.1 Define grouped Settings sections: About, Business Lines, Projects, Users, and Personal Settings.
- [x] 3.2 Integrate existing capabilities for `about/business-lines/projects/users` into Settings modal panels with permission-based visibility.
- [x] 3.3 Replace direct sidebar route navigation for Settings with modal opening behavior while preserving accessibility (keyboard close, focus management).

## 4. Routing and Compatibility

- [x] 4.1 Update `frontend/src/router/routes/system.ts` to add compatibility redirects from `/settings`, `/about`, `/business-lines`, `/projects`, `/users`, and `/home` to supported host route + settings section mapping.
- [x] 4.2 Implement query/route synchronization so direct legacy links open the mapped Settings modal section.
- [x] 4.3 Update existing in-app links (e.g., dashboard/automations references to `/settings`) to use the new modal/deep-link behavior.

## 5. Validation and Hardening

- [x] 5.1 Verify permission behavior for admin-only groups (especially `users`) and fallback section selection for non-admin users.
- [x] 5.2 Add/update component or e2e tests for sidebar menu composition, settings modal opening, and legacy route mapping.
- [x] 5.3 Run project checks (lint/type-check/tests) and capture migration notes for rollout and rollback.
