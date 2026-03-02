import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkflowTemplateScope1771003200000
  implements MigrationInterface
{
  name = 'AddWorkflowTemplateScope1771003200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."workflow_template_scope_enum" AS ENUM('global', 'business_line')`,
    );

    await queryRunner.query(
      `ALTER TABLE "workflow_templates" ADD "scope" "public"."workflow_template_scope_enum" NOT NULL DEFAULT 'global'`,
    );
    await queryRunner.query(
      `ALTER TABLE "workflow_templates" ADD "businessLineId" uuid`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_templates_business_line_id" ON "workflow_templates" ("businessLineId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "workflow_templates" ADD CONSTRAINT "FK_workflow_templates_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`DROP INDEX "public"."UQ_workflow_templates_name"`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workflow_templates_global_name" ON "workflow_templates" ("name") WHERE "deletedAt" IS NULL AND "scope" = 'global'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workflow_templates_business_line_name" ON "workflow_templates" ("businessLineId", "name") WHERE "deletedAt" IS NULL AND "scope" = 'business_line'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_workflow_templates_business_line_name"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_workflow_templates_global_name"`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workflow_templates_name" ON "workflow_templates" ("name") WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "workflow_templates" DROP CONSTRAINT "FK_workflow_templates_business_line"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_workflow_templates_business_line_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "workflow_templates" DROP COLUMN "businessLineId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workflow_templates" DROP COLUMN "scope"`,
    );

    await queryRunner.query(
      `DROP TYPE "public"."workflow_template_scope_enum"`,
    );
  }
}
