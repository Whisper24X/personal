import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveBusinessLineCustomRoleMounts1772935000000
  implements MigrationInterface
{
  name = 'RemoveBusinessLineCustomRoleMounts1772935000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "business_line_custom_role_mounts"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "business_line_custom_role_mounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessLineId" uuid NOT NULL, "customRoleId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_business_line_custom_role_mounts_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_business_line_custom_role_mount" UNIQUE ("businessLineId", "customRoleId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_business_line_custom_role_mount_business_line_id" ON "business_line_custom_role_mounts" ("businessLineId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_business_line_custom_role_mount_custom_role_id" ON "business_line_custom_role_mounts" ("customRoleId")`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "business_line_custom_role_mounts" IS '业务线挂载角色'`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_role_mounts" ADD CONSTRAINT "FK_business_line_custom_role_mount_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_role_mounts" ADD CONSTRAINT "FK_business_line_custom_role_mount_role" FOREIGN KEY ("customRoleId") REFERENCES "business_line_custom_roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `INSERT INTO "business_line_custom_role_mounts" ("businessLineId", "customRoleId") SELECT role."businessLineId", role."id" FROM "business_line_custom_roles" role WHERE role."businessLineId" IS NOT NULL ON CONFLICT ("businessLineId", "customRoleId") DO NOTHING`,
    );
  }
}
