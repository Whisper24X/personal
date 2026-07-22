import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Client } from 'pg';
import {
  DatabaseIsolationConfig,
  PostgresConnectionConfig,
  TableInfo,
} from './types/database-isolation.types';

@Injectable()
export class DatabaseIsolationService {
  private readonly logger = new Logger(DatabaseIsolationService.name);

  async ensureTaskDatabase(
    config: DatabaseIsolationConfig,
    adminPassword: string,
    taskDbName: string,
    tables?: string[],
  ): Promise<void> {
    const { host, port, adminUser, sourceDatabase } = config.postgres;

    await this.withTaskDatabaseLock(
      host,
      port,
      adminUser,
      adminPassword,
      taskDbName,
      async (client) => {
        const exists = await this.databaseExists(client, taskDbName);
        if (exists) {
          this.logger.log(`database_already_exists db=${taskDbName}`);
          return;
        }

        this.logger.log(
          `creating_task_database db=${taskDbName} source=${sourceDatabase}`,
        );

        await client.query(
          `CREATE DATABASE "${taskDbName.replace(/"/g, '""')}"`,
        );

        const tmpDir = await mkdtemp(join(tmpdir(), `task_db_${taskDbName}_`));
        try {
          const pgEnv = { ...process.env, PGPASSWORD: adminPassword };
          const connArgs = ['-h', host, '-p', String(port), '-U', adminUser];
          const schemaFile = join(tmpDir, 'schema.sql');

          await this.runExecFile(
            'pg_dump',
            [
              ...connArgs,
              '--schema-only',
              '--no-owner',
              '--no-acl',
              '-f',
              schemaFile,
              sourceDatabase,
            ],
            pgEnv,
          );

          await this.runExecFile(
            'psql',
            [...connArgs, '-f', schemaFile, taskDbName],
            pgEnv,
          );

          const importTables = tables ?? config.dataImport?.tables;
          if (importTables && importTables.length > 0) {
            const dataFile = join(tmpDir, 'data.sql');
            const tableArgs = importTables.flatMap((table) => [
              '--table',
              table,
            ]);
            await this.runExecFile(
              'pg_dump',
              [
                ...connArgs,
                '--data-only',
                '--disable-triggers',
                ...tableArgs,
                '-f',
                dataFile,
                sourceDatabase,
              ],
              pgEnv,
            );
            await this.runExecFile(
              'psql',
              [...connArgs, '-f', dataFile, taskDbName],
              pgEnv,
            );
          }

          this.logger.log(`task_database_created db=${taskDbName}`);
        } catch (error) {
          this.logger.error(
            `task_database_creation_failed db=${taskDbName}: ${error instanceof Error ? error.message : error}`,
          );
          await this.dropDatabaseInternal(client, taskDbName).catch(
            (dropError) => {
              this.logger.warn(
                `cleanup_drop_failed db=${taskDbName}: ${dropError instanceof Error ? dropError.message : dropError}`,
              );
            },
          );
          throw error;
        } finally {
          await rm(tmpDir, { recursive: true, force: true });
        }
      },
    );
  }

  async dropTaskDatabase(
    config: DatabaseIsolationConfig,
    adminPassword: string,
    taskDbName: string,
  ): Promise<void> {
    const { host, port, adminUser } = config.postgres;

    await this.withTaskDatabaseLock(
      host,
      port,
      adminUser,
      adminPassword,
      taskDbName,
      async (client) => {
        try {
          const dropped = await this.dropDatabaseInternal(client, taskDbName);
          if (dropped) {
            this.logger.log(`task_database_dropped db=${taskDbName}`);
          } else {
            this.logger.log(`task_database_absent db=${taskDbName}`);
          }
        } catch (error) {
          this.logger.warn(
            `task_database_drop_failed db=${taskDbName}: ${error instanceof Error ? error.message : error}`,
          );
        }
      },
    );
  }

  async scanTables(
    postgres: PostgresConnectionConfig,
    adminPassword: string,
  ): Promise<TableInfo[]> {
    const { host, port, adminUser, sourceDatabase } = postgres;

    const client = new Client({
      host,
      port,
      user: adminUser,
      password: adminPassword,
      database: sourceDatabase,
    });

    await client.connect();
    try {
      const result = await client.query<{
        table_name: string;
        estimated_rows: string;
        size_bytes: string;
      }>(`
        SELECT
          c.relname AS table_name,
          c.reltuples::bigint AS estimated_rows,
          pg_total_relation_size(c.oid) AS size_bytes
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
        ORDER BY c.relname
      `);

      return result.rows.map((row) => ({
        name: row.table_name,
        estimatedRows: Number(row.estimated_rows),
        sizeBytes: Number(row.size_bytes),
      }));
    } finally {
      await client.end();
    }
  }

  private async withTaskDatabaseLock<T>(
    host: string,
    port: number,
    user: string,
    password: string,
    dbName: string,
    callback: (client: Client) => Promise<T>,
  ): Promise<T> {
    const client = new Client({
      host,
      port,
      user,
      password,
      database: 'postgres',
    });

    await client.connect();
    try {
      await client.query(
        'SELECT pg_advisory_lock(hashtext($1), hashtext($2))',
        ['ainative_task_database', dbName],
      );

      try {
        return await callback(client);
      } finally {
        await client.query(
          'SELECT pg_advisory_unlock(hashtext($1), hashtext($2))',
          ['ainative_task_database', dbName],
        );
      }
    } finally {
      await client.end();
    }
  }

  private async databaseExists(
    client: Client,
    dbName: string,
  ): Promise<boolean> {
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  private async dropDatabaseInternal(
    client: Client,
    dbName: string,
  ): Promise<boolean> {
    const exists = await this.databaseExists(client, dbName);
    if (!exists) {
      return false;
    }

    const escapedDbName = dbName.replace(/"/g, '""');
    await client.query(
      `ALTER DATABASE "${escapedDbName}" ALLOW_CONNECTIONS false`,
    );
    await client.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    await client.query(`DROP DATABASE IF EXISTS "${escapedDbName}"`);
    return true;
  }

  private runExecFile(
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(command, args, { env }, (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(`${command} failed: ${stderr?.trim() || error.message}`),
          );
          return;
        }
        resolve(stdout);
      });
    });
  }
}
