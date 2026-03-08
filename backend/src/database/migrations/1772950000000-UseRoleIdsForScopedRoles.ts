import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseRoleIdsForScopedRoles1772950000000
  implements MigrationInterface
{
  name = 'UseRoleIdsForScopedRoles1772950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'business_line_members' AND column_name = 'customRoleId'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'business_line_members' AND column_name = 'roleId'
        ) THEN
          ALTER TABLE "business_line_members" RENAME COLUMN "customRoleId" TO "roleId";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'business_line_invitations' AND column_name = 'customRoleId'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'business_line_invitations' AND column_name = 'roleId'
        ) THEN
          ALTER TABLE "business_line_invitations" RENAME COLUMN "customRoleId" TO "roleId";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'project_members' AND column_name = 'customRoleId'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'project_members' AND column_name = 'roleId'
        ) THEN
          ALTER TABLE "project_members" RENAME COLUMN "customRoleId" TO "roleId";
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD COLUMN IF NOT EXISTS "roleId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD COLUMN IF NOT EXISTS "roleId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "roleId" uuid`,
    );

    await queryRunner.query(`
      UPDATE "business_line_members" member
      SET "roleId" = role."id"
      FROM "business_line_roles" role
      WHERE member."roleId" IS NULL
        AND role."businessLineId" = member."businessLineId"
        AND (
          (EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'business_line_roles' AND column_name = 'code'
          ) AND role."code" = member."businessLineRoleCode")
          OR LOWER(role."name") = LOWER(member."businessLineRoleCode")
        )
    `);

    await queryRunner.query(`
      UPDATE "business_line_invitations" invitation
      SET "roleId" = role."id"
      FROM "business_line_roles" role
      WHERE invitation."roleId" IS NULL
        AND role."businessLineId" = invitation."businessLineId"
        AND (
          (EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'business_line_roles' AND column_name = 'code'
          ) AND role."code" = invitation."businessLineRoleCode")
          OR LOWER(role."name") = LOWER(invitation."businessLineRoleCode")
        )
    `);

    await queryRunner.query(`
      UPDATE "project_members" member
      SET "roleId" = role."id"
      FROM "projects" project
      INNER JOIN "project_roles" role
        ON role."businessLineId" = project."businessLineId"
      WHERE member."roleId" IS NULL
        AND project."id" = member."projectId"
        AND (
          (EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'project_roles' AND column_name = 'code'
          ) AND role."code" = member."projectRoleCode")
          OR LOWER(role."name") = LOWER(member."projectRoleCode")
        )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_business_line_member_role_id" ON "business_line_members" ("roleId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_business_line_invitation_role_id" ON "business_line_invitations" ("roleId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_project_members_role_id" ON "project_members" ("roleId")`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_business_line_member_role'
        ) THEN
          ALTER TABLE "business_line_members"
          ADD CONSTRAINT "FK_business_line_member_role"
          FOREIGN KEY ("roleId") REFERENCES "business_line_roles"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_business_line_invitation_role'
        ) THEN
          ALTER TABLE "business_line_invitations"
          ADD CONSTRAINT "FK_business_line_invitation_role"
          FOREIGN KEY ("roleId") REFERENCES "business_line_roles"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_project_member_role'
        ) THEN
          ALTER TABLE "project_members"
          ADD CONSTRAINT "FK_project_member_role"
          FOREIGN KEY ("roleId") REFERENCES "project_roles"("id")
          ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

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

    await queryRunner.query(`
      UPDATE "business_line_roles"
      SET "code" = CASE
        WHEN LOWER("name") = 'owner' OR LOWER("name") LIKE 'owner-default%' THEN 'owner'
        WHEN LOWER("name") = 'admin' OR LOWER("name") LIKE 'admin-default%' THEN 'admin'
        WHEN LOWER("name") = 'member' OR LOWER("name") LIKE 'member-default%' THEN 'member'
        ELSE "code"
      END
    `);
    await queryRunner.query(`
      UPDATE "project_roles"
      SET "code" = CASE
        WHEN LOWER("name") = 'owner' OR LOWER("name") LIKE 'owner-default%' THEN 'owner'
        WHEN LOWER("name") = 'maintainer' OR LOWER("name") LIKE 'maintainer-default%' THEN 'maintainer'
        WHEN LOWER("name") = 'developer' OR LOWER("name") LIKE 'developer-default%' THEN 'developer'
        WHEN LOWER("name") = 'viewer' OR LOWER("name") LIKE 'viewer-default%' THEN 'viewer'
        ELSE "code"
      END
    `);

    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD COLUMN IF NOT EXISTS "businessLineRoleCode" character varying(64)`,
    );
    await queryRunner.query(`
      UPDATE "business_line_members" member
      SET "businessLineRoleCode" = role."code"
      FROM "business_line_roles" role
      WHERE member."roleId" = role."id"
    `);

    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD COLUMN IF NOT EXISTS "businessLineRoleCode" character varying(64)`,
    );
    await queryRunner.query(`
      UPDATE "business_line_invitations" invitation
      SET "businessLineRoleCode" = role."code"
      FROM "business_line_roles" role
      WHERE invitation."roleId" = role."id"
    `);

    await queryRunner.query(
      `ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "projectRoleCode" character varying(64)`,
    );
    await queryRunner.query(`
      UPDATE "project_members" member
      SET "projectRoleCode" = role."code"
      FROM "project_roles" role
      WHERE member."roleId" = role."id"
    `);

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
