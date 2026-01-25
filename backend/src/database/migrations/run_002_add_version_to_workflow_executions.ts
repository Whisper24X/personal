/**
 * Migration Script: Add version_id to workflow_executions table
 * 
 * Usage: npx ts-node src/database/migrations/run_002_add_version_to_workflow_executions.ts
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('🚀 Starting Migration: Add version_id to workflow_executions...');
  console.log(`📍 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);

  try {
    // Check if column already exists
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'workflow_executions'
        AND column_name = 'version_id'
      );
    `);

    if (checkResult.rows[0].exists) {
      console.log('ℹ️  Column version_id already exists, skipping...');
      return;
    }

    // Check if project_versions table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'project_versions'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.error('❌ project_versions table does not exist. Run 001_add_project_versions.sql first.');
      process.exit(1);
    }

    // Read and execute migration file
    console.log('\n📦 Adding version_id column to workflow_executions...');
    const migrationPath = path.join(__dirname, '002_add_version_to_workflow_executions.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    
    await pool.query(migrationSql);
    console.log('✅ version_id column added successfully');

    // Verify column
    console.log('\n📦 Verifying column...');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'workflow_executions'
      AND column_name = 'version_id';
    `);
    
    if (result.rows.length > 0) {
      const col = result.rows[0];
      console.log(`✅ Column: ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    }

    // Check for existing records without version_id
    const orphanCheck = await pool.query(`
      SELECT COUNT(*) as count FROM workflow_executions WHERE version_id IS NULL;
    `);
    
    if (parseInt(orphanCheck.rows[0].count) > 0) {
      console.log(`\n⚠️  Warning: ${orphanCheck.rows[0].count} workflow execution(s) have NULL version_id.`);
      console.log('   These records need to be migrated or deleted.');
    }

    console.log('\n🎉 Migration completed successfully!');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
