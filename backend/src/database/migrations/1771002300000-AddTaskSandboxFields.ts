import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskSandboxFields1771002300000 implements MigrationInterface {
  name = 'AddTaskSandboxFields1771002300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "gitBaseBranch" character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "gitWorktreePath" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "sandboxCleanupAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tasks_git_worktree_path" ON "tasks" ("gitWorktreePath") WHERE "gitWorktreePath" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_tasks_git_worktree_path"`);
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "sandboxCleanupAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "gitWorktreePath"`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "gitBaseBranch"`);
  }
}
