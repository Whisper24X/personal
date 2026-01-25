/**
 * Migration Script: Run Schema V2
 * Drops all existing tables and creates new schema
 * 
 * Usage: npx ts-node src/database/migrations/run_schema_v2.ts
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

  console.log('🚀 Starting Schema V2 Migration...');
  console.log(`📍 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);

  try {
    // Step 1: Drop and recreate public schema
    console.log('\n📦 Step 1: Dropping all existing tables...');
    await pool.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      GRANT ALL ON SCHEMA public TO postgres;
      GRANT ALL ON SCHEMA public TO public;
    `);
    console.log('✅ All tables dropped');

    // Step 2: Read and execute schema file
    console.log('\n📦 Step 2: Creating new schema...');
    const schemaPath = path.join(__dirname, '000_schema_v2.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    
    await pool.query(schemaSql);
    console.log('✅ New schema created successfully');

    // Step 3: Verify tables
    console.log('\n📦 Step 3: Verifying tables...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log(`✅ Created ${result.rows.length} tables:`);
    result.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.table_name}`);
    });

    console.log('\n🎉 Schema V2 Migration completed successfully!');

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
