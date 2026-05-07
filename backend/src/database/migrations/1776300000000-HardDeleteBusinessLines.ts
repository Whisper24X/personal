import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardDeleteBusinessLines1776300000000
  implements MigrationInterface
{
  name = 'HardDeleteBusinessLines1776300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TEMP TABLE "tmp_business_lines_to_purge" ("id" uuid PRIMARY KEY) ON COMMIT DROP`,
    );
    await queryRunner.query(
      `INSERT INTO "tmp_business_lines_to_purge" ("id")
       SELECT "id" FROM "business_lines" WHERE "deletedAt" IS NOT NULL`,
    );

    await this.deleteBusinessLineGraph(queryRunner);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_business_lines_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_business_lines_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_lines" DROP COLUMN "deletedAt"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_business_lines_name" ON "business_lines" ("name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_business_lines_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_lines" ADD "deletedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "business_lines"."deletedAt" IS '软删除时间'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_business_lines_name" ON "business_lines" ("name") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_lines_name" ON "business_lines" ("name")`,
    );
  }

  private async deleteBusinessLineGraph(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const projectsInScope = `
      SELECT "id" FROM "projects"
      WHERE "businessLineId" IN (SELECT "id" FROM "tmp_business_lines_to_purge")
    `;
    const tasksInScope = `
      SELECT "id" FROM "tasks"
      WHERE "businessLineId" IN (SELECT "id" FROM "tmp_business_lines_to_purge")
         OR "projectId" IN (${projectsInScope})
    `;
    const goalsInScope = `
      SELECT "id" FROM "goals" WHERE "projectId" IN (${projectsInScope})
    `;
    const goalPlanItemsInScope = `
      SELECT "id" FROM "goal_plan_items" WHERE "goalId" IN (${goalsInScope})
    `;

    await queryRunner.query(
      `DELETE FROM "notification_events" WHERE "taskId" IN (${tasksInScope})`,
    );
    await queryRunner.query(
      `DELETE FROM "memory_ingest_jobs"
       WHERE "projectId" IN (${projectsInScope})
          OR "taskId" IN (${tasksInScope})`,
    );
    await queryRunner.query(
      `DELETE FROM "memory_fact_signals"
       WHERE "projectId" IN (${projectsInScope})`,
    );
    await queryRunner.query(
      `DELETE FROM "project_execution_slots"
       WHERE "projectId" IN (${projectsInScope})
          OR "taskId" IN (${tasksInScope})`,
    );
    await queryRunner.query(
      `DELETE FROM "task_dependencies"
       WHERE "predecessorTaskId" IN (${tasksInScope})
          OR "successorTaskId" IN (${tasksInScope})`,
    );
    await queryRunner.query(
      `DELETE FROM "task_nodes" WHERE "taskId" IN (${tasksInScope})`,
    );
    await queryRunner.query(
      `DELETE FROM "goal_plan_sub_tasks"
       WHERE "taskId" IN (${tasksInScope})
          OR "goalPlanItemId" IN (${goalPlanItemsInScope})`,
    );
    await queryRunner.query(
      `DELETE FROM "goal_plan_items" WHERE "goalId" IN (${goalsInScope})`,
    );
    await queryRunner.query(
      `DELETE FROM "goal_source_docs" WHERE "goalId" IN (${goalsInScope})`,
    );
    await queryRunner.query(
      `DELETE FROM "goals" WHERE "projectId" IN (${projectsInScope})`,
    );
    await queryRunner.query(
      `DELETE FROM "workflow_templates"
       WHERE "businessLineId" IN (SELECT "id" FROM "tmp_business_lines_to_purge")
          OR "projectId" IN (${projectsInScope})`,
    );
    await queryRunner.query(
      `DELETE FROM "automations" WHERE "projectId" IN (${projectsInScope})`,
    );
    await queryRunner.query(
      `DELETE FROM "project_members" WHERE "projectId" IN (${projectsInScope})`,
    );
    await queryRunner.query(
      `DELETE FROM "tasks"
       WHERE "businessLineId" IN (SELECT "id" FROM "tmp_business_lines_to_purge")
          OR "projectId" IN (${projectsInScope})`,
    );
    await queryRunner.query(
      `DELETE FROM "project_roles"
       WHERE "businessLineId" IN (SELECT "id" FROM "tmp_business_lines_to_purge")`,
    );
    await queryRunner.query(
      `DELETE FROM "projects"
       WHERE "businessLineId" IN (SELECT "id" FROM "tmp_business_lines_to_purge")`,
    );
    await queryRunner.query(
      `DELETE FROM "business_line_invitations"
       WHERE "businessLineId" IN (SELECT "id" FROM "tmp_business_lines_to_purge")`,
    );
    await queryRunner.query(
      `DELETE FROM "business_line_members"
       WHERE "businessLineId" IN (SELECT "id" FROM "tmp_business_lines_to_purge")`,
    );
    await queryRunner.query(
      `DELETE FROM "agent_cli_configs"
       WHERE "businessLineId" IN (SELECT "id" FROM "tmp_business_lines_to_purge")`,
    );
    await queryRunner.query(
      `DELETE FROM "business_line_roles"
       WHERE "businessLineId" IN (SELECT "id" FROM "tmp_business_lines_to_purge")`,
    );
    await queryRunner.query(
      `DELETE FROM "business_lines"
       WHERE "id" IN (SELECT "id" FROM "tmp_business_lines_to_purge")`,
    );
  }
}
