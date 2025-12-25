/**
 * PostgreSQL Database Client
 * Using node-postgres connection pool
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../utils';

let pool: Pool | null = null;

/**
 * Get PostgreSQL connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DB_POOL_MAX || '10'),
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Log pool errors
    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
    });

    logger.info('PostgreSQL connection pool initialized');
  }

  return pool;
}

/**
 * Connect to database
 */
export async function connectDatabase(): Promise<void> {
  const client = getPool();
  
  try {
    await client.query('SELECT NOW()');
    logger.info('✅ Database connected successfully');
  } catch (error: any) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('✅ Database disconnected');
  }
}

/**
 * Check database connection
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = getPool();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a query
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = getPool();
  return await client.query<T>(text, params);
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return await pool.connect();
}

/**
 * Execute queries in a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default getPool;
