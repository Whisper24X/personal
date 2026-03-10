import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskNodeAgentCliSessionId1773110000000
  implements MigrationInterface
{
  name = 'AddTaskNodeAgentCliSessionId1773110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD "agentCliSessionId" text`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."agentCliSessionId" IS 'Agent CLI对话会话ID'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN "agentCliSessionId"`,
    );
  }
}
