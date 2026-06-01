import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessLineDefaultAgentCliTool1776100000000
  implements MigrationInterface
{
  name = 'AddBusinessLineDefaultAgentCliTool1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_lines" ADD "defaultAgentCliToolId" character varying(64)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "business_lines"."defaultAgentCliToolId" IS '默认 Agent CLI 工具 ID'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_lines" DROP COLUMN "defaultAgentCliToolId"`,
    );
  }
}
