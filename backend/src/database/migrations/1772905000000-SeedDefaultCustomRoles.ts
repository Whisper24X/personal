import { MigrationInterface, QueryRunner } from 'typeorm';

const BUSINESS_LINE_ROLE_TEMPLATES = [
  {
    code: 'owner',
    name: 'owner',
    description: '拥有业务线全部能力',
    baseRole: 'owner',
    capabilities: [
      'businessLine.read',
      'businessLine.update',
      'businessLine.delete',
      'businessLine.member.manage',
      'businessLine.project.list.all',
      'businessLine.project.create',
      'businessLine.project.update',
      'businessLine.project.delete',
    ],
  },
  {
    code: 'admin',
    name: 'admin',
    description: '可管理成员和项目条目，但不是 owner',
    baseRole: 'admin',
    capabilities: [
      'businessLine.read',
      'businessLine.member.manage',
      'businessLine.project.list.all',
      'businessLine.project.create',
      'businessLine.project.update',
      'businessLine.project.delete',
    ],
  },
  {
    code: 'member',
    name: 'member',
    description: '仅查看业务线和自己加入的项目',
    baseRole: 'member',
    capabilities: ['businessLine.read', 'businessLine.project.list.joined'],
  },
] as const;

const PROJECT_ROLE_TEMPLATES = [
  {
    code: 'owner',
    name: 'owner',
    description: '项目内全部能力',
    baseRole: 'owner',
    capabilities: [
      'project.read',
      'project.update',
      'project.delete',
      'project.member.manage',
      'project.task.read',
      'project.task.create',
      'project.task.execute',
      'project.task.cancel',
      'project.kanban.view',
      'project.workflow.view',
      'project.workflow.manage',
      'project.artifact.read',
    ],
  },
  {
    code: 'maintainer',
    name: 'maintainer',
    description: '可管理成员、配置和工作流，但不能删项目/授予 owner',
    baseRole: 'maintainer',
    capabilities: [
      'project.read',
      'project.update',
      'project.member.manage',
      'project.task.read',
      'project.task.create',
      'project.task.execute',
      'project.task.cancel',
      'project.kanban.view',
      'project.workflow.view',
      'project.workflow.manage',
      'project.artifact.read',
    ],
  },
  {
    code: 'developer',
    name: 'developer',
    description: '可执行开发任务和查看工作流',
    baseRole: 'developer',
    capabilities: [
      'project.read',
      'project.task.read',
      'project.task.create',
      'project.task.execute',
      'project.kanban.view',
      'project.workflow.view',
      'project.artifact.read',
    ],
  },
  {
    code: 'viewer',
    name: 'viewer',
    description: '只读访问',
    baseRole: 'viewer',
    capabilities: [
      'project.read',
      'project.task.read',
      'project.kanban.view',
      'project.workflow.view',
      'project.artifact.read',
    ],
  },
] as const;

type ScopeRoleRow = {
  id: string;
  name: string;
  code: string | null;
};

const buildAvailableDefaultRoleName = (
  preferredName: string,
  occupiedNames: Set<string>,
): string => {
  if (!occupiedNames.has(preferredName)) {
    return preferredName;
  }

  const baseName = `${preferredName}-default`;
  if (!occupiedNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  while (occupiedNames.has(`${baseName}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseName}-${suffix}`;
};

export class SeedDefaultCustomRoles1772905000000 implements MigrationInterface {
  name = 'SeedDefaultCustomRoles1772905000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" ADD "code" character varying(64)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "business_line_custom_roles"."code" IS '默认角色代码，空表示自定义角色'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_business_line_custom_role_code" ON "business_line_custom_roles" ("businessLineId", "code") WHERE "code" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" ADD "code" character varying(64)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "project_custom_roles"."code" IS '默认角色代码，空表示自定义角色'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_project_custom_role_code" ON "project_custom_roles" ("projectId", "code") WHERE "code" IS NOT NULL`,
    );

    const businessLines = (await queryRunner.query(
      `SELECT id FROM "business_lines"`,
    )) as Array<{ id: string }>;

    for (const businessLine of businessLines) {
      const existingRoles = (await queryRunner.query(
        `SELECT id, name, code FROM "business_line_custom_roles" WHERE "businessLineId" = $1`,
        [businessLine.id],
      )) as ScopeRoleRow[];
      const existingCodes = new Set(
        existingRoles
          .map((role) => role.code)
          .filter((code): code is string => Boolean(code)),
      );
      const existingNames = new Set(existingRoles.map((role) => role.name));

      for (const template of BUSINESS_LINE_ROLE_TEMPLATES) {
        if (existingCodes.has(template.code)) {
          continue;
        }

        const roleName = buildAvailableDefaultRoleName(
          template.name,
          existingNames,
        );
        await queryRunner.query(
          `INSERT INTO "business_line_custom_roles" ("businessLineId", "code", "name", "description", "baseRole", "capabilities") VALUES ($1, $2, $3, $4, CAST($5 AS "public"."business_line_member_role_enum"), $6::jsonb)`,
          [
            businessLine.id,
            template.code,
            roleName,
            template.description,
            template.baseRole,
            JSON.stringify(template.capabilities),
          ],
        );
        existingCodes.add(template.code);
        existingNames.add(roleName);
      }
    }

    const projects = (await queryRunner.query(
      `SELECT id FROM "projects"`,
    )) as Array<{ id: string }>;

    for (const project of projects) {
      const existingRoles = (await queryRunner.query(
        `SELECT id, name, code FROM "project_custom_roles" WHERE "projectId" = $1`,
        [project.id],
      )) as ScopeRoleRow[];
      const existingCodes = new Set(
        existingRoles
          .map((role) => role.code)
          .filter((code): code is string => Boolean(code)),
      );
      const existingNames = new Set(existingRoles.map((role) => role.name));

      for (const template of PROJECT_ROLE_TEMPLATES) {
        if (existingCodes.has(template.code)) {
          continue;
        }

        const roleName = buildAvailableDefaultRoleName(
          template.name,
          existingNames,
        );
        await queryRunner.query(
          `INSERT INTO "project_custom_roles" ("projectId", "code", "name", "description", "baseRole", "capabilities") VALUES ($1, $2, $3, $4, CAST($5 AS "public"."project_member_role_enum"), $6::jsonb)`,
          [
            project.id,
            template.code,
            roleName,
            template.description,
            template.baseRole,
            JSON.stringify(template.capabilities),
          ],
        );
        existingCodes.add(template.code);
        existingNames.add(roleName);
      }
    }

    await queryRunner.query(`
      UPDATE "business_line_members" AS member
      SET "customRoleId" = role.id
      FROM "business_line_custom_roles" AS role
      WHERE member."customRoleId" IS NULL
        AND role."businessLineId" = member."businessLineId"
        AND role."code" = member."role"::text
    `);

    await queryRunner.query(`
      UPDATE "business_line_invitations" AS invitation
      SET "customRoleId" = role.id
      FROM "business_line_custom_roles" AS role
      WHERE invitation."customRoleId" IS NULL
        AND role."businessLineId" = invitation."businessLineId"
        AND role."code" = invitation."role"::text
    `);

    await queryRunner.query(`
      UPDATE "project_members" AS member
      SET "customRoleId" = role.id
      FROM "project_custom_roles" AS role
      WHERE member."customRoleId" IS NULL
        AND role."projectId" = member."projectId"
        AND role."code" = member."role"::text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "project_members" AS member
      SET "customRoleId" = NULL
      FROM "project_custom_roles" AS role
      WHERE member."customRoleId" = role.id
        AND role."code" IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "business_line_invitations" AS invitation
      SET "customRoleId" = NULL
      FROM "business_line_custom_roles" AS role
      WHERE invitation."customRoleId" = role.id
        AND role."code" IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "business_line_members" AS member
      SET "customRoleId" = NULL
      FROM "business_line_custom_roles" AS role
      WHERE member."customRoleId" = role.id
        AND role."code" IS NOT NULL
    `);

    await queryRunner.query(
      `DELETE FROM "project_custom_roles" WHERE "code" IS NOT NULL`,
    );
    await queryRunner.query(
      `DELETE FROM "business_line_custom_roles" WHERE "code" IS NOT NULL`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."UQ_project_custom_role_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "project_custom_roles" DROP COLUMN "code"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."UQ_business_line_custom_role_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_line_custom_roles" DROP COLUMN "code"`,
    );
  }
}
