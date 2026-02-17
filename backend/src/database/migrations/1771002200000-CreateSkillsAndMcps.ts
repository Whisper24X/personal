import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSkillsAndMcps1771002200000 implements MigrationInterface {
  name = 'CreateSkillsAndMcps1771002200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "skills" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "version" character varying(40) NOT NULL,
        "description" text,
        "scope" character varying(60),
        "homepage_url" character varying(255),
        "metadata_json" jsonb,
        "enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_skills_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_skills_name_version" UNIQUE ("name", "version")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_skills_name" ON "skills" ("name")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_skills_enabled" ON "skills" ("enabled")
    `);

    await queryRunner.query(`
      CREATE TABLE "mcps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(120) NOT NULL,
        "version" character varying(40) NOT NULL,
        "description" text,
        "provider" character varying(120),
        "tools_count" integer NOT NULL DEFAULT 0,
        "config_schema" jsonb,
        "metadata_json" jsonb,
        "enabled" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_mcps_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_mcps_name_version" UNIQUE ("name", "version")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_mcps_name" ON "mcps" ("name")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_mcps_enabled" ON "mcps" ("enabled")
    `);

    await queryRunner.query(`
      INSERT INTO "skills" (
        "name",
        "version",
        "description",
        "scope",
        "homepage_url",
        "enabled"
      ) VALUES
      (
        'openspec-apply-change',
        '1.0.0',
        'Implement tasks from an OpenSpec change workflow.',
        'implementation',
        'https://example.com/skills/openspec-apply-change',
        true
      ),
      (
        'openspec-verify-change',
        '1.0.0',
        'Verify implementation matches OpenSpec artifacts.',
        'verification',
        'https://example.com/skills/openspec-verify-change',
        true
      ),
      (
        'vue-best-practices',
        '17.0.0',
        'Vue 3 and Composition API best practices guide.',
        'frontend',
        'https://example.com/skills/vue-best-practices',
        true
      )
      ON CONFLICT ("name", "version") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "mcps" (
        "name",
        "version",
        "description",
        "provider",
        "tools_count",
        "enabled"
      ) VALUES
      (
        'filesystem',
        '1.0.0',
        'Read and write files in sandboxed workspace.',
        'builtin',
        12,
        true
      ),
      (
        'github',
        '1.0.0',
        'Integrate with GitHub API for PR and issue operations.',
        'builtin',
        8,
        true
      ),
      (
        'jira',
        '1.0.0',
        'Read and update Jira issues with project-scoped credentials.',
        'builtin',
        6,
        true
      )
      ON CONFLICT ("name", "version") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_mcps_enabled"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_mcps_name"`);
    await queryRunner.query(`DROP TABLE "mcps"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_skills_enabled"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_skills_name"`);
    await queryRunner.query(`DROP TABLE "skills"`);
  }
}
