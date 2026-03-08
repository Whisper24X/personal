import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropScopedRoleLegacyColumns1772951000000
  implements MigrationInterface
{
  name = 'DropScopedRoleLegacyColumns1772951000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_business_line_member_role_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_business_line_invitation_role_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_members_role_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_business_line_role_business_line_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_project_role_business_line_code"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP COLUMN IF EXISTS "businessLineRoleCode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" DROP COLUMN IF EXISTS "businessLineRoleCode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" DROP COLUMN IF EXISTS "projectRoleCode"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_roles" DROP COLUMN IF EXISTS "code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_roles" DROP COLUMN IF EXISTS "code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_roles" DROP COLUMN IF EXISTS "baseRole"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_roles" DROP COLUMN IF EXISTS "baseRole"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_line_roles" ADD COLUMN IF NOT EXISTS "code" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_roles" ADD COLUMN IF NOT EXISTS "code" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_roles" ADD COLUMN IF NOT EXISTS "baseRole" "public"."business_line_member_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_roles" ADD COLUMN IF NOT EXISTS "baseRole" "public"."project_member_role_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD COLUMN IF NOT EXISTS "businessLineRoleCode" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD COLUMN IF NOT EXISTS "businessLineRoleCode" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "projectRoleCode" character varying(64)`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_business_line_member_role_code" ON "business_line_members" ("businessLineRoleCode")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_business_line_invitation_role_code" ON "business_line_invitations" ("businessLineRoleCode")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_project_members_role_code" ON "project_members" ("projectRoleCode")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_business_line_role_business_line_code" ON "business_line_roles" ("businessLineId", "code") WHERE "code" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_project_role_business_line_code" ON "project_roles" ("businessLineId", "code") WHERE "code" IS NOT NULL`,
    );
  }
}
