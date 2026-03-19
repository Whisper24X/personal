# Unify Custom Select Component

## Goal
Replace all native dropdown selectors in `frontend/src` with one shared custom `Select` component so the UI looks consistent and no longer depends on system-native dropdown styling.

## Requirements
- Add one reusable Vue 3 select component that supports:
  - string, boolean, and `null` option values
  - grouped options
  - disabled state
  - keyboard navigation
  - outside click close
- Replace all existing native `<select>` usages under `frontend/src`.
- Keep current business behavior and default values unchanged.

## Acceptance Criteria
- [x] No native `<select>` remains in `frontend/src`.
- [x] Frontend type-check passes.
- [x] Related unit tests pass after the migration.
- [x] Frontend lint passes.

## Technical Notes
- Implemented as `frontend/src/components/core/AppSelect.vue`.
- Shared option types live in `frontend/src/types/component/select.ts`.
- Existing tests were updated to interact with the custom dropdown instead of calling `setValue()` on native selects.
