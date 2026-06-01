/**
 * Migration Script: Add version_id column to messages table
 * This enables version isolation and deduplication of messages
 * 
 * Usage: npx tsx src/database/migrations/add_version_id_to_messages.ts
 */

import { Pool } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('🚀 Starting Migration: Add version_id to messages table...');
  console.log(`📍 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);

  try {
    // Check if column already exists
    const checkResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'messages' 
        AND column_name = 'version_id';
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Column version_id already exists in messages table, skipping migration');
      return;
    }

    // Start transaction
    await pool.query('BEGIN');

    // Step 1: Add version_id column
    console.log('\n📦 Step 1: Adding version_id column...');
    await pool.query(`
      ALTER TABLE messages 
      ADD COLUMN version_id uuid;
    `);
    console.log('✅ Added version_id column');

    // Step 2: Add comment
    console.log('\n📦 Step 2: Adding column comment...');
    await pool.query(`
      COMMENT ON COLUMN "public"."messages"."version_id" 
      IS '关联的项目版本ID（外键关联project_versions表，用于消息隔离）';
    `);
    console.log('✅ Added column comment');

    // Step 3: Add indexes for performance
    console.log('\n📦 Step 3: Adding indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_version 
      ON public.messages USING btree (project_id, version_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_dedup 
      ON public.messages USING btree (project_id, version_id, role_profile, cause_by, created_at DESC);
    `);
    console.log('✅ Added indexes');

    // Commit transaction
    await pool.query('COMMIT');

    console.log('\n🎉 Migration completed successfully!');
    console.log('Note: Existing messages will have NULL version_id. New messages will have version_id set.');

  } catch (error: any) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
