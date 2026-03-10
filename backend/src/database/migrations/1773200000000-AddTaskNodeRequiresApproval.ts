import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskNodeRequiresApproval1773200000000
  implements MigrationInterface
{
  name = 'AddTaskNodeRequiresApproval1773200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "task_nodes" ADD "configJson" jsonb`);
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."configJson" IS '节点配置JSON'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN "configJson"`,
    );
  }
}
