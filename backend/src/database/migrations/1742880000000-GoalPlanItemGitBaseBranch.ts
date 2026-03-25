import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoalPlanItemGitBaseBranch1742880000000
  implements MigrationInterface
{
  name = 'GoalPlanItemGitBaseBranch1742880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" ADD "gitBaseBranch" character varying(120)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "goal_plan_items"."gitBaseBranch" IS '物化任务时使用的 Git 基准分支（与 CreateTaskDto.gitBaseBranch 一致）'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" DROP COLUMN "gitBaseBranch"`,
    );
  }
}
