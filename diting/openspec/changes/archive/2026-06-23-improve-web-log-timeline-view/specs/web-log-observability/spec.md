## ADDED Requirements

### Requirement: Task Log Timeline View

The web console SHALL provide a unified task log timeline that combines task lifecycle transitions, execution logs, and live events into one linear view for the selected task.

#### Scenario: View latest task progress first

- **GIVEN** a user selects a task with lifecycle transitions, execution logs, and live events
- **WHEN** the task detail panel renders the log timeline
- **THEN** the timeline entries SHALL be normalized into one list
- **AND** the entries SHALL be ordered by event time with the newest entry first by default
- **AND** entries without an event time SHALL use a stable fallback order after timed entries.

#### Scenario: Switch to chronological replay

- **GIVEN** the task log timeline is visible
- **WHEN** the user switches from latest-first mode to from-start mode
- **THEN** the same timeline entries SHALL be ordered from earliest to latest
- **AND** switching back SHALL restore latest-first ordering without refetching data.

#### Scenario: Highlight problem signals

- **GIVEN** the task log timeline contains failed, error, retry, block, or success signals
- **WHEN** the entries render
- **THEN** failed, error, and stderr entries SHALL use danger styling
- **AND** retry or block entries SHALL use warning styling
- **AND** succeeded or completed entries SHALL use success styling.

### Requirement: Agent Run Log Recency

The web console SHALL make Agent and Run activity easier to inspect by ordering records by recent activity and showing the latest Agent log context in the run detail area.

#### Scenario: Show most recent runs first

- **GIVEN** the `Agents / Runs` page has multiple runs
- **WHEN** the run list renders
- **THEN** runs SHALL be ordered by recent activity with newest activity first
- **AND** recent activity SHALL prefer latest step or plugin event time, then `endedAt`, then `startedAt`.

#### Scenario: Show active agents before idle agents

- **GIVEN** the `Agents / Runs` page has active and idle agents
- **WHEN** the agent list renders
- **THEN** running or active agents SHALL appear before idle agents
- **AND** agents with the same activity class SHALL be ordered by their most recent related run activity.

#### Scenario: Display latest Agent log summary

- **GIVEN** a user selects a run that has step or log summary data
- **WHEN** the run detail panel renders
- **THEN** the detail panel SHALL show the latest step or log summary based on `endedAt` or `startedAt`
- **AND** failed or error summaries SHALL be visually highlighted
- **AND** the raw logs entry point SHALL remain available.

### Requirement: Realtime Log Refresh

The web console SHALL keep task, run, Agent, and raw log views updated when live events arrive.

#### Scenario: Refresh selected task and run after live event

- **GIVEN** the web console has an active `EventSource` connection
- **AND** a task or run is selected
- **WHEN** a live event message arrives
- **THEN** the console SHALL refresh global dashboard data
- **AND** it SHALL refresh the selected task detail data when a task is selected
- **AND** it SHALL refresh the selected run observability data when a run is selected.

#### Scenario: Refresh open raw logs after live event

- **GIVEN** the raw logs modal is open for a run
- **WHEN** a live event message arrives
- **THEN** the console SHALL refresh that run's raw logs using the current raw log query
- **AND** the visible raw log entries SHALL remain sorted with newest entries first.

### Requirement: Clear Log Styling

The web console SHALL present task timeline entries and raw log entries with readable spacing, source labels, status tones, and long-content handling.

#### Scenario: Render readable timeline entries

- **GIVEN** timeline entries include titles, messages, source labels, status tones, and timestamps
- **WHEN** the timeline renders
- **THEN** each entry SHALL show a readable title, message, time, source label, and tone indicator
- **AND** long messages SHALL wrap without breaking the page layout.

#### Scenario: Render readable raw log entries

- **GIVEN** raw logs include stdout, stderr, summary, event, or file entries
- **WHEN** the raw log modal renders
- **THEN** entries SHALL be sorted newest first
- **AND** source labels and parsed metadata SHALL remain visible
- **AND** stderr or error entries SHALL be visually distinct from informational entries.
