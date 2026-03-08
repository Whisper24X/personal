import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomScopeRoles1772900000000 implements MigrationInterface {
  name = 'AddCustomScopeRoles1772900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "business_line_custom_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid NOT NULL, "name" character varying(120) NOT NULL, "description" character varying(255), "baseRole" "public"."business_line_member_role_enum" NOT NULL, "capabilities" jsonb NOT NULL DEFAULT '[]'::jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_business_line_custom_roles_id" PRIMARY KEY ("id")); COMMENT ON COLUMN "business_line_custom_roles"."id" IS '主键（UUID）'; COMMENT ON COLUMN "business_line_custom_roles"."businessLineId" IS '关联业务线ID'; COMMENT ON COLUMN "business_line_custom_roles"."name" IS '角色名称'; COMMENT ON COLUMN "business_line_custom_roles"."description" IS '角色描述'; COMMENT ON COLUMN "business_line_custom_roles"."baseRole" IS '角色基础内置角色'; COMMENT ON COLUMN "business_line_custom_roles"."capabilities" IS '能力码列表(JSON)'; COMMENT ON COLUMN "business_line_custom_roles"."createdAt" IS '创建时间'; COMMENT ON COLUMN "business_line_custom_roles"."updatedAt" IS '更新时间'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_business_line_custom_role_name" ON "business_line_custom_roles" ("businessLineId", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_custom_role_business_line_id" ON "business_line_custom_roles" ("businessLineId")`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "business_line_custom_roles" IS '业务线自定义角色'`,
    );

    await queryRunner.query(
      `CREATE TABLE "project_custom_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "name" character varying(120) NOT NULL, "description" character varying(255), "baseRole" "public"."project_member_role_enum" NOT NULL, "capabilities" jsonb NOT NULL DEFAULT '[]'::jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_project_custom_roles_id" PRIMARY KEY ("id")); COMMENT ON COLUMN "project_custom_roles"."id" IS '主键（UUID）'; COMMENT ON COLUMN "project_custom_roles"."projectId" IS '关联项目ID'; COMMENT ON COLUMN "project_custom_roles"."name" IS '角色名称'; COMMENT ON COLUMN "project_custom_roles"."description" IS '角色描述'; COMMENT ON COLUMN "project_custom_roles"."baseRole" IS '角色基础内置角色'; COMMENT ON COLUMN "project_custom_roles"."capabilities" IS '能力码列表(JSON)'; COMMENT ON COLUMN "project_custom_roles"."createdAt" IS '创建时间'; COMMENT ON COLUMN "project_custom_roles"."updatedAt" IS '更新时间'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_custom_role_name" ON "project_custom_roles" ("projectId", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_custom_role_project_id" ON "project_custom_roles" ("projectId")`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "project_custom_roles" IS '项目自定义角色'`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD "customRoleId" uuid`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "business_line_members"."customRoleId" IS '关联自定义角色ID'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_member_custom_role_id" ON "business_line_members" ("customRoleId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "project_members" ADD "customRoleId" uuid`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "project_members"."customRoleId" IS '关联自定义角色ID'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_members_custom_role_id" ON "project_members" ("customRoleId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD "customRoleId" uuid`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "business_line_invitations"."customRoleId" IS '关联自定义角色ID'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_line_invitation_custom_role_id" ON "business_line_invitations" ("customRoleId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" ADD CONSTRAINT "FK_business_line_custom_role_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" ADD CONSTRAINT "FK_project_custom_role_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" ADD CONSTRAINT "FK_business_line_member_custom_role" FOREIGN KEY ("customRoleId") REFERENCES "business_line_custom_roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" ADD CONSTRAINT "FK_project_member_custom_role" FOREIGN KEY ("customRoleId") REFERENCES "project_custom_roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" ADD CONSTRAINT "FK_business_line_invitation_custom_role" FOREIGN KEY ("customRoleId") REFERENCES "business_line_custom_roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" DROP CONSTRAINT "FK_business_line_invitation_custom_role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" DROP CONSTRAINT "FK_project_member_custom_role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP CONSTRAINT "FK_business_line_member_custom_role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" DROP CONSTRAINT "FK_project_custom_role_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" DROP CONSTRAINT "FK_business_line_custom_role_business_line"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_business_line_invitation_custom_role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_invitations" DROP COLUMN "customRoleId"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_project_members_custom_role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_members" DROP COLUMN "customRoleId"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_business_line_member_custom_role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_members" DROP COLUMN "customRoleId"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."IDX_project_custom_role_project_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_project_custom_role_name"`,
    );
    await queryRunner.query(`DROP TABLE "project_custom_roles"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_business_line_custom_role_business_line_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_business_line_custom_role_name"`,
    );
    await queryRunner.query(`DROP TABLE "business_line_custom_roles"`);
  }
}
