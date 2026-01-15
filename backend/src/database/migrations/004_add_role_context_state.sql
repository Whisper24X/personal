-- Migration: Add role_state and role_todo_action fields to interactive_session_running_state
-- These fields store RoleContext.state and RoleContext.todo values in the database

-- Add role_state column
ALTER TABLE interactive_session_running_state 
ADD COLUMN IF NOT EXISTS role_state INT;

-- Add role_todo_action column
ALTER TABLE interactive_session_running_state 
ADD COLUMN IF NOT EXISTS role_todo_action VARCHAR(100);

-- Add comments
COMMENT ON COLUMN interactive_session_running_state.role_state IS 
'RoleContext.state值：-1表示初始/终止状态，>=0表示当前执行的action索引（在BY_ORDER模式下）';

COMMENT ON COLUMN interactive_session_running_state.role_todo_action IS 
'RoleContext.todo对应的action名称：NULL表示无待执行action';
