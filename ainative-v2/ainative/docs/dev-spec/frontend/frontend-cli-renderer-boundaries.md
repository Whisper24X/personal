# Frontend CLI Renderer Boundaries

## Scope

- Path: `frontend/src/components/tasks/detail/cli`

## Constraints

- Each agent CLI renderer owns its own UI components inside its own directory, for example `codex/`, `claude-code/`, `gemini/`, `cursor-agent/`, `opencode/`.
- Do not place renderer UI components in a shared `cli/components` directory.
- Do not import renderer UI components across agent directories, for example `gemini` must not import `claude-code/TaskGroupCard.vue`.
- Shared code in `cli` is limited to non-UI primitives with stable semantics, such as parser/grouping utilities, shared types, and pure helper functions.
- If two agent CLIs currently look similar, still prefer separate UI components first. Only extract a shared abstraction after the UI contract is proven stable across agents.
- Agent-specific presentation differences, including timestamp policy, card layout, tool-item rendering, and message styling, must be implemented inside that agent's own directory.

## Intent

- Keep renderer ownership clear.
- Prevent one agent's UI requirements from distorting another agent's renderer.
- Make agent-specific changes safe, local, and easy to review.
