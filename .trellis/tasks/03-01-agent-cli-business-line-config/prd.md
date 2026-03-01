# Add agent cli business-line config support

## Goal
Add configuration capability for agent CLI by referencing the `agent_tool_configs` design from the `vibework` project, so agent CLI can load and apply business-line-related settings during execution.

## Requirements
- Inspect `/Users/fuzhifei/code/go/src/github.com/fzf-labs/vibework` for `agent_tool_configs` data model and loading pattern.
- Add equivalent configuration structure in current project with business-line association.
- Ensure agent CLI loads relevant configuration at runtime before tool execution.
- Keep compatibility with existing CLI behavior when no business-line config is provided.

## Acceptance Criteria
- [ ] Agent CLI supports reading business-line-related tool config.
- [ ] Runtime behavior uses loaded config during execution path.
- [ ] Existing flow without new config still works.
- [ ] Basic validation or fallback is in place for missing/invalid config.

## Technical Notes
- Treat this as backend/CLI task.
- Follow existing config loading and dependency injection patterns in this repo.
