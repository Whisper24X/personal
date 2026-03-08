import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveProjectCustomRoleMounts1772925000000
  implements MigrationInterface
{
  name = 'RemoveProjectCustomRoleMounts1772925000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "project_custom_role_mounts"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "project_custom_role_mounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "customRoleId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_project_custom_role_mounts_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_project_custom_role_mount" UNIQUE ("projectId", "customRoleId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_project_custom_role_mount_project_id" ON "project_custom_role_mounts" ("projectId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_project_custom_role_mount_custom_role_id" ON "project_custom_role_mounts" ("customRoleId")`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "project_custom_role_mounts" IS '项目挂载角色'`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_role_mounts" ADD CONSTRAINT "FK_project_custom_role_mount_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_role_mounts" ADD CONSTRAINT "FK_project_custom_role_mount_role" FOREIGN KEY ("customRoleId") REFERENCES "project_custom_roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `
        INSERT INTO "project_custom_role_mounts" ("projectId", "customRoleId")
        SELECT project."id", role."id"
        FROM "projects" project
        INNER JOIN "project_custom_roles" role
          ON role."businessLineId" = project."businessLineId"
        ON CONFLICT ("projectId", "customRoleId") DO NOTHING
      `,
    );
  }
}
