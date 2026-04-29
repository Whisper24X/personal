import { MigrationInterface, QueryRunner } from 'typeorm';

export class MemoryIngestTables1776200000000 implements MigrationInterface {
  name = 'MemoryIngestTables1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "memory_ingest_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "idempotencyKey" character varying(500) NOT NULL,
        "projectId" uuid NOT NULL,
        "taskId" uuid NOT NULL,
        "kind" character varying(32) NOT NULL DEFAULT 'task_done',
        "status" character varying(32) NOT NULL DEFAULT 'pending',
        "payload" jsonb,
        "error" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_memory_ingest_jobs" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_memory_ingest_jobs_idempotency" ON "memory_ingest_jobs" ("idempotencyKey")`,
    );
    await queryRunner.query(
      `CREATE TABLE "memory_fact_signals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "projectId" uuid NOT NULL,
        "dedupKey" character varying(200) NOT NULL,
        "recallCount" integer NOT NULL DEFAULT 0,
        "distinctQueryCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_memory_fact_signals" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_memory_fact_signals_project_dedup" ON "memory_fact_signals" ("projectId", "dedupKey")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "memory_fact_signals"`);
    await queryRunner.query(`DROP TABLE "memory_ingest_jobs"`);
  }
}
