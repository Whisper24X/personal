import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoalAgentCliColumns1742860000000 implements MigrationInterface {
  name = 'GoalAgentCliColumns1742860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goals" ADD "agentCliId" character varying(64)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "goals"."agentCliId" IS '生成 PRD/拆解计划时默认使用的 Agent CLI 工具 ID'`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD "agentCliConfigId" uuid`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "goals"."agentCliConfigId" IS '生成 PRD/拆解计划时默认使用的业务线 Agent 工具配置 ID'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goals" DROP COLUMN "agentCliConfigId"`,
    );
    await queryRunner.query(`ALTER TABLE "goals" DROP COLUMN "agentCliId"`);
  }
}
