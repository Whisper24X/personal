import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAutomations1771002600000 implements MigrationInterface {
  name = 'CreateAutomations1771002600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "automations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "prompt" text NOT NULL, "rrule" character varying(255) NOT NULL, "cwds" jsonb, "status" character varying(20) NOT NULL DEFAULT 'active', "lastRunAt" TIMESTAMP, "nextRunAt" TIMESTAMP, "createdBy" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_8e06494f47f7f9a87ecf1f08e38" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_name" ON "automations" ("name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_status" ON "automations" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automations_created_by" ON "automations" ("createdBy") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_automations_name" ON "automations" ("name") WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_automations_name"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_automations_created_by"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_automations_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_automations_name"`);
    await queryRunner.query(`DROP TABLE "automations"`);
  }
}
