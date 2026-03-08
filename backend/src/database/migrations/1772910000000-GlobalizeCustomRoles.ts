import { MigrationInterface, QueryRunner } from 'typeorm';

type BusinessLineRoleRow = {
  id: string;
  businessLineId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  baseRole: string;
  capabilities: string[];
};

type ProjectRoleRow = {
  id: string;
  projectId: string | null;
  code: string | null;
  name: string;
  description: string | null;
  baseRole: string;
  capabilities: string[];
};

type MountSeed = {
  scopeId: string;
  roleId: string;
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

const buildUniqueName = (
  preferredName: string,
  occupiedNames: Set<string>,
): string => {
  if (!occupiedNames.has(preferredName)) {
    occupiedNames.add(preferredName);
    return preferredName;
  }

  let suffix = 2;
  while (occupiedNames.has(`${preferredName}-${suffix}`)) {
    suffix += 1;
  }

  const nextName = `${preferredName}-${suffix}`;
  occupiedNames.add(nextName);
  return nextName;
};

export class GlobalizeCustomRoles1772910000000 implements MigrationInterface {
  name = 'GlobalizeCustomRoles1772910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
      `ALTER TABLE "business_line_custom_role_mounts" ADD CONSTRAINT "FK_business_line_custom_role_mount_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_role_mounts" ADD CONSTRAINT "FK_business_line_custom_role_mount_role" FOREIGN KEY ("customRoleId") REFERENCES "business_line_custom_roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_role_mounts" ADD CONSTRAINT "FK_project_custom_role_mount_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_role_mounts" ADD CONSTRAINT "FK_project_custom_role_mount_role" FOREIGN KEY ("customRoleId") REFERENCES "project_custom_roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" DROP CONSTRAINT IF EXISTS "FK_business_line_custom_role_business_line"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" DROP CONSTRAINT IF EXISTS "FK_project_custom_role_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" ALTER COLUMN "businessLineId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" ALTER COLUMN "projectId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" ADD CONSTRAINT "FK_business_line_custom_role_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" ADD CONSTRAINT "FK_project_custom_role_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await this.migrateBusinessLineRoles(queryRunner);
    await this.migrateProjectRoles(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.restoreBusinessLineLocalRoles(queryRunner);
    await this.restoreProjectLocalRoles(queryRunner);

    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" DROP CONSTRAINT IF EXISTS "FK_business_line_custom_role_business_line"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" DROP CONSTRAINT IF EXISTS "FK_project_custom_role_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_role_mounts" DROP CONSTRAINT IF EXISTS "FK_business_line_custom_role_mount_role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_role_mounts" DROP CONSTRAINT IF EXISTS "FK_business_line_custom_role_mount_business_line"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_role_mounts" DROP CONSTRAINT IF EXISTS "FK_project_custom_role_mount_role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_role_mounts" DROP CONSTRAINT IF EXISTS "FK_project_custom_role_mount_project"`,
    );

    await queryRunner.query(
      `DROP TABLE IF EXISTS "business_line_custom_role_mounts"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "project_custom_role_mounts"`,
    );

    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" ALTER COLUMN "businessLineId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" ALTER COLUMN "projectId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" ADD CONSTRAINT "FK_business_line_custom_role_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" ADD CONSTRAINT "FK_project_custom_role_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  private async migrateBusinessLineRoles(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT "id", "businessLineId", "code", "name", "description", "baseRole", "capabilities" FROM "business_line_custom_roles" WHERE "businessLineId" IS NOT NULL ORDER BY "createdAt" ASC`,
    )) as BusinessLineRoleRow[];

    if (!rows.length) {
      return;
    }

    const fingerprintToGlobalId = new Map<string, string>();
    const mounts: MountSeed[] = [];

    for (const row of rows) {
      const fingerprint = buildFingerprint({
        code: row.code,
        name: row.name,
        description: row.description,
        baseRole: row.baseRole,
        capabilities: normalizeCapabilities(row.capabilities),
      });

      let globalRoleId = fingerprintToGlobalId.get(fingerprint);

      if (!globalRoleId) {
        const inserted = (await queryRunner.query(
          `INSERT INTO "business_line_custom_roles" ("businessLineId", "code", "name", "description", "baseRole", "capabilities") VALUES (NULL, $1, $2, $3, CAST($4 AS "public"."business_line_member_role_enum"), $5::jsonb) RETURNING "id"`,
          [
            row.code,
            row.name,
            row.description,
            row.baseRole,
            JSON.stringify(normalizeCapabilities(row.capabilities)),
          ],
        )) as Array<{ id: string }>;
        globalRoleId = inserted[0]?.id;
        if (!globalRoleId) {
          continue;
        }
        fingerprintToGlobalId.set(fingerprint, globalRoleId);
      }

      if (row.businessLineId) {
        mounts.push({ scopeId: row.businessLineId, roleId: globalRoleId });
      }

      await queryRunner.query(
        `UPDATE "business_line_members" SET "customRoleId" = $1 WHERE "customRoleId" = $2`,
        [globalRoleId, row.id],
      );
      await queryRunner.query(
        `UPDATE "business_line_invitations" SET "customRoleId" = $1 WHERE "customRoleId" = $2`,
        [globalRoleId, row.id],
      );
    }

    for (const mount of mounts) {
      await queryRunner.query(
        `INSERT INTO "business_line_custom_role_mounts" ("businessLineId", "customRoleId") VALUES ($1, $2) ON CONFLICT ("businessLineId", "customRoleId") DO NOTHING`,
        [mount.scopeId, mount.roleId],
      );
    }

    await queryRunner.query(
      `DELETE FROM "business_line_custom_roles" WHERE "businessLineId" IS NOT NULL`,
    );
  }

  private async migrateProjectRoles(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(
      `SELECT "id", "projectId", "code", "name", "description", "baseRole", "capabilities" FROM "project_custom_roles" WHERE "projectId" IS NOT NULL ORDER BY "createdAt" ASC`,
    )) as ProjectRoleRow[];

    if (!rows.length) {
      return;
    }

    const fingerprintToGlobalId = new Map<string, string>();
    const mounts: MountSeed[] = [];

    for (const row of rows) {
      const fingerprint = buildFingerprint({
        code: row.code,
        name: row.name,
        description: row.description,
        baseRole: row.baseRole,
        capabilities: normalizeCapabilities(row.capabilities),
      });

      let globalRoleId = fingerprintToGlobalId.get(fingerprint);

      if (!globalRoleId) {
        const inserted = (await queryRunner.query(
          `INSERT INTO "project_custom_roles" ("projectId", "code", "name", "description", "baseRole", "capabilities") VALUES (NULL, $1, $2, $3, CAST($4 AS "public"."project_member_role_enum"), $5::jsonb) RETURNING "id"`,
          [
            row.code,
            row.name,
            row.description,
            row.baseRole,
            JSON.stringify(normalizeCapabilities(row.capabilities)),
          ],
        )) as Array<{ id: string }>;
        globalRoleId = inserted[0]?.id;
        if (!globalRoleId) {
          continue;
        }
        fingerprintToGlobalId.set(fingerprint, globalRoleId);
      }

      if (row.projectId) {
        mounts.push({ scopeId: row.projectId, roleId: globalRoleId });
      }

      await queryRunner.query(
        `UPDATE "project_members" SET "customRoleId" = $1 WHERE "customRoleId" = $2`,
        [globalRoleId, row.id],
      );
    }

    for (const mount of mounts) {
      await queryRunner.query(
        `INSERT INTO "project_custom_role_mounts" ("projectId", "customRoleId") VALUES ($1, $2) ON CONFLICT ("projectId", "customRoleId") DO NOTHING`,
        [mount.scopeId, mount.roleId],
      );
    }

    await queryRunner.query(
      `DELETE FROM "project_custom_roles" WHERE "projectId" IS NOT NULL`,
    );
  }

  private async restoreBusinessLineLocalRoles(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const mounts = (await queryRunner.query(
      `SELECT mount."businessLineId" AS "businessLineId", role."id" AS "roleId", role."code" AS "code", role."name" AS "name", role."description" AS "description", role."baseRole" AS "baseRole", role."capabilities" AS "capabilities" FROM "business_line_custom_role_mounts" mount INNER JOIN "business_line_custom_roles" role ON role."id" = mount."customRoleId" ORDER BY role."createdAt" ASC`,
    )) as Array<{
      businessLineId: string;
      roleId: string;
      code: string | null;
      name: string;
      description: string | null;
      baseRole: string;
      capabilities: string[];
    }>;

    const usedNamesByBusinessLine = new Map<string, Set<string>>();
    const usedCodesByBusinessLine = new Map<string, Set<string>>();
    const localRoleIdMap = new Map<string, string>();

    for (const mount of mounts) {
      const nameSet =
        usedNamesByBusinessLine.get(mount.businessLineId) ?? new Set<string>();
      usedNamesByBusinessLine.set(mount.businessLineId, nameSet);
      const codeSet =
        usedCodesByBusinessLine.get(mount.businessLineId) ?? new Set<string>();
      usedCodesByBusinessLine.set(mount.businessLineId, codeSet);

      const nextName = buildUniqueName(mount.name, nameSet);
      const nextCode =
        mount.code && !codeSet.has(mount.code) ? mount.code : null;
      if (nextCode) {
        codeSet.add(nextCode);
      }

      const inserted = (await queryRunner.query(
        `INSERT INTO "business_line_custom_roles" ("businessLineId", "code", "name", "description", "baseRole", "capabilities") VALUES ($1, $2, $3, $4, CAST($5 AS "public"."business_line_member_role_enum"), $6::jsonb) RETURNING "id"`,
        [
          mount.businessLineId,
          nextCode,
          nextName,
          mount.description,
          mount.baseRole,
          JSON.stringify(normalizeCapabilities(mount.capabilities)),
        ],
      )) as Array<{ id: string }>;

      const localRoleId = inserted[0]?.id;
      if (!localRoleId) {
        continue;
      }

      localRoleIdMap.set(
        `${mount.businessLineId}:${mount.roleId}`,
        localRoleId,
      );
    }

    for (const [key, localRoleId] of localRoleIdMap.entries()) {
      const [businessLineId, globalRoleId] = key.split(':');
      await queryRunner.query(
        `UPDATE "business_line_members" SET "customRoleId" = $1 WHERE "businessLineId" = $2 AND "customRoleId" = $3`,
        [localRoleId, businessLineId, globalRoleId],
      );
      await queryRunner.query(
        `UPDATE "business_line_invitations" SET "customRoleId" = $1 WHERE "businessLineId" = $2 AND "customRoleId" = $3`,
        [localRoleId, businessLineId, globalRoleId],
      );
    }

    await queryRunner.query(
      `DELETE FROM "business_line_custom_roles" WHERE "businessLineId" IS NULL`,
    );
  }

  private async restoreProjectLocalRoles(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const mounts = (await queryRunner.query(
      `SELECT mount."projectId" AS "projectId", role."id" AS "roleId", role."code" AS "code", role."name" AS "name", role."description" AS "description", role."baseRole" AS "baseRole", role."capabilities" AS "capabilities" FROM "project_custom_role_mounts" mount INNER JOIN "project_custom_roles" role ON role."id" = mount."customRoleId" ORDER BY role."createdAt" ASC`,
    )) as Array<{
      projectId: string;
      roleId: string;
      code: string | null;
      name: string;
      description: string | null;
      baseRole: string;
      capabilities: string[];
    }>;

    const usedNamesByProject = new Map<string, Set<string>>();
    const usedCodesByProject = new Map<string, Set<string>>();
    const localRoleIdMap = new Map<string, string>();

    for (const mount of mounts) {
      const nameSet =
        usedNamesByProject.get(mount.projectId) ?? new Set<string>();
      usedNamesByProject.set(mount.projectId, nameSet);
      const codeSet =
        usedCodesByProject.get(mount.projectId) ?? new Set<string>();
      usedCodesByProject.set(mount.projectId, codeSet);

      const nextName = buildUniqueName(mount.name, nameSet);
      const nextCode =
        mount.code && !codeSet.has(mount.code) ? mount.code : null;
      if (nextCode) {
        codeSet.add(nextCode);
      }

      const inserted = (await queryRunner.query(
        `INSERT INTO "project_custom_roles" ("projectId", "code", "name", "description", "baseRole", "capabilities") VALUES ($1, $2, $3, $4, CAST($5 AS "public"."project_member_role_enum"), $6::jsonb) RETURNING "id"`,
        [
          mount.projectId,
          nextCode,
          nextName,
          mount.description,
          mount.baseRole,
          JSON.stringify(normalizeCapabilities(mount.capabilities)),
        ],
      )) as Array<{ id: string }>;

      const localRoleId = inserted[0]?.id;
      if (!localRoleId) {
        continue;
      }

      localRoleIdMap.set(`${mount.projectId}:${mount.roleId}`, localRoleId);
    }

    for (const [key, localRoleId] of localRoleIdMap.entries()) {
      const [projectId, globalRoleId] = key.split(':');
      await queryRunner.query(
        `UPDATE "project_members" SET "customRoleId" = $1 WHERE "projectId" = $2 AND "customRoleId" = $3`,
        [localRoleId, projectId, globalRoleId],
      );
    }

    await queryRunner.query(
      `DELETE FROM "project_custom_roles" WHERE "projectId" IS NULL`,
    );
  }
}
