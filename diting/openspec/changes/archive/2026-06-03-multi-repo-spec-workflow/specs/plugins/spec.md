## ADDED Requirements

### Requirement: MultiRepoWorkspaceLayout
The environment plugin SHALL prepare one git worktree per repository under `{workspacePath}/repos/<slug>/` sharing the same task branch, and SHALL set `PreparedWorkspace.repos` with per-repo paths and cache paths.

#### Scenario: TwoReposPrepared
- **WHEN** `metadata.repos` lists two repository URLs
- **THEN** `prepareWorkspace` creates two worktrees under `repos/` and sets `repoPath` to the first repository path

### Requirement: SpecDocumentMaterialization
The environment plugin SHALL materialize Feishle field spec attachments into the workspace root before execution, renaming on collision with `{basename}-{n}{ext}` without overwriting.

#### Scenario: SpecZipExtracted
- **WHEN** a spec attachment is a zip archive
- **THEN** contents are extracted to the workspace root with zip-slip protection

### Requirement: SpecSkillsLoad
After spec materialization, the environment plugin SHALL discover `SKILL.md` under `skills/` or `.cursor/skills/` and merge into `{workspacePath}/.cursor/skills/` for CLI discovery.

#### Scenario: SkillsMerged
- **WHEN** spec contains `skills/demo/SKILL.md`
- **THEN** `.cursor/skills/demo/SKILL.md` exists in the workspace

### Requirement: TaskPreflightBeforeWorkspace
Before `prepareWorkspace`, the system SHALL run task preflight validating repository list, spec attachments, and WORKFLOW_PROMPTS compliance; failure MUST transition the task to `blocked` without creating a workspace directory.

#### Scenario: PreflightBlocksMissingSpec
- **WHEN** spec attachments are empty
- **THEN** the task is `blocked` and no worktree is created
