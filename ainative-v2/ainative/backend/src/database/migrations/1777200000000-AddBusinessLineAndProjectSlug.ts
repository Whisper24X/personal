import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessLineAndProjectSlug1777200000000
  implements MigrationInterface
{
  name = 'AddBusinessLineAndProjectSlug1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_lines" ADD "slug" character varying(80)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "business_lines"."slug" IS '业务线在 ainative-workspace 中的稳定标识'`,
    );
    await this.backfillBusinessLineSlugs(queryRunner);
    await queryRunner.query(
      `ALTER TABLE "business_lines" ALTER COLUMN "slug" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_business_lines_slug" ON "business_lines" ("slug") WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "projects" ADD "slug" character varying(80)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "projects"."slug" IS '项目在 ainative-workspace 中的稳定标识'`,
    );
    await this.backfillProjectSlugs(queryRunner);
    await queryRunner.query(
      `ALTER TABLE "projects" ALTER COLUMN "slug" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_projects_business_line_slug" ON "projects" ("businessLineId", "slug") WHERE "deletedAt" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_projects_business_line_slug"`,
    );
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "slug"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_business_lines_slug"`);
    await queryRunner.query(`ALTER TABLE "business_lines" DROP COLUMN "slug"`);
  }

  private async backfillBusinessLineSlugs(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      WITH base AS (
        SELECT
          id,
          "createdAt",
          COALESCE(
            NULLIF(
              LEFT(
                TRIM(
                  BOTH '-'
                  FROM regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g')
                ),
                80
              ),
              ''
            ),
            'bl-' || substring(replace(id::text, '-', ''), 1, 8)
          ) AS base_slug
        FROM "business_lines"
        WHERE slug IS NULL
      ),
      numbered AS (
        SELECT
          id,
          base_slug,
          ROW_NUMBER() OVER (
            PARTITION BY base_slug
            ORDER BY "createdAt", id
          ) AS rn
        FROM base
      )
      UPDATE "business_lines" bl
      SET slug = CASE
        WHEN n.rn = 1 THEN n.base_slug
        ELSE LEFT(
          n.base_slug || '-' || substring(replace(bl.id::text, '-', ''), 1, 6),
          80
        )
      END
      FROM numbered n
      WHERE bl.id = n.id
    `);
  }

  private async backfillProjectSlugs(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "projects" p
      SET slug = '_managed'
      FROM (
        SELECT DISTINCT ON ("businessLineId") id
        FROM "projects"
        WHERE slug IS NULL
          AND "deletedAt" IS NULL
          AND "configJson" @> '{"workspaceManaged": true}'
        ORDER BY "businessLineId", "createdAt", id
      ) managed
      WHERE p.id = managed.id
    `);

    await queryRunner.query(`
      WITH base AS (
        SELECT
          id,
          "businessLineId",
          "createdAt",
          COALESCE(
            NULLIF(
              LEFT(
                TRIM(
                  BOTH '-'
                  FROM regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g')
                ),
                80
              ),
              ''
            ),
            'proj-' || substring(replace(id::text, '-', ''), 1, 8)
          ) AS base_slug
        FROM "projects"
        WHERE slug IS NULL
      ),
      numbered AS (
        SELECT
          id,
          base_slug,
          ROW_NUMBER() OVER (
            PARTITION BY "businessLineId", base_slug
            ORDER BY "createdAt", id
          ) AS rn
        FROM base
      )
      UPDATE "projects" p
      SET slug = CASE
        WHEN n.rn = 1 THEN n.base_slug
        ELSE LEFT(
          n.base_slug || '-' || substring(replace(p.id::text, '-', ''), 1, 6),
          80
        )
      END
      FROM numbered n
      WHERE p.id = n.id
    `);
  }
}
