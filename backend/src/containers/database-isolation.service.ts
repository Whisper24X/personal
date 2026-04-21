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

    const exists = await this.databaseExists(
      host,
      port,
      adminUser,
      adminPassword,
      taskDbName,
    );
    if (exists) {
      this.logger.log(`database_already_exists db=${taskDbName}`);
      return;
    }

    this.logger.log(
      `creating_task_database db=${taskDbName} source=${sourceDatabase}`,
    );

    const client = new Client({
      host,
      port,
      user: adminUser,
      password: adminPassword,
      database: 'postgres',
    });
    await client.connect();
    try {
      await client.query(
        `CREATE DATABASE "${taskDbName.replace(/"/g, '""')}"`,
      );
    } finally {
      await client.end();
    }

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
        const tableArgs = importTables.flatMap((t) => ['--table', t]);
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
      await this.forceDropDatabase(
        host,
        port,
        adminUser,
        adminPassword,
        taskDbName,
      );
      throw error;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  async dropTaskDatabase(
    config: DatabaseIsolationConfig,
    adminPassword: string,
    taskDbName: string,
  ): Promise<void> {
    const { host, port, adminUser } = config.postgres;

    const client = new Client({
      host,
      port,
      user: adminUser,
      password: adminPassword,
      database: 'postgres',
    });

    try {
      await client.connect();

      await client.query(
        `ALTER DATABASE "${taskDbName.replace(/"/g, '""')}" ALLOW_CONNECTIONS false`,
      );
      await client.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [taskDbName],
      );
      await client.query(
        `DROP DATABASE IF EXISTS "${taskDbName.replace(/"/g, '""')}"`,
      );

      this.logger.log(`task_database_dropped db=${taskDbName}`);
    } catch (error) {
      this.logger.warn(
        `task_database_drop_failed db=${taskDbName}: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      await client.end();
    }
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

  private async databaseExists(
    host: string,
    port: number,
    user: string,
    password: string,
    dbName: string,
  ): Promise<boolean> {
    const client = new Client({
      host,
      port,
      user,
      password,
      database: 'postgres',
    });

    await client.connect();
    try {
      const result = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [dbName],
      );
      return result.rowCount !== null && result.rowCount > 0;
    } finally {
      await client.end();
    }
  }

  private async forceDropDatabase(
    host: string,
    port: number,
    user: string,
    password: string,
    dbName: string,
  ): Promise<void> {
    try {
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
          `DROP DATABASE IF EXISTS "${dbName.replace(/"/g, '""')}"`,
        );
      } finally {
        await client.end();
      }
    } catch (dropError) {
      this.logger.warn(
        `cleanup_drop_failed db=${dbName}: ${dropError instanceof Error ? dropError.message : dropError}`,
      );
    }
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
            new Error(
              `${command} failed: ${stderr?.trim() || error.message}`,
            ),
          );
          return;
        }
        resolve(stdout);
      });
    });
  }
}
