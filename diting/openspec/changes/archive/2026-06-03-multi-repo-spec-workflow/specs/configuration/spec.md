## ADDED Requirements

### Requirement: MultiRepoWorkspaceConfig
Server configuration SHALL support `DITING_PREFLIGHT_DEEP`, `DITING_SPEC_MAX_BYTES`, `DITING_WORKSPACE_OPENSPEC_INIT`, `DITING_WORKSPACE_SUPERPOWERS_INSTALL_CMD`, and `DITING_WORKSPACE_TOOLING_TIMEOUT_MS` for the multi-repo spec workflow.

#### Scenario: PreflightDeepEnv
- **WHEN** `DITING_PREFLIGHT_DEEP=true`
- **THEN** preflight downloads spec attachments to a temporary directory for WORKFLOW_PROMPTS validation
