/**
 * Migration Script: Add name_alias field to projects
 * 
 * Usage: npx tsx src/database/migrations/run_004_add_name_alias_to_projects.ts
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

  console.log('🚀 Starting Migration: Add name_alias field to projects...');
  console.log(`📍 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);

  try {
    // Check if column already exists
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects'
        AND column_name = 'name_alias'
      );
    `);

    if (checkResult.rows[0].exists) {
      console.log('ℹ️  Column name_alias already exists in projects, skipping...');
    } else {
      // Read and execute migration file
      console.log('\n📦 Adding name_alias column to projects...');
      const migrationPath = path.join(__dirname, '004_add_name_alias_to_projects.sql');
      const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
      
      await pool.query(migrationSql);
      console.log('✅ name_alias column added successfully');
    }

    // Verify column
    console.log('\n📦 Verifying projects.name_alias column...');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'projects' AND column_name = 'name_alias';
    `);
    
    if (result.rows.length > 0) {
      const col = result.rows[0];
      console.log(`✅ Column: ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
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
