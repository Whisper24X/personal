## ADDED Requirements

### Requirement: Stream task logs via SSE
The system SHALL expose an authenticated SSE endpoint for task log streaming by task id.

#### Scenario: Subscribe to task stream
- **WHEN** an authorized client connects to `/api/v1/tasks/:taskId/stream`
- **THEN** the system returns `text/event-stream` and pushes task-node log events in order

#### Scenario: Reject unauthorized subscription
- **WHEN** a user without visibility for the task attempts to subscribe
- **THEN** the system returns a forbidden response

### Requirement: Persist and replay task log events
The system SHALL persist task log events and support replay on reconnect.

#### Scenario: Persist emitted log events
- **WHEN** task execution emits runtime logs
- **THEN** the system stores log entries with task id, node id, level, and timestamp

#### Scenario: Replay recent logs on reconnect
- **WHEN** a client reconnects and requests logs for a task
- **THEN** the system emits persisted events before continuing with live events
