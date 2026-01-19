-- Migration: Add role_order and action_order fields to interactive_session_workflows
-- Also ensure requires_confirmation and confirmation_role exist in interactive_session_running_state

-- Add role_order and action_order columns to interactive_session_workflows
ALTER TABLE interactive_session_workflows 
ADD COLUMN IF NOT EXISTS role_order INT,
ADD COLUMN IF NOT EXISTS action_order INT;

-- Add indexes for role_order and action_order
CREATE INDEX IF NOT EXISTS idx_interactive_session_workflows_role_order 
ON interactive_session_workflows(project_id, role_order);

CREATE INDEX IF NOT EXISTS idx_interactive_session_workflows_action_order 
ON interactive_session_workflows(project_id, role, action_order);

-- Ensure requires_confirmation and confirmation_role exist in interactive_session_running_state
ALTER TABLE interactive_session_running_state 
ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS confirmation_role VARCHAR(100);

-- Add index for confirmation queries
CREATE INDEX IF NOT EXISTS idx_interactive_session_running_state_confirmation 
ON interactive_session_running_state(project_id, requires_confirmation) 
WHERE requires_confirmation = TRUE;

-- Add comments
COMMENT ON COLUMN interactive_session_workflows.role_order IS '角色在工作流中的执行顺序（从0开始）';
COMMENT ON COLUMN interactive_session_workflows.action_order IS 'Action在角色中的执行顺序（从0开始）';
COMMENT ON COLUMN interactive_session_running_state.requires_confirmation IS '是否需要人工确认，TRUE表示当前角色最后一个Action已完成，等待人工确认';
COMMENT ON COLUMN interactive_session_running_state.confirmation_role IS '等待确认的角色名称';
