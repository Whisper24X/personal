import { MigrationInterface, QueryRunner } from 'typeorm';

export class RebuildAutomationsWithProjectScope1773210000000
  implements MigrationInterface
{
  name = 'RebuildAutomationsWithProjectScope1773210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "automations" CASCADE`);
    await queryRunner.query(
      `CREATE TABLE "automations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "name" character varying(120) NOT NULL, "prompt" text NOT NULL, "rrule" character varying(255) NOT NULL, "cwds" jsonb, "status" character varying(20) NOT NULL DEFAULT 'active', "lastRunAt" TIMESTAMP, "nextRunAt" TIMESTAMP, "createdBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_34c2cc382fc780ea36f7c478192" PRIMARY KEY ("id")); COMMENT ON COLUMN "automations"."id" IS '主键（UUID）'; COMMENT ON COLUMN "automations"."projectId" IS '所属项目ID'; COMMENT ON COLUMN "automations"."name" IS '自动化名称'; COMMENT ON COLUMN "automations"."prompt" IS '自动化提示词内容'; COMMENT ON COLUMN "automations"."rrule" IS '自动化调度规则'; COMMENT ON COLUMN "automations"."cwds" IS '工作目录列表(JSON)'; COMMENT ON COLUMN "automations"."status" IS '自动化状态'; COMMENT ON COLUMN "automations"."lastRunAt" IS '最近执行时间'; COMMENT ON COLUMN "automations"."nextRunAt" IS '下次执行时间'; COMMENT ON COLUMN "automations"."createdBy" IS '创建者用户ID'; COMMENT ON COLUMN "automations"."createdAt" IS '创建时间'; COMMENT ON COLUMN "automations"."updatedAt" IS '更新时间'; COMMENT ON COLUMN "automations"."deletedAt" IS '软删除时间'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_project_id" ON "automations" ("projectId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_created_by" ON "automations" ("createdBy") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_status" ON "automations" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_name" ON "automations" ("name") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_automations_project_name" ON "automations" ("projectId", "name") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "automations" IS '定时自动化定义'`,
    );
    await queryRunner.query(
      `ALTER TABLE "automations" ADD CONSTRAINT "FK_automations_project_id" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "automations" CASCADE`);
    await queryRunner.query(
      `CREATE TABLE "automations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "prompt" text NOT NULL, "rrule" character varying(255) NOT NULL, "cwds" jsonb, "status" character varying(20) NOT NULL DEFAULT 'active', "lastRunAt" TIMESTAMP, "nextRunAt" TIMESTAMP, "createdBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_34c2cc382fc780ea36f7c478192" PRIMARY KEY ("id")); COMMENT ON COLUMN "automations"."id" IS '主键（UUID）'; COMMENT ON COLUMN "automations"."name" IS '自动化名称'; COMMENT ON COLUMN "automations"."prompt" IS '自动化提示词内容'; COMMENT ON COLUMN "automations"."rrule" IS '自动化调度规则'; COMMENT ON COLUMN "automations"."cwds" IS '工作目录列表(JSON)'; COMMENT ON COLUMN "automations"."status" IS '自动化状态'; COMMENT ON COLUMN "automations"."lastRunAt" IS '最近执行时间'; COMMENT ON COLUMN "automations"."nextRunAt" IS '下次执行时间'; COMMENT ON COLUMN "automations"."createdBy" IS '创建者用户ID'; COMMENT ON COLUMN "automations"."createdAt" IS '创建时间'; COMMENT ON COLUMN "automations"."updatedAt" IS '更新时间'; COMMENT ON COLUMN "automations"."deletedAt" IS '软删除时间'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_automations_name" ON "automations" ("name") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_created_by" ON "automations" ("createdBy") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_status" ON "automations" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_name" ON "automations" ("name") `,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "automations" IS '定时自动化定义'`,
    );
  }
}
