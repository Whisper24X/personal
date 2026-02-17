## 1. Data Model and Migration

- [x] 1.1 Add TypeORM migrations for projects and project_members tables
- [x] 1.2 Add TypeORM migrations for workflow_templates and workflow_template_versions tables
- [x] 1.3 Add TypeORM migrations for tasks, task_nodes, and task_logs tables

## 2. Project and Membership Modules

- [x] 2.1 Implement `ProjectsModule` with CRUD and config_json persistence
- [x] 2.2 Implement `ProjectMembersModule` with add/update/remove/list APIs
- [x] 2.3 Enforce business-line and project role permission checks in services

## 3. Workflow Template Module

- [x] 3.1 Implement workflow template CRUD with ordered node schema validation
- [x] 3.2 Implement template publish endpoint and immutable version snapshots
- [x] 3.3 Support querying template versions for task creation

## 4. Task Execution Pipeline

- [x] 4.1 Implement task creation from template version snapshot with node instantiation
- [x] 4.2 Implement task execute/retry/cancel endpoints and state transition guards
- [x] 4.3 Implement task status aggregation logic based on task node statuses

## 5. Task Log Streaming

- [x] 5.1 Implement task log persistence model and repository operations
- [x] 5.2 Implement process-local task log event bus for live publishing
- [x] 5.3 Implement authenticated SSE endpoint `/api/v1/tasks/:taskId/stream` with replay

## 6. Integration and Verification

- [x] 6.1 Wire new modules into `AppModule` and dependency graph
- [x] 6.2 Add/extend e2e tests for projects, templates, tasks, and SSE auth behavior
- [x] 6.3 Run lint/build/tests and fix implementation issues in touched modules
