import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

console.log('DATABASE_URL:', process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function test() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ 数据库连接成功！', result.rows[0]);
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    process.exit(1);
  }
}

test();

