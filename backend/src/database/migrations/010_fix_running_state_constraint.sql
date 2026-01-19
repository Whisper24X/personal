-- Migration: Fix missing unique constraints on interactive_session tables
-- This is needed for ON CONFLICT to work

-- ============================================================================
-- 1. Fix interactive_session_workflows unique constraint (project_id, role, action)
-- ============================================================================

-- Remove duplicate rows (keeping the newest one)
DELETE FROM interactive_session_workflows a 
USING interactive_session_workflows b 
WHERE a.created_at < b.created_at 
  AND a.project_id = b.project_id 
  AND a.role = b.role 
  AND a.action = b.action;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'interactive_session_workflows'::regclass 
        AND conname = 'interactive_session_workflows_project_id_role_action_key'
    ) THEN
        ALTER TABLE interactive_session_workflows 
        ADD CONSTRAINT interactive_session_workflows_project_id_role_action_key 
        UNIQUE (project_id, role, action);
        RAISE NOTICE 'Added unique constraint on interactive_session_workflows(project_id, role, action)';
    ELSE
        RAISE NOTICE 'Unique constraint on interactive_session_workflows(project_id, role, action) already exists';
    END IF;
END $$;

-- ============================================================================
-- 2. Fix interactive_session_running_state.project_id unique constraint
-- ============================================================================

-- First, remove any duplicate rows (keeping the newest one)
DELETE FROM interactive_session_running_state a 
USING interactive_session_running_state b 
WHERE a.created_at < b.created_at AND a.project_id = b.project_id;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'interactive_session_running_state'::regclass 
        AND conname = 'interactive_session_running_state_project_id_key'
    ) THEN
        ALTER TABLE interactive_session_running_state 
        ADD CONSTRAINT interactive_session_running_state_project_id_key UNIQUE (project_id);
        RAISE NOTICE 'Added unique constraint on interactive_session_running_state.project_id';
    ELSE
        RAISE NOTICE 'Unique constraint on interactive_session_running_state.project_id already exists';
    END IF;
END $$;

-- ============================================================================
-- 3. Fix interactive_session_step_state unique constraint
-- ============================================================================

-- Remove duplicate rows (keeping the newest one)
DELETE FROM interactive_session_step_state a 
USING interactive_session_step_state b 
WHERE a.created_at < b.created_at 
  AND a.project_id = b.project_id 
  AND a.role = b.role 
  AND a.action = b.action 
  AND a.step_id = b.step_id;

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'interactive_session_step_state'::regclass 
        AND conname = 'interactive_session_step_state_project_id_role_action_step_id_key'
    ) THEN
        ALTER TABLE interactive_session_step_state 
        ADD CONSTRAINT interactive_session_step_state_project_id_role_action_step_id_key 
        UNIQUE (project_id, role, action, step_id);
        RAISE NOTICE 'Added unique constraint on interactive_session_step_state';
    ELSE
        RAISE NOTICE 'Unique constraint on interactive_session_step_state already exists';
    END IF;
END $$;
