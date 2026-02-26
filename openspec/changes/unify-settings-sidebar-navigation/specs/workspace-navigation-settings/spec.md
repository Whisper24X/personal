## ADDED Requirements

### Requirement: Sidebar menu SHALL separate project navigation from workspace settings
The system SHALL keep the left sidebar two-column structure, where column one is for project selection and column two is for project-scoped navigation only. Workspace-management entries MUST NOT appear in column two.

#### Scenario: Rendering project-scoped menu
- **WHEN** a user opens the application layout
- **THEN** column two shows only project-scoped entries (such as dashboard/workflow/tasks/kanban/automations/skills/mcp)
- **AND** `about`, `business-lines`, `projects`, and `users` are not shown in column two

### Requirement: Settings SHALL provide a unified modal hub with grouped capabilities
The system SHALL provide a global Settings modal entry from the sidebar and MUST group settings-related capabilities by function, including About, Business Lines, Projects, Users, and existing personal/notification settings.

#### Scenario: Opening settings from sidebar
- **WHEN** a user clicks the sidebar settings button
- **THEN** the system opens a Settings modal instead of navigating to a standalone settings page
- **AND** the modal shows grouped sections with permission-aware visibility

#### Scenario: Accessing management capabilities inside settings
- **WHEN** a user selects a settings group for `about`, `business-lines`, `projects`, or `users`
- **THEN** the corresponding management capability is available within the Settings modal context

### Requirement: Home menu item SHALL be removable from default navigation
The system SHALL support removing `home` from default sidebar menu presentation so that it does not occupy a primary navigation slot unless explicitly enabled by configuration.

#### Scenario: Default menu without home
- **WHEN** the sidebar menu is built with default configuration
- **THEN** `home` is not included in column two menu items

### Requirement: Legacy settings-related routes SHALL remain backward compatible during migration
The system SHALL preserve access from legacy routes (`/settings`, `/about`, `/business-lines`, `/projects`, `/users`, and `/home`) by redirecting to a supported route and opening the corresponding Settings modal section when applicable.

#### Scenario: Visiting a legacy settings-related route
- **WHEN** a user directly visits a legacy route such as `/users`
- **THEN** the system redirects to the supported host route
- **AND** opens the Settings modal focused on the mapped section

#### Scenario: Permission-restricted legacy route mapping
- **WHEN** a non-admin user visits a legacy admin-only route mapping (for example `users`)
- **THEN** the system does not expose an unauthorized settings section
- **AND** falls back to the first authorized settings section
