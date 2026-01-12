-- ============================================================================
-- Migration: 添加确认状态字段到 interactive_session_running_state 表
-- 创建日期: 2025-01-XX
-- ============================================================================

-- 添加确认状态相关字段
ALTER TABLE interactive_session_running_state 
ADD COLUMN IF NOT EXISTS requires_confirmation BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS confirmation_role VARCHAR(100);

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_interactive_session_running_state_confirmation 
ON interactive_session_running_state(project_id, requires_confirmation) 
WHERE requires_confirmation = TRUE;

-- 添加注释
COMMENT ON COLUMN interactive_session_running_state.requires_confirmation IS '是否需要人工确认，TRUE表示当前角色所有Action已完成，等待人工确认';
COMMENT ON COLUMN interactive_session_running_state.confirmation_role IS '等待确认的角色名称';

