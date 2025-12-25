/**
 * Database Migration Runner
 * Executes SQL migration files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getPool } from '../client';
import { logger } from '../../utils';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function runMigrations() {
  const pool = getPool();
  const migrationsDir = __dirname;
  
  try {
    logger.info('🔄 Running database migrations...');
    
    // Read all .sql files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const file of files) {
      logger.info(`   Executing: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await pool.query(sql);
      logger.info(`   ✅ ${file} completed`);
    }
    
    logger.info('✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();

