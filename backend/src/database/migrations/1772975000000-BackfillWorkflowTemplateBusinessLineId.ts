import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillWorkflowTemplateBusinessLineId1772975000000
  implements MigrationInterface
{
  name = 'BackfillWorkflowTemplateBusinessLineId1772975000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "workflow_templates" AS template
       SET "businessLineId" = project."businessLineId"
       FROM "projects" AS project
       WHERE template."scope" = 'project'
         AND template."projectId" = project."id"
         AND template."businessLineId" IS DISTINCT FROM project."businessLineId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "workflow_templates"
       DROP CONSTRAINT IF EXISTS "CHK_workflow_templates_business_line_id_required"`,
    );

    await queryRunner.query(
      `ALTER TABLE "workflow_templates"
       ADD CONSTRAINT "CHK_workflow_templates_business_line_id_required"
       CHECK ("scope" = 'global' OR "businessLineId" IS NOT NULL)`,
    );

    await queryRunner.query(
      `COMMENT ON COLUMN "workflow_templates"."businessLineId" IS '所属业务线ID（非全局作用域时填写）'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workflow_templates"
       DROP CONSTRAINT IF EXISTS "CHK_workflow_templates_business_line_id_required"`,
    );

    await queryRunner.query(
      `UPDATE "workflow_templates"
       SET "businessLineId" = NULL
       WHERE "scope" = 'project'`,
    );

    await queryRunner.query(
      `COMMENT ON COLUMN "workflow_templates"."businessLineId" IS '所属业务线ID（业务线作用域时填写）'`,
    );
  }
}
