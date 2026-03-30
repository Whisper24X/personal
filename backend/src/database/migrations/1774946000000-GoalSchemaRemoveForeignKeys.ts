import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 移除 GoalSchema 引入的数据库级外键（与实体 createForeignKeyConstraints: false 一致）。
 * 已执行旧版 GoalSchema 的环境会删除既有 FK；全新环境在修改后的 GoalSchema 中未建 FK，此处 DROP IF EXISTS 为空操作。
 */
export class GoalSchemaRemoveForeignKeys1774946000000
  implements MigrationInterface
{
  name = 'GoalSchemaRemoveForeignKeys1774946000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT IF EXISTS "FK_goals_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" DROP CONSTRAINT IF EXISTS "FK_task_dependencies_successor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" DROP CONSTRAINT IF EXISTS "FK_task_dependencies_predecessor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_plan_sub_tasks" DROP CONSTRAINT IF EXISTS "FK_goal_plan_sub_tasks_task"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_plan_sub_tasks" DROP CONSTRAINT IF EXISTS "FK_goal_plan_sub_tasks_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" DROP CONSTRAINT IF EXISTS "FK_goal_plan_items_goal"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_source_docs" DROP CONSTRAINT IF EXISTS "FK_goal_source_docs_goal"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "FK_tasks_goal_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_goal_id" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_source_docs" ADD CONSTRAINT "FK_goal_source_docs_goal" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_plan_items" ADD CONSTRAINT "FK_goal_plan_items_goal" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_plan_sub_tasks" ADD CONSTRAINT "FK_goal_plan_sub_tasks_item" FOREIGN KEY ("goalPlanItemId") REFERENCES "goal_plan_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_plan_sub_tasks" ADD CONSTRAINT "FK_goal_plan_sub_tasks_task" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_task_dependencies_predecessor" FOREIGN KEY ("predecessorTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_task_dependencies_successor" FOREIGN KEY ("successorTaskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "FK_goals_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
