# Refactor Skill And MCP Management

## Goal
Refactor skill and MCP management so both business-line level and project level can manage and load local configurations consistently.

## Requirements
- Add business-line management entry between the "Workflow" and "Settings" sections in the business-line modal.
- Business-line skill and MCP management must load from local folder configuration.
- Business-line local storage paths:
  - skills: `.ainative/data/{{business_line_id}}/skills`
  - mcp: `.ainative/data/{{business_line_id}}/mcp`
- Project-level skill and MCP management must load from the current project's local agent CLI configurations.
- Project-level sources should resolve actual skill and MCP config locations used by agent CLIs in project folders (typically `.codex`, `.cursor`, etc.).

## Acceptance Criteria
- [ ] Business-line modal renders a new section between Workflow and Settings for skill/MCP management.
- [ ] Business-line section reads and displays skill configs from `.ainative/data/<business_line_id>/skills`.
- [ ] Business-line section reads and displays MCP configs from `.ainative/data/<business_line_id>/mcp`.
- [ ] Project-level management reads skill/MCP configuration from current project local agent directories (including `.codex` and `.cursor` when present).
- [ ] Existing workflow/settings behavior remains unchanged.

## Technical Notes
- Frontend stack: Vue 3 + TypeScript + Composition API.
- Follow existing modal/composable patterns and typed API contracts.
- Prefer additive changes with minimal regression risk in existing business-line/project UI flows.
