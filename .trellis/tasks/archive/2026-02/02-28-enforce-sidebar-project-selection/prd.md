# Enforce Sidebar Project Selection

## Goal
Ensure the main page left sidebar always has a selected project when projects exist.

## Requirements
- When project list is non-empty, one project must always be selected.
- If no explicit selection exists, default to a valid project automatically.
- If selected project becomes invalid (deleted/not in list), fallback to a valid project.
- Keep existing behavior when no projects are available (no forced selection).

## Acceptance Criteria
- [ ] With 1+ projects available, sidebar never shows an empty project selection state.
- [ ] On initial load with projects and no previous selection, the first valid project is selected.
- [ ] After project list updates and current selection is invalid, sidebar auto-selects a valid project.
- [ ] Existing navigation and data loading continue to work with selected project.

## Technical Notes
- Frontend Vue 3 + Composition API implementation.
- Prefer existing `useLayout` and sidebar state flow.
- Avoid introducing global state changes unless already required by current architecture.
