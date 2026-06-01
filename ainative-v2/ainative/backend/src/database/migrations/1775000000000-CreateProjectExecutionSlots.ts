import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectExecutionSlots1775000000000
  implements MigrationInterface
{
  name = 'CreateProjectExecutionSlots1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "project_execution_slots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "taskId" uuid NOT NULL, "containerId" text, "claimedAt" TIMESTAMP NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP NOT NULL, "heartbeatAt" TIMESTAMP, CONSTRAINT "PK_project_execution_slots" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_execution_slots_project" ON "project_execution_slots" ("projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_execution_slots_expires" ON "project_execution_slots" ("expiresAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_execution_slots_task" ON "project_execution_slots" ("taskId")`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "project_execution_slots" IS '项目级任务容器执行槽（每项目最多一条活跃记录）'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "project_execution_slots"`);
  }
}
