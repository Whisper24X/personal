/**
 * Migration Script: Add project_versions table
 * 
 * Usage: npx ts-node src/database/migrations/run_001_project_versions.ts
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

  console.log('🚀 Starting Migration: Add project_versions table...');
  console.log(`📍 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);

  try {
    // Check if table already exists
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'project_versions'
      );
    `);

    if (checkResult.rows[0].exists) {
      console.log('ℹ️  Table project_versions already exists, skipping...');
      return;
    }

    // Read and execute migration file
    console.log('\n📦 Creating project_versions table...');
    const migrationPath = path.join(__dirname, '001_add_project_versions.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    
    await pool.query(migrationSql);
    console.log('✅ project_versions table created successfully');

    // Verify table
    console.log('\n📦 Verifying table...');
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'project_versions'
      ORDER BY ordinal_position;
    `);
    
    console.log(`✅ Table has ${result.rows.length} columns:`);
    result.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.column_name} (${row.data_type})`);
    });

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
