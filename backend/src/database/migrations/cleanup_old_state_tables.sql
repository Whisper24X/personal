-- Migration: cleanup_old_state_tables.sql
-- Description: Clean up old state management tables after migration to workflow_executions
-- 
-- WARNING: Only run this script AFTER:
-- 1. All data has been migrated to workflow_executions
-- 2. The new system has been thoroughly tested
-- 3. You have verified no code depends on these tables
-- 
-- BACKUP YOUR DATABASE BEFORE RUNNING THIS SCRIPT!

-- Step 1: Verify migration is complete
-- Run this check first to ensure all projects have been migrated
DO $$
DECLARE
    old_count INTEGER;
    new_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT project_id) INTO old_count FROM interactive_session_workflows;
    SELECT COUNT(*) INTO new_count FROM workflow_executions;
    
    IF old_count > new_count THEN
        RAISE EXCEPTION 'Migration incomplete: % projects in old tables, only % in new table', old_count, new_count;
    END IF;
    
    RAISE NOTICE 'Migration verified: % projects in old tables, % in new table', old_count, new_count;
END $$;

-- Step 2: Create backup tables (optional but recommended)
-- CREATE TABLE interactive_session_workflows_backup AS SELECT * FROM interactive_session_workflows;
-- CREATE TABLE interactive_session_running_state_backup AS SELECT * FROM interactive_session_running_state;
-- CREATE TABLE interactive_session_step_state_backup AS SELECT * FROM interactive_session_step_state;

-- Step 3: Drop old tables
-- UNCOMMENT THE FOLLOWING LINES WHEN READY TO DELETE

-- Drop step state table first (no foreign keys depend on it)
-- DROP TABLE IF EXISTS interactive_session_step_state;

-- Drop running state table
-- DROP TABLE IF EXISTS interactive_session_running_state;

-- Drop workflow items table
-- DROP TABLE IF EXISTS interactive_session_workflows;

-- Step 4: Clean up any orphaned indexes (if they exist)
-- DROP INDEX IF EXISTS idx_interactive_session_workflows_project_id;
-- DROP INDEX IF EXISTS idx_interactive_session_running_state_project_id;
-- DROP INDEX IF EXISTS idx_interactive_session_step_state_project_id;

-- Step 5: Add comments to document the cleanup
-- COMMENT ON TABLE workflow_executions IS 'Unified workflow execution state table. Replaces interactive_session_workflows, interactive_session_running_state, and interactive_session_step_state.';
