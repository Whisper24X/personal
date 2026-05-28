import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropWorkflowTemplateSeedColumns1776500000000
  implements MigrationInterface
{
  name = 'DropWorkflowTemplateSeedColumns1776500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workflow_templates" DROP COLUMN IF EXISTS "businessLineSeedOrder"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workflow_templates" DROP COLUMN IF EXISTS "seedOnBusinessLineCreate"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workflow_templates" ADD "seedOnBusinessLineCreate" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "workflow_templates"."seedOnBusinessLineCreate" IS '新建业务线时是否从该 global 母版复制到业务线'`,
    );
    await queryRunner.query(
      `ALTER TABLE "workflow_templates" ADD "businessLineSeedOrder" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "workflow_templates"."businessLineSeedOrder" IS '多条母版参与种子时的排序（升序；相同则按创建时间）'`,
    );
  }
}
