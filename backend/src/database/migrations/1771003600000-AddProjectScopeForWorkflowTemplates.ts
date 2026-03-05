import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectScopeForWorkflowTemplates1771003600000
  implements MigrationInterface
{
  name = 'AddProjectScopeForWorkflowTemplates1771003600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL requires ADD VALUE to be committed before the new value
    // can be referenced in queries (e.g. in WHERE clauses for indexes).
    await queryRunner.commitTransaction();
    await queryRunner.query(
      `ALTER TYPE "public"."workflow_template_scope_enum" ADD VALUE IF NOT EXISTS 'project'`,
    );
    await queryRunner.startTransaction();

    await queryRunner.query(
      `ALTER TABLE "workflow_templates" ADD "projectId" uuid`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_workflow_templates_project_id" ON "workflow_templates" ("projectId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "workflow_templates" ADD CONSTRAINT "FK_workflow_templates_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workflow_templates_project_name" ON "workflow_templates" ("projectId", "name") WHERE "deletedAt" IS NULL AND "scope" = 'project'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_workflow_templates_project_name"`,
    );

    await queryRunner.query(
      `ALTER TABLE "workflow_templates" DROP CONSTRAINT "FK_workflow_templates_project"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_workflow_templates_project_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "workflow_templates" DROP COLUMN "projectId"`,
    );

    await queryRunner.query(
      `DELETE FROM "workflow_templates" WHERE "scope" = 'project'`,
    );

    await queryRunner.query(
      `ALTER TYPE "public"."workflow_template_scope_enum" RENAME TO "workflow_template_scope_enum_old"`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."workflow_template_scope_enum" AS ENUM('global', 'business_line')`,
    );

    await queryRunner.query(
      `ALTER TABLE "workflow_templates" ALTER COLUMN "scope" DROP DEFAULT`,
    );

    await queryRunner.query(
      `ALTER TABLE "workflow_templates" ALTER COLUMN "scope" TYPE "public"."workflow_template_scope_enum" USING "scope"::text::"public"."workflow_template_scope_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "workflow_templates" ALTER COLUMN "scope" SET DEFAULT 'global'`,
    );

    await queryRunner.query(
      `DROP TYPE "public"."workflow_template_scope_enum_old"`,
    );
  }
}
