import { MigrationInterface, QueryRunner } from 'typeorm';

type ScopedBusinessLineRoleRow = {
  id: string;
  businessLineId: string;
  code: string | null;
  name: string;
  description: string | null;
  baseRole: string;
  capabilities: string[];
};

type BusinessLineRoleScopeRow = {
  businessLineId: string;
  roleId: string;
  code: string | null;
  name: string;
  description: string | null;
  baseRole: string;
  capabilities: string[];
  createdAt: string;
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

export class ScopeBusinessLineRolesByBusinessLine1772930000000
  implements MigrationInterface
{
  name = 'ScopeBusinessLineRolesByBusinessLine1772930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const scopedRoles = (await queryRunner.query(
      `
        SELECT DISTINCT scoped."businessLineId" AS "businessLineId", scoped."roleId" AS "roleId", role."code" AS "code", role."name" AS "name", role."description" AS "description", role."baseRole" AS "baseRole", role."capabilities" AS "capabilities", role."createdAt" AS "createdAt"
        FROM (
          SELECT mount."businessLineId" AS "businessLineId", mount."customRoleId" AS "roleId"
          FROM "business_line_custom_role_mounts" mount
          UNION
          SELECT member."businessLineId" AS "businessLineId", member."customRoleId" AS "roleId"
          FROM "business_line_members" member
          WHERE member."customRoleId" IS NOT NULL
          UNION
          SELECT invitation."businessLineId" AS "businessLineId", invitation."customRoleId" AS "roleId"
          FROM "business_line_invitations" invitation
          WHERE invitation."customRoleId" IS NOT NULL
        ) scoped
        INNER JOIN "business_line_custom_roles" role ON role."id" = scoped."roleId"
        WHERE scoped."businessLineId" IS NOT NULL
          AND role."businessLineId" IS NULL
        ORDER BY role."createdAt" ASC
      `,
    )) as BusinessLineRoleScopeRow[];

    const existingLocalRoles = (await queryRunner.query(
      `SELECT "id", "businessLineId", "code", "name", "description", "baseRole", "capabilities" FROM "business_line_custom_roles" WHERE "businessLineId" IS NOT NULL ORDER BY "createdAt" ASC`,
    )) as ScopedBusinessLineRoleRow[];

    const usedNamesByBusinessLine = new Map<string, Set<string>>();
    const usedCodesByBusinessLine = new Map<string, Set<string>>();
    const existingRoleIdByFingerprint = new Map<string, string>();
    const existingRoleIdByCode = new Map<string, string>();
    const nextRoleIdMap = new Map<string, string>();

    for (const role of existingLocalRoles) {
      const nameSet =
        usedNamesByBusinessLine.get(role.businessLineId) ?? new Set<string>();
      nameSet.add(role.name);
      usedNamesByBusinessLine.set(role.businessLineId, nameSet);

      const codeSet =
        usedCodesByBusinessLine.get(role.businessLineId) ?? new Set<string>();
      if (role.code) {
        codeSet.add(role.code);
        existingRoleIdByCode.set(
          `${role.businessLineId}:${role.code}`,
          role.id,
        );
      }
      usedCodesByBusinessLine.set(role.businessLineId, codeSet);

      const fingerprint = buildFingerprint({
        code: role.code,
        name: role.name,
        description: role.description,
        baseRole: role.baseRole,
        capabilities: normalizeCapabilities(role.capabilities),
      });
      existingRoleIdByFingerprint.set(
        `${role.businessLineId}:${fingerprint}`,
        role.id,
      );
    }

    for (const role of scopedRoles) {
      const fingerprint = buildFingerprint({
        code: role.code,
        name: role.name,
        description: role.description,
        baseRole: role.baseRole,
        capabilities: normalizeCapabilities(role.capabilities),
      });

      const reusedRoleId =
        existingRoleIdByFingerprint.get(
          `${role.businessLineId}:${fingerprint}`,
        ) ??
        (role.code
          ? existingRoleIdByCode.get(`${role.businessLineId}:${role.code}`)
          : undefined);

      if (reusedRoleId) {
        nextRoleIdMap.set(
          `${role.businessLineId}:${role.roleId}`,
          reusedRoleId,
        );
        continue;
      }

      const nameSet =
        usedNamesByBusinessLine.get(role.businessLineId) ?? new Set<string>();
      usedNamesByBusinessLine.set(role.businessLineId, nameSet);
      const codeSet =
        usedCodesByBusinessLine.get(role.businessLineId) ?? new Set<string>();
      usedCodesByBusinessLine.set(role.businessLineId, codeSet);

      const nextName = buildUniqueName(role.name, nameSet);
      const nextCode = role.code && !codeSet.has(role.code) ? role.code : null;
      if (nextCode) {
        codeSet.add(nextCode);
      }

      const inserted = (await queryRunner.query(
        `INSERT INTO "business_line_custom_roles" ("businessLineId", "code", "name", "description", "baseRole", "capabilities") VALUES ($1, $2, $3, $4, CAST($5 AS "public"."business_line_member_role_enum"), $6::jsonb) RETURNING "id"`,
        [
          role.businessLineId,
          nextCode,
          nextName,
          role.description,
          role.baseRole,
          JSON.stringify(normalizeCapabilities(role.capabilities)),
        ],
      )) as Array<{ id: string }>;

      const nextRoleId = inserted[0]?.id;
      if (!nextRoleId) {
        continue;
      }

      existingRoleIdByFingerprint.set(
        `${role.businessLineId}:${fingerprint}`,
        nextRoleId,
      );
      if (nextCode) {
        existingRoleIdByCode.set(
          `${role.businessLineId}:${nextCode}`,
          nextRoleId,
        );
      }
      nextRoleIdMap.set(`${role.businessLineId}:${role.roleId}`, nextRoleId);
    }

    for (const [key, nextRoleId] of nextRoleIdMap.entries()) {
      const [businessLineId, legacyRoleId] = key.split(':');

      await queryRunner.query(
        `UPDATE "business_line_members" SET "customRoleId" = $1 WHERE "businessLineId" = $2 AND "customRoleId" = $3`,
        [nextRoleId, businessLineId, legacyRoleId],
      );
      await queryRunner.query(
        `UPDATE "business_line_invitations" SET "customRoleId" = $1 WHERE "businessLineId" = $2 AND "customRoleId" = $3`,
        [nextRoleId, businessLineId, legacyRoleId],
      );
    }

    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" DROP CONSTRAINT IF EXISTS "FK_business_line_custom_role_business_line"`,
    );
    await queryRunner.query(
      `DELETE FROM "business_line_custom_roles" WHERE "businessLineId" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" ALTER COLUMN "businessLineId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" ADD CONSTRAINT "FK_business_line_custom_role_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
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
      `ALTER TABLE "business_line_custom_roles" DROP CONSTRAINT IF EXISTS "FK_business_line_custom_role_business_line"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" ALTER COLUMN "businessLineId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" ADD CONSTRAINT "FK_business_line_custom_role_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    const scopedRoles = (await queryRunner.query(
      `SELECT "id", "businessLineId", "code", "name", "description", "baseRole", "capabilities" FROM "business_line_custom_roles" WHERE "businessLineId" IS NOT NULL ORDER BY "createdAt" ASC`,
    )) as ScopedBusinessLineRoleRow[];

    const fingerprintToGlobalId = new Map<string, string>();
    const mounts: MountSeed[] = [];

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
          `INSERT INTO "business_line_custom_roles" ("businessLineId", "code", "name", "description", "baseRole", "capabilities") VALUES (NULL, $1, $2, $3, CAST($4 AS "public"."business_line_member_role_enum"), $5::jsonb) RETURNING "id"`,
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

      mounts.push({ scopeId: role.businessLineId, roleId: globalRoleId });

      await queryRunner.query(
        `UPDATE "business_line_members" SET "customRoleId" = $1 WHERE "businessLineId" = $2 AND "customRoleId" = $3`,
        [globalRoleId, role.businessLineId, role.id],
      );
      await queryRunner.query(
        `UPDATE "business_line_invitations" SET "customRoleId" = $1 WHERE "businessLineId" = $2 AND "customRoleId" = $3`,
        [globalRoleId, role.businessLineId, role.id],
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
}
