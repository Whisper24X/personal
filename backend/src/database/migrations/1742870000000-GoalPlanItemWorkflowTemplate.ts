import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoalPlanItemWorkflowTemplate1742870000000
  implements MigrationInterface
{
  name = 'GoalPlanItemWorkflowTemplate1742870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" ADD "workflowTemplateId" uuid`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "goal_plan_items"."workflowTemplateId" IS '物化该计划项时使用的项目工作流模板 ID'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" DROP COLUMN "workflowTemplateId"`,
    );
  }
}
