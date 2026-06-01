/**
 * Migration Script: Initialize Database Schema
 * Executes the complete schema from ainative.sql
 * 
 * Usage: npx tsx src/database/migrations/run_schema_v2.ts
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

  console.log('🚀 Starting Database Schema Initialization...');
  console.log(`📍 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);

  try {
    // Step 1: Read and execute schema file
    // The ainative.sql file already contains DROP TABLE statements
    console.log('\n📦 Step 1: Executing schema from ainative.sql...');
    const schemaPath = path.join(__dirname, 'ainative.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    
    await pool.query(schemaSql);
    console.log('✅ Schema executed successfully');

    // Step 2: Verify tables
    console.log('\n📦 Step 2: Verifying tables...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log(`✅ Found ${result.rows.length} tables:`);
    result.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.table_name}`);
    });

    console.log('\n🎉 Database Schema Initialization completed successfully!');

  } catch (error: any) {
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
