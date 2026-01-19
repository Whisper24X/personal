-- Migration: Add interactive_session_step_state table for StepwiseDocumentGenerator step state management

-- Create step_state table
CREATE TABLE IF NOT EXISTS interactive_session_step_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  step_id VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, role, action, step_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_interactive_session_step_state_project_id 
ON interactive_session_step_state(project_id);

CREATE INDEX IF NOT EXISTS idx_interactive_session_step_state_role_action 
ON interactive_session_step_state(project_id, role, action);

CREATE INDEX IF NOT EXISTS idx_interactive_session_step_state_status 
ON interactive_session_step_state(status);

-- Add comments
COMMENT ON TABLE interactive_session_step_state IS 
'交互式会话步骤状态表，存储StepwiseDocumentGenerator的分步骤执行状态';

COMMENT ON COLUMN interactive_session_step_state.step_id IS 
'步骤ID（如outline, section-1, merge等）';

COMMENT ON COLUMN interactive_session_step_state.status IS 
'步骤状态: pending, running, completed, failed';
