/**
 * Migration Script: Run Complete Schema
 * Drops all existing tables and creates new complete schema with all comments
 * 
 * Usage: npx ts-node src/database/migrations/run_complete_schema.ts
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

  console.log('🚀 Starting Complete Schema Migration...');
  console.log(`📍 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);

  try {
    // Step 1: Read and execute complete schema file
    // The SQL file already includes DROP statements, so we don't need to drop schema separately
    console.log('\n📦 Step 1: Executing complete schema SQL...');
    const schemaPath = path.join(__dirname, '000_complete_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    
    await pool.query(schemaSql);
    console.log('✅ Complete schema created successfully');

    // Step 2: Verify tables
    console.log('\n📦 Step 2: Verifying tables...');
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

    // Step 3: Verify comments
    console.log('\n📦 Step 3: Verifying table comments...');
    const commentResult = await pool.query(`
      SELECT 
        t.table_name,
        COUNT(c.column_name) as column_count,
        COUNT(CASE WHEN c.comment IS NOT NULL THEN 1 END) as commented_columns
      FROM information_schema.tables t
      LEFT JOIN (
        SELECT 
          table_name,
          column_name,
          col_description((table_schema||'.'||table_name)::regclass::oid, ordinal_position) as comment
        FROM information_schema.columns
        WHERE table_schema = 'public'
      ) c ON t.table_name = c.table_name
      WHERE t.table_schema = 'public' 
      AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name
      ORDER BY t.table_name;
    `);
    
    console.log(`✅ Table comment summary:`);
    commentResult.rows.forEach((row) => {
      const percentage = row.column_count > 0 
        ? Math.round((row.commented_columns / row.column_count) * 100) 
        : 0;
      console.log(`   ${row.table_name}: ${row.commented_columns}/${row.column_count} columns commented (${percentage}%)`);
    });

    console.log('\n🎉 Complete Schema Migration completed successfully!');

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
