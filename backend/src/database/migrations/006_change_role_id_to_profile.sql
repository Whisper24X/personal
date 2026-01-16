-- Migration: Change messages.role_id from UUID to VARCHAR(profile)
-- This migration converts role_id from UUID reference to role profile string
-- Date: 2025-01-XX

-- Step 1: Add temporary column for role profile
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS role_profile VARCHAR(100);

-- Step 2: Migrate existing data: convert role_id (UUID) to role profile
-- First, check if role_id column exists and is UUID type
DO $$
BEGIN
    -- Check if role_id column exists and is UUID type
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'role_id' 
        AND data_type = 'uuid'
    ) THEN
        -- For messages with role_id, get the profile from roles table
        UPDATE messages m
        SET role_profile = (
            SELECT r.profile
            FROM roles r
            WHERE r.id::text = m.role_id::text
        )
        WHERE m.role_id IS NOT NULL;
        
        -- Set role_profile to 'user' for messages without role_id (user messages)
        UPDATE messages
        SET role_profile = 'user'
        WHERE role_profile IS NULL;
    ELSE
        -- If role_id is already VARCHAR, just update NULL values to 'user'
        UPDATE messages
        SET role_id = 'user'
        WHERE role_id IS NULL;
    END IF;
END $$;

-- Step 3: Drop the old index on role_id
DROP INDEX IF EXISTS idx_messages_role_id;

-- Step 4: Drop the foreign key constraint (if it exists)
-- Note: PostgreSQL doesn't have a direct way to drop FK by name without knowing it,
-- so we'll use a more generic approach
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'messages'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%role_id%'
    ) LOOP
        EXECUTE 'ALTER TABLE messages DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Step 5: Drop the old role_id column
ALTER TABLE messages DROP COLUMN IF EXISTS role_id;

-- Step 6: Rename role_profile to role_id
ALTER TABLE messages RENAME COLUMN role_profile TO role_id;

-- Step 7: Create new index on role_id (now VARCHAR)
CREATE INDEX IF NOT EXISTS idx_messages_role_id ON messages(role_id);

-- Step 8: Add comment to explain the field
COMMENT ON COLUMN messages.role_id IS '角色类型 (profile): ProductManager, Architect, Engineer, QAEngineer, TeamLeader, Salesperson, DataAnalyst, user表示用户消息';
