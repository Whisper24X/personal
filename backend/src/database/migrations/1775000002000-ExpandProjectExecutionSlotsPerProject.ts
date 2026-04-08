import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandProjectExecutionSlotsPerProject1775000002000
  implements MigrationInterface
{
  name = 'ExpandProjectExecutionSlotsPerProject1775000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_project_execution_slots_project"`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_project_execution_slots_project" ON "project_execution_slots" ("projectId")`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_execution_slots_task"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_execution_slots_task" ON "project_execution_slots" ("taskId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_execution_slots_task" ON "project_execution_slots" ("taskId")`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "project_execution_slots" IS '项目级任务容器执行槽（每任务最多一条活跃记录，项目可并发多条）'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "project_execution_slots" a
       USING "project_execution_slots" b
       WHERE a."projectId" = b."projectId"
         AND a."id" > b."id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_execution_slots_project"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_execution_slots_task"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_project_execution_slots_task"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_execution_slots_project" ON "project_execution_slots" ("projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_execution_slots_task" ON "project_execution_slots" ("taskId")`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "project_execution_slots" IS '项目级任务容器执行槽（每项目最多一条活跃记录）'`,
    );
  }
}
