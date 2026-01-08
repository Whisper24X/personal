-- Interactive Session Workflow Migration
-- Store workflow state for interactive sessions

CREATE TABLE IF NOT EXISTS interactive_session_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  role VARCHAR(100) NOT NULL,
  action VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, role, action)
);

CREATE INDEX IF NOT EXISTS idx_interactive_session_workflows_session_id ON interactive_session_workflows(session_id);
CREATE INDEX IF NOT EXISTS idx_interactive_session_workflows_project_id ON interactive_session_workflows(project_id);
CREATE INDEX IF NOT EXISTS idx_interactive_session_workflows_status ON interactive_session_workflows(status);
CREATE INDEX IF NOT EXISTS idx_interactive_session_workflows_role ON interactive_session_workflows(role);

-- Table to store current running state
CREATE TABLE IF NOT EXISTS interactive_session_running_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID UNIQUE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  "current_role" VARCHAR(100),
  "current_action" VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interactive_session_running_state_session_id ON interactive_session_running_state(session_id);
CREATE INDEX IF NOT EXISTS idx_interactive_session_running_state_project_id ON interactive_session_running_state(project_id);

COMMENT ON TABLE interactive_session_workflows IS 'Stores all roles and actions in the workflow for an interactive session';
COMMENT ON TABLE interactive_session_running_state IS 'Stores the current running role and action for an interactive session';

