## MODIFIED Requirements

### Requirement: WorkflowPromptLookup
Execution plugins SHALL load WORKFLOW_PROMPTS.md from the prepared workspace root only: explicit `workflowPromptsPath`, then `{workspacePath}/WORKFLOW_PROMPTS.md`, then `{workspacePath}/knowledge/WORKFLOW_PROMPTS.md`. Repository worktrees MUST NOT be searched.

#### Scenario: WorkflowAtWorkspaceRoot
- **WHEN** WORKFLOW_PROMPTS.md exists only at the workspace root
- **THEN** the execution plugin parses nodes from that file

### Requirement: ExecutorWorkspaceConstraint
Execution plugin CLI cwd MUST be `PreparedWorkspace.workspacePath` for multi-repo orchestration; template variables MUST include `reposRoot` and `reposList`.

#### Scenario: ExecuteFromWorkspaceRoot
- **WHEN** execution starts
- **THEN** CLI cwd is the workspace root, not a single repository path

## ADDED Requirements

### Requirement: PullRequestsBeforeDone
After quality passes, the system SHALL create pull requests per changed repository before transitioning to `done`, using per-repository default base branch detection.

#### Scenario: PrPerChangedRepo
- **WHEN** two repositories have local changes
- **THEN** two pull requests are created and recorded in `artifacts/prs.json`
