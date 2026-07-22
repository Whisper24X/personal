## ADDED Requirements

### Requirement: PreflightBlockedState
When task preflight fails, the task MUST transition to `blocked` with `metadata.preflight` describing failed checks, and MUST remain recoverable via `blocked` to `queued`.

#### Scenario: BlockedAfterPreflight
- **WHEN** preflight reports `passed: false`
- **THEN** task status is `blocked` and scheduler does not call `prepareWorkspace`
