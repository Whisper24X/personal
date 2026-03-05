import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorTasksSchemaHardCut1771003300000
  implements MigrationInterface
{
  name = 'RefactorTasksSchemaHardCut1771003300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" ADD "prompt" text`);
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "gitBranch" character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "gitWorktree" character varying(500)`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" ADD "businessLineId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "cliToolId" character varying(64)`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" ADD "agentToolConfigId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "clientInputSnapshot" jsonb`,
    );

    await queryRunner.query(`
      UPDATE "tasks" AS task
      SET
        "prompt" = task."description",
        "gitBranch" = CASE
          WHEN task."branch" IS NULL THEN NULL
          WHEN task."branch" LIKE 'wk-%' THEN task."branch"
          ELSE 'wk-' || task."branch"
        END,
        "gitWorktree" = task."gitWorktreePath",
        "businessLineId" = project."businessLineId",
        "cliToolId" = COALESCE(
          task."toolVersionsSnapshot" ->> 'cliToolId',
          task."toolVersionsSnapshot" #>> '{clientInput,cliToolId}'
        ),
        "agentToolConfigId" = CASE
          WHEN COALESCE(
            task."toolVersionsSnapshot" ->> 'agentToolConfigId',
            task."toolVersionsSnapshot" #>> '{clientInput,agentToolConfigId}'
          ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN COALESCE(
            task."toolVersionsSnapshot" ->> 'agentToolConfigId',
            task."toolVersionsSnapshot" #>> '{clientInput,agentToolConfigId}'
          )::uuid
          ELSE NULL
        END,
        "clientInputSnapshot" = CASE
          WHEN jsonb_typeof(task."toolVersionsSnapshot" -> 'clientInput') = 'object'
          THEN task."toolVersionsSnapshot" -> 'clientInput'
          ELSE NULL
        END
      FROM "projects" AS project
      WHERE task."projectId" = project."id"
    `);

    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "businessLineId" SET NOT NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_business_line_id" ON "tasks" ("businessLineId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_business_line" FOREIGN KEY ("businessLineId") REFERENCES "business_lines"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_agent_tool_config" FOREIGN KEY ("agentToolConfigId") REFERENCES "agent_tool_configs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_tasks_git_worktree_path"`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tasks_git_worktree" ON "tasks" ("gitWorktree") WHERE "gitWorktree" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "workflowTemplateVersion"`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "description"`);
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "acceptanceCriteria"`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "branch"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "environment"`);
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "toolVersionsSnapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "gitWorktreePath"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "sandboxCleanupAt"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "workflowTemplateVersion" integer`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" ADD "description" text`);
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "acceptanceCriteria" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "branch" character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "environment" character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "toolVersionsSnapshot" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "gitWorktreePath" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "sandboxCleanupAt" TIMESTAMP`,
    );

    await queryRunner.query(`
      UPDATE "tasks"
      SET
        "description" = "prompt",
        "branch" = "gitBranch",
        "gitWorktreePath" = "gitWorktree",
        "toolVersionsSnapshot" = jsonb_strip_nulls(
          jsonb_build_object(
            'cliToolId', "cliToolId",
            'agentToolConfigId', "agentToolConfigId",
            'clientInput', "clientInputSnapshot"
          )
        )
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tasks_git_worktree"`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tasks_git_worktree_path" ON "tasks" ("gitWorktreePath") WHERE "gitWorktreePath" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_agent_tool_config"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_business_line"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tasks_business_line_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "clientInputSnapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "agentToolConfigId"`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "cliToolId"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "businessLineId"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "gitWorktree"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "gitBranch"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "prompt"`);
  }
}
