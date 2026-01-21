-- Migration: Add retry_count field to interactive_session_workflows
-- This field tracks the number of retry attempts for failed actions

-- Add retry_count column
ALTER TABLE interactive_session_workflows 
ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_interactive_session_workflows_retry_count 
ON interactive_session_workflows(project_id, role, action, retry_count);

-- Add comment
COMMENT ON COLUMN interactive_session_workflows.retry_count IS 
'重试次数：记录action失败后的重试次数，默认0，最大3次';
