import { MigrationInterface, QueryRunner } from 'typeorm';

export class TaskNodeResetSnapshots1774947000000 implements MigrationInterface {
  name = 'TaskNodeResetSnapshots1774947000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD "beforeRunCommitSha" character varying(64)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."beforeRunCommitSha" IS '节点执行前记录的 Git HEAD commit SHA'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD "afterRunCommitSha" character varying(64)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."afterRunCommitSha" IS '节点执行结束后记录的 Git HEAD commit SHA'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN "afterRunCommitSha"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN "beforeRunCommitSha"`,
    );
  }
}
