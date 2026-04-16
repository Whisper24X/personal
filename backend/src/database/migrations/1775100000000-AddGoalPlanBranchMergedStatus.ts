import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoalPlanBranchMergedStatus1775100000000
  implements MigrationInterface
{
  name = 'AddGoalPlanBranchMergedStatus1775100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."goal_plan_item_status_enum" ADD VALUE IF NOT EXISTS 'branch_merged'`,
    );
  }

  public async down(): Promise<void> {
    /* PostgreSQL 不支持安全删除枚举取值；回滚需重建类型并改表，生产环境慎用 */
  }
}
