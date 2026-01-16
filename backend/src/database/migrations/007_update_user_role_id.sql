-- Migration: Update user messages role_id from NULL to 'user'
-- This migration updates existing user messages that have NULL role_id to 'user'
-- Date: 2025-01-XX

-- Update all messages with NULL role_id to 'user'
UPDATE messages
SET role_id = 'user'
WHERE role_id IS NULL;

-- Add comment to explain the field (update existing comment)
COMMENT ON COLUMN messages.role_id IS '角色类型 (profile): ProductManager, Architect, Engineer, QAEngineer, TeamLeader, Salesperson, DataAnalyst, user表示用户消息';
