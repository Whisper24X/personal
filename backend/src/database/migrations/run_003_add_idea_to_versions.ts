/**
 * Migration Script: Add idea field to project_versions
 * 
 * Usage: npx ts-node src/database/migrations/run_003_add_idea_to_versions.ts
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

  console.log('🚀 Starting Migration: Add idea field to project_versions...');
  console.log(`📍 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);

  try {
    // Check if column already exists
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'project_versions'
        AND column_name = 'idea'
      );
    `);

    if (checkResult.rows[0].exists) {
      console.log('ℹ️  Column idea already exists in project_versions, skipping...');
    } else {
      // Read and execute migration file
      console.log('\n📦 Adding idea column to project_versions...');
      const migrationPath = path.join(__dirname, '003_add_idea_to_versions.sql');
      const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
      
      await pool.query(migrationSql);
      console.log('✅ idea column added successfully');
    }

    // Verify column in project_versions
    console.log('\n📦 Verifying project_versions.idea column...');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'project_versions' AND column_name = 'idea';
    `);
    
    if (result.rows.length > 0) {
      const col = result.rows[0];
      console.log(`✅ Column: ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    }

    // Verify projects.idea is now nullable
    console.log('\n📦 Verifying projects.idea is nullable...');
    const projectsResult = await pool.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'idea';
    `);
    
    if (projectsResult.rows.length > 0) {
      const col = projectsResult.rows[0];
      console.log(`✅ projects.idea nullable: ${col.is_nullable}`);
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
