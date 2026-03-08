import { MigrationInterface, QueryRunner } from 'typeorm';

type LegacyProjectRoleRow = {
  id: string;
  projectId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  baseRole: string;
  capabilities: string[];
};

type ScopedProjectRoleRow = {
  id: string;
  businessLineId: string;
  code: string | null;
  name: string;
  description: string | null;
  baseRole: string;
  capabilities: string[];
};

type ProjectRoleScopeRow = {
  roleId: string;
  businessLineId: string;
};

const normalizeCapabilities = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .sort();
};

const buildFingerprint = (input: {
  code: string | null;
  name: string;
  description: string | null;
  baseRole: string;
  capabilities: string[];
}): string => {
  return JSON.stringify({
    code: input.code ?? null,
    name: input.name,
    description: input.description ?? null,
    baseRole: input.baseRole,
    capabilities: normalizeCapabilities(input.capabilities),
  });
};

export class ScopeProjectRolesByBusinessLine1772920000000
  implements MigrationInterface
{
  name = 'ScopeProjectRolesByBusinessLine1772920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" ADD "businessLineId" uuid`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "project_custom_roles"."businessLineId" IS '所属业务线ID'`,
    );

    const legacyRoles = (await queryRunner.query(
      `SELECT "id", "projectId", "code", "name", "description", "baseRole", "capabilities" FROM "project_custom_roles" ORDER BY "createdAt" ASC`,
    )) as LegacyProjectRoleRow[];

    const scopedRoleRows = (await queryRunner.query(
      `
        SELECT DISTINCT scoped."roleId" AS "roleId", scoped."businessLineId" AS "businessLineId"
        FROM (
          SELECT role."id" AS "roleId", project."businessLineId" AS "businessLineId"
          FROM "project_custom_roles" role
          INNER JOIN "projects" project ON project."id" = role."projectId"
          WHERE role."projectId" IS NOT NULL
          UNION
          SELECT mount."customRoleId" AS "roleId", project."businessLineId" AS "businessLineId"
          FROM "project_custom_role_mounts" mount
          INNER JOIN "projects" project ON project."id" = mount."projectId"
          UNION
          SELECT member."customRoleId" AS "roleId", project."businessLineId" AS "businessLineId"
          FROM "project_members" member
          INNER JOIN "projects" project ON project."id" = member."projectId"
          WHERE member."customRoleId" IS NOT NULL
        ) scoped
        WHERE scoped."businessLineId" IS NOT NULL
      `,
    )) as ProjectRoleScopeRow[];

    const businessLineIdsByRoleId = new Map<string, string[]>();
    for (const row of scopedRoleRows) {
      const existedIds = businessLineIdsByRoleId.get(row.roleId) ?? [];
      if (!existedIds.includes(row.businessLineId)) {
        existedIds.push(row.businessLineId);
      }
      businessLineIdsByRoleId.set(row.roleId, existedIds);
    }

    const nextRoleIdMap = new Map<string, string>();

    for (const role of legacyRoles) {
      const businessLineIds = businessLineIdsByRoleId.get(role.id) ?? [];

      for (const businessLineId of businessLineIds) {
        const inserted = (await queryRunner.query(
          `INSERT INTO "project_custom_roles" ("businessLineId", "code", "name", "description", "baseRole", "capabilities") VALUES ($1, $2, $3, $4, CAST($5 AS "public"."project_member_role_enum"), $6::jsonb) RETURNING "id"`,
          [
            businessLineId,
            role.code,
            role.name,
            role.description,
            role.baseRole,
            JSON.stringify(normalizeCapabilities(role.capabilities)),
          ],
        )) as Array<{ id: string }>;

        const nextRoleId = inserted[0]?.id;
        if (!nextRoleId) {
          continue;
        }

        nextRoleIdMap.set(`${role.id}:${businessLineId}`, nextRoleId);
      }
    }

    for (const [key, nextRoleId] of nextRoleIdMap.entries()) {
      const [legacyRoleId, businessLineId] = key.split(':');

      await queryRunner.query(
        `
          UPDATE "project_custom_role_mounts" AS mount
          SET "customRoleId" = $1
          FROM "projects" AS project
          WHERE project."id" = mount."projectId"
            AND project."businessLineId" = $2
            AND mount."customRoleId" = $3
        `,
        [nextRoleId, businessLineId, legacyRoleId],
      );

      await queryRunner.query(
        `
          UPDATE "project_members" AS member
          SET "customRoleId" = $1
          FROM "projects" AS project
          WHERE project."id" = member."projectId"
            AND project."businessLineId" = $2
            AND member."customRoleId" = $3
        `,
        [nextRoleId, businessLineId, legacyRoleId],
      );
    }

    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" DROP CONSTRAINT IF EXISTS "FK_project_custom_role_project"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_custom_role_project_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_project_custom_role_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_project_custom_role_code"`,
    );
    await queryRunner.query(
      `DELETE FROM "project_custom_roles" WHERE "businessLineId" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" ALTER COLUMN "businessLineId" SET NOT NULL`,
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
      `ALTER TABLE "project_custom_roles" ADD CONSTRAINT "FK_project_custom_role_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" DROP COLUMN "projectId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" ADD "projectId" uuid`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "project_custom_roles"."projectId" IS '历史关联项目ID，通用角色为空'`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" ALTER COLUMN "businessLineId" DROP NOT NULL`,
    );

    const scopedRoles = (await queryRunner.query(
      `SELECT "id", "businessLineId", "code", "name", "description", "baseRole", "capabilities" FROM "project_custom_roles" WHERE "businessLineId" IS NOT NULL ORDER BY "createdAt" ASC`,
    )) as ScopedProjectRoleRow[];

    const fingerprintToGlobalId = new Map<string, string>();

    for (const role of scopedRoles) {
      const fingerprint = buildFingerprint({
        code: role.code,
        name: role.name,
        description: role.description,
        baseRole: role.baseRole,
        capabilities: normalizeCapabilities(role.capabilities),
      });

      let globalRoleId = fingerprintToGlobalId.get(fingerprint);

      if (!globalRoleId) {
        const inserted = (await queryRunner.query(
          `INSERT INTO "project_custom_roles" ("projectId", "code", "name", "description", "baseRole", "capabilities") VALUES (NULL, $1, $2, $3, CAST($4 AS "public"."project_member_role_enum"), $5::jsonb) RETURNING "id"`,
          [
            role.code,
            role.name,
            role.description,
            role.baseRole,
            JSON.stringify(normalizeCapabilities(role.capabilities)),
          ],
        )) as Array<{ id: string }>;
        globalRoleId = inserted[0]?.id;
        if (!globalRoleId) {
          continue;
        }
        fingerprintToGlobalId.set(fingerprint, globalRoleId);
      }

      await queryRunner.query(
        `
          UPDATE "project_custom_role_mounts" AS mount
          SET "customRoleId" = $1
          FROM "projects" AS project
          WHERE project."id" = mount."projectId"
            AND project."businessLineId" = $2
            AND mount."customRoleId" = $3
        `,
        [globalRoleId, role.businessLineId, role.id],
      );

      await queryRunner.query(
        `
          UPDATE "project_members" AS member
          SET "customRoleId" = $1
          FROM "projects" AS project
          WHERE project."id" = member."projectId"
            AND project."businessLineId" = $2
            AND member."customRoleId" = $3
        `,
        [globalRoleId, role.businessLineId, role.id],
      );
    }

    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" DROP CONSTRAINT IF EXISTS "FK_project_custom_role_business_line"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_project_custom_role_business_line_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_project_custom_role_business_line_name"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_project_custom_role_business_line_code"`,
    );
    await queryRunner.query(
      `DELETE FROM "project_custom_roles" WHERE "businessLineId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_project_custom_role_project_id" ON "project_custom_roles" ("projectId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_custom_role_name" ON "project_custom_roles" ("projectId", "name")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_custom_role_code" ON "project_custom_roles" ("projectId", "code") WHERE "code" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" ADD CONSTRAINT "FK_project_custom_role_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" DROP COLUMN "businessLineId"`,
    );
  }
}
