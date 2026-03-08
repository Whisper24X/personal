# Scope project roles under business lines

## Goal
Move project custom-role management from global/project scope to business-line scope so each business line owns its own project-role library, and projects under that business line choose from that library.

## Requirements
- Persist project custom roles with `businessLineId` instead of `projectId`.
- Keep project member assignment based on mounted roles for each project.
- Restrict role CRUD/list operations to the current project's business line.
- Expose/update frontend flows so business-line settings manage the project-role library for the selected business line.
- Preserve mounted role validation when replacing project role mounts.

## Acceptance Criteria
- [ ] Backend project custom-role data model is scoped by business line.
- [ ] Project role APIs only return roles from the project's business line.
- [ ] Business-line settings UI reflects business-line scoped project roles.
- [ ] Project member role assignment still works with mounted roles.
- [ ] Targeted lint/type checks pass for touched files.

## Technical Notes
- This is a cross-layer change touching migration/entity/repository/service/controller/frontend API and views.
- Keep changes minimal and avoid disturbing unrelated in-progress work on the branch.
