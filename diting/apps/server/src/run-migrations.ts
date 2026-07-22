/**
 * CLI：仅验证连接并执行 `schema_migrations` 管理的 SQL 迁移，供部署或运维脚本调用。
 */
import { createDatabase } from "./diting/database";
import { runMigrations } from "./diting/migration-runner";
import { formatStartupError, verifyDatabaseConnection } from "./diting/startup-errors";

async function main(): Promise<void> {
  const database = createDatabase();
  try {
    await verifyDatabaseConnection(database.pool);
    await runMigrations(database.pool);
  } catch (error) {
    console.error(formatStartupError(error));
    process.exitCode = 1;
  } finally {
    await database.pool.end();
  }
}

void main();
