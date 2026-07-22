import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessLineConfigJsonAndProjectWorkspaceManaged1777000000000
  implements MigrationInterface
{
  name = 'AddBusinessLineConfigJsonAndProjectWorkspaceManaged1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_lines" ADD "configJson" jsonb`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "business_lines"."configJson" IS '业务线配置JSON（子仓/Runner缓存等）'`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_projects_workspace_managed_bl" ON "projects" ("businessLineId") WHERE "deletedAt" IS NULL AND "configJson" @> '{"workspaceManaged": true}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."UQ_projects_workspace_managed_bl"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_lines" DROP COLUMN "configJson"`,
    );
  }
}
