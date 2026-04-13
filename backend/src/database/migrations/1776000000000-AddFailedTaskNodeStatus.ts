import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFailedTaskNodeStatus1776000000000
  implements MigrationInterface
{
  name = 'AddFailedTaskNodeStatus1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_task_nodes_single_in_progress"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."task_node_status_enum" RENAME TO "task_node_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_node_status_enum" AS ENUM('todo', 'in_progress', 'in_review', 'failed', 'done')`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ALTER COLUMN "status" TYPE "public"."task_node_status_enum" USING "status"::text::"public"."task_node_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ALTER COLUMN "status" SET DEFAULT 'todo'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_task_nodes_single_in_progress" ON "task_nodes" ("taskId") WHERE "status" = 'in_progress'`,
    );
    await queryRunner.query(`DROP TYPE "public"."task_node_status_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_task_nodes_single_in_progress"`,
    );
    await queryRunner.query(
      `UPDATE "task_nodes" SET "status" = 'in_review' WHERE "status" = 'failed'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."task_node_status_enum" RENAME TO "task_node_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."task_node_status_enum" AS ENUM('todo', 'in_progress', 'in_review', 'done')`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ALTER COLUMN "status" TYPE "public"."task_node_status_enum" USING "status"::text::"public"."task_node_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ALTER COLUMN "status" SET DEFAULT 'todo'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_task_nodes_single_in_progress" ON "task_nodes" ("taskId") WHERE "status" = 'in_progress'`,
    );
    await queryRunner.query(`DROP TYPE "public"."task_node_status_enum_old"`);
  }
}
