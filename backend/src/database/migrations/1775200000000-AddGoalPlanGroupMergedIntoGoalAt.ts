import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoalPlanGroupMergedIntoGoalAt1775200000000
  implements MigrationInterface
{
  name = 'AddGoalPlanGroupMergedIntoGoalAt1775200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "goal_plan_items"
      ADD COLUMN "group_merged_into_goal_at" TIMESTAMP WITH TIME ZONE NULL
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "goal_plan_items"."group_merged_into_goal_at" IS '功能组分支已合并入需求分支的时间'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "goal_plan_items" DROP COLUMN "group_merged_into_goal_at";
    `);
  }
}
