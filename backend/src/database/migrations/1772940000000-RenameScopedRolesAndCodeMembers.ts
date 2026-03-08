import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameScopedRolesAndCodeMembers1772940000000
  implements MigrationInterface
{
  name = 'RenameScopedRolesAndCodeMembers1772940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "business_line_custom_roles"
      SET "code" = CONCAT('blr-', SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 16))
      WHERE COALESCE("code", '') = ''
    `);
    await queryRunner.query(`
      UPDATE "project_custom_roles"
      SET "code" = CONCAT('prj-', SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 16))
      WHERE COALESCE("code", '') = ''
    `);

    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" RENAME TO "business_line_roles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" RENAME TO "project_roles"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_business_line_custom_role_business_line_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_business_line_role_business_line_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_business_line_custom_role_business_line_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_business_line_role_business_line_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_business_line_custom_role_business_line_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_business_line_role_business_line_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_roles" DROP COLUMN IF EXISTS "baseRole"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_roles" ALTER COLUMN "code" SET NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "business_line_roles" IS '业务线角色'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "business_line_roles"."code" IS '角色代码'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_role_business_line_id" ON "business_line_roles" ("businessLineId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_business_line_role_business_line_name" ON "business_line_roles" ("businessLineId", "name")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_business_line_role_business_line_code" ON "business_line_roles" ("businessLineId", "code")`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_custom_role_business_line_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_role_business_line_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_project_custom_role_business_line_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_project_role_business_line_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_project_custom_role_business_line_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_project_role_business_line_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_roles" DROP COLUMN IF EXISTS "baseRole"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_roles" ALTER COLUMN "code" SET NOT NULL`,
    );
    await queryRunner.query(`COMMENT ON TABLE "project_roles" IS '项目角色'`);
    await queryRunner.query(
      `COMMENT ON COLUMN "project_roles"."code" IS '角色代码'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_role_business_line_id" ON "project_roles" ("businessLineId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_role_business_line_name" ON "project_roles" ("businessLineId", "name")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_role_business_line_code" ON "project_roles" ("businessLineId", "code")`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP CONSTRAINT IF EXISTS "FK_business_line_member_custom_role"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_business_line_member_custom_role_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_business_line_member_role_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD COLUMN IF NOT EXISTS "businessLineRoleCode" character varying(64)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "business_line_members"."businessLineRoleCode" IS '业务线角色代码'`,
    );
    await queryRunner.query(`
      UPDATE "business_line_members" member
      SET "businessLineRoleCode" = COALESCE(role."code", member."role"::text)
      FROM "business_line_roles" role
      WHERE member."customRoleId" IS NOT NULL
        AND role."id" = member."customRoleId"
    `);
    await queryRunner.query(`
      UPDATE "business_line_members"
      SET "businessLineRoleCode" = "role"::text
      WHERE "businessLineRoleCode" IS NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ALTER COLUMN "businessLineRoleCode" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_member_role_code" ON "business_line_members" ("businessLineRoleCode")`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP COLUMN IF EXISTS "customRoleId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP COLUMN IF EXISTS "role"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" DROP CONSTRAINT IF EXISTS "FK_business_line_invitation_custom_role"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_business_line_invitation_custom_role_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_business_line_invitation_role_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD COLUMN IF NOT EXISTS "businessLineRoleCode" character varying(64)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "business_line_invitations"."businessLineRoleCode" IS '业务线角色代码'`,
    );
    await queryRunner.query(`
      UPDATE "business_line_invitations" invitation
      SET "businessLineRoleCode" = COALESCE(role."code", invitation."role"::text)
      FROM "business_line_roles" role
      WHERE invitation."customRoleId" IS NOT NULL
        AND role."id" = invitation."customRoleId"
    `);
    await queryRunner.query(`
      UPDATE "business_line_invitations"
      SET "businessLineRoleCode" = "role"::text
      WHERE "businessLineRoleCode" IS NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ALTER COLUMN "businessLineRoleCode" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_invitation_role_code" ON "business_line_invitations" ("businessLineRoleCode")`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" DROP COLUMN IF EXISTS "customRoleId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" DROP COLUMN IF EXISTS "role"`,
    );

    await queryRunner.query(
      `ALTER TABLE "project_members" DROP CONSTRAINT IF EXISTS "FK_project_member_custom_role"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_members_custom_role_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_members_role_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "projectRoleCode" character varying(64)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "project_members"."projectRoleCode" IS '项目角色代码'`,
    );
    await queryRunner.query(`
      UPDATE "project_members" member
      SET "projectRoleCode" = COALESCE(role."code", member."role"::text)
      FROM "project_roles" role
      WHERE member."customRoleId" IS NOT NULL
        AND role."id" = member."customRoleId"
    `);
    await queryRunner.query(`
      UPDATE "project_members"
      SET "projectRoleCode" = "role"::text
      WHERE "projectRoleCode" IS NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "project_members" ALTER COLUMN "projectRoleCode" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_role_code" ON "project_members" ("projectRoleCode")`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" DROP COLUMN IF EXISTS "customRoleId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" DROP COLUMN IF EXISTS "role"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "business_line_roles"
      ADD COLUMN IF NOT EXISTS "baseRole" "public"."business_line_member_role_enum"
    `);
    await queryRunner.query(`
      UPDATE "business_line_roles"
      SET "baseRole" = CASE
        WHEN "code" = 'owner' OR "capabilities" ? 'businessLine.delete' THEN 'owner'::"public"."business_line_member_role_enum"
        WHEN "code" = 'admin' OR "capabilities" ? 'businessLine.member.manage' THEN 'admin'::"public"."business_line_member_role_enum"
        ELSE 'member'::"public"."business_line_member_role_enum"
      END
    `);
    await queryRunner.query(`
      ALTER TABLE "project_roles"
      ADD COLUMN IF NOT EXISTS "baseRole" "public"."project_member_role_enum"
    `);
    await queryRunner.query(`
      UPDATE "project_roles"
      SET "baseRole" = CASE
        WHEN "code" = 'owner' OR "capabilities" ? 'project.delete' THEN 'owner'::"public"."project_member_role_enum"
        WHEN "code" = 'maintainer' OR "capabilities" ? 'project.member.manage' OR "capabilities" ? 'project.workflow.manage' OR "capabilities" ? 'project.update' THEN 'maintainer'::"public"."project_member_role_enum"
        WHEN "code" = 'developer' OR "capabilities" ? 'project.task.create' OR "capabilities" ? 'project.task.execute' THEN 'developer'::"public"."project_member_role_enum"
        ELSE 'viewer'::"public"."project_member_role_enum"
      END
    `);

    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD COLUMN IF NOT EXISTS "role" "public"."business_line_member_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD COLUMN IF NOT EXISTS "customRoleId" uuid`,
    );
    await queryRunner.query(`
      UPDATE "business_line_members" member
      SET "role" = COALESCE(role."baseRole", CASE
        WHEN member."businessLineRoleCode" = 'owner' THEN 'owner'::"public"."business_line_member_role_enum"
        WHEN member."businessLineRoleCode" = 'admin' THEN 'admin'::"public"."business_line_member_role_enum"
        ELSE 'member'::"public"."business_line_member_role_enum"
      END),
      "customRoleId" = role."id"
      FROM "business_line_roles" role
      WHERE role."businessLineId" = member."businessLineId"
        AND role."code" = member."businessLineRoleCode"
    `);
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ALTER COLUMN "role" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_business_line_member_role_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP COLUMN IF EXISTS "businessLineRoleCode"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD COLUMN IF NOT EXISTS "role" "public"."business_line_invitation_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD COLUMN IF NOT EXISTS "customRoleId" uuid`,
    );
    await queryRunner.query(`
      UPDATE "business_line_invitations" invitation
      SET "role" = CASE
        WHEN COALESCE(role."baseRole"::text, invitation."businessLineRoleCode") = 'owner' THEN 'owner'::"public"."business_line_invitation_role_enum"
        WHEN COALESCE(role."baseRole"::text, invitation."businessLineRoleCode") = 'admin' THEN 'admin'::"public"."business_line_invitation_role_enum"
        ELSE 'member'::"public"."business_line_invitation_role_enum"
      END,
      "customRoleId" = role."id"
      FROM "business_line_roles" role
      WHERE role."businessLineId" = invitation."businessLineId"
        AND role."code" = invitation."businessLineRoleCode"
    `);
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ALTER COLUMN "role" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_business_line_invitation_role_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" DROP COLUMN IF EXISTS "businessLineRoleCode"`,
    );

    await queryRunner.query(
      `ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "role" "public"."project_member_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "customRoleId" uuid`,
    );
    await queryRunner.query(`
      UPDATE "project_members" member
      SET "role" = COALESCE(role."baseRole", CASE
        WHEN member."projectRoleCode" = 'owner' THEN 'owner'::"public"."project_member_role_enum"
        WHEN member."projectRoleCode" = 'maintainer' THEN 'maintainer'::"public"."project_member_role_enum"
        WHEN member."projectRoleCode" = 'developer' THEN 'developer'::"public"."project_member_role_enum"
        ELSE 'viewer'::"public"."project_member_role_enum"
      END),
      "customRoleId" = role."id"
      FROM "projects" project
      INNER JOIN "project_roles" role
        ON role."businessLineId" = project."businessLineId"
       AND role."code" = member."projectRoleCode"
      WHERE project."id" = member."projectId"
    `);
    await queryRunner.query(
      `ALTER TABLE "project_members" ALTER COLUMN "role" SET NOT NULL`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_members_role_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" DROP COLUMN IF EXISTS "projectRoleCode"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_roles" ALTER COLUMN "code" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_roles" ALTER COLUMN "code" DROP NOT NULL`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_business_line_role_business_line_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_business_line_role_business_line_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_business_line_role_business_line_code"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_role_business_line_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_project_role_business_line_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_project_role_business_line_code"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_roles" RENAME TO "business_line_custom_roles"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_roles" RENAME TO "project_custom_roles"`,
    );

    await queryRunner.query(
      `COMMENT ON TABLE "business_line_custom_roles" IS '业务线角色'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "project_custom_roles" IS '项目角色'`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_custom_role_business_line_id" ON "business_line_custom_roles" ("businessLineId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_business_line_custom_role_business_line_name" ON "business_line_custom_roles" ("businessLineId", "name")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_business_line_custom_role_business_line_code" ON "business_line_custom_roles" ("businessLineId", "code") WHERE "code" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_custom_role_business_line_id" ON "project_custom_roles" ("businessLineId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_custom_role_business_line_name" ON "project_custom_roles" ("businessLineId", "name")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_custom_role_business_line_code" ON "project_custom_roles" ("businessLineId", "code") WHERE "code" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_member_custom_role_id" ON "business_line_members" ("customRoleId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_invitation_custom_role_id" ON "business_line_invitations" ("customRoleId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_custom_role_id" ON "project_members" ("customRoleId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD CONSTRAINT "FK_business_line_member_custom_role" FOREIGN KEY ("customRoleId") REFERENCES "business_line_custom_roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD CONSTRAINT "FK_business_line_invitation_custom_role" FOREIGN KEY ("customRoleId") REFERENCES "business_line_custom_roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_project_member_custom_role" FOREIGN KEY ("customRoleId") REFERENCES "project_custom_roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }
}
