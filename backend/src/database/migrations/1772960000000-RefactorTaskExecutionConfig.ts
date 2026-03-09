import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorTaskExecutionConfig1772960000000
  implements MigrationInterface
{
  name = 'RefactorTaskExecutionConfig1772960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "configJson" jsonb`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "tasks"."configJson" IS '任务执行配置JSON'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD COLUMN IF NOT EXISTS "configJson" jsonb`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."configJson" IS '节点执行配置JSON'`,
    );

    await queryRunner.query(
      `UPDATE "tasks"
       SET "configJson" = NULLIF(
         jsonb_strip_nulls(
           jsonb_build_object(
             'workflowTemplateId', "workflowTemplateId",
             'cliToolId', "cliToolId",
             'agentToolConfigId', "agentToolConfigId"
           )
         ),
         '{}'::jsonb
       )
       WHERE "configJson" IS NULL`,
    );

    await queryRunner.query(
      `UPDATE "task_nodes" AS node
       SET "configJson" = NULLIF(
         jsonb_strip_nulls(
           jsonb_build_object(
             'cliToolId', task."cliToolId",
             'agentToolConfigId', task."agentToolConfigId"
           )
         ),
         '{}'::jsonb
       )
       FROM "tasks" AS task
       WHERE task."id" = node."taskId"
         AND node."configJson" IS NULL`,
    );

    await queryRunner.query(
      `UPDATE "task_nodes"
       SET "status" = 'in_review',
           "finishedAt" = COALESCE("finishedAt", NOW()),
           "errorCode" = COALESCE("errorCode", 'MANUAL_NODE_REMOVED'),
           "errorMessage" = COALESCE(
             "errorMessage",
             'Manual nodes were removed during task execution config migration'
           ),
           "output" = COALESCE("output", '{}'::jsonb) || jsonb_build_object(
             'summary', 'Manual node requires operator intervention after migration',
             'migration', '1772960000000'
           )
       WHERE "nodeType" = 'manual'
         AND "status" <> 'done'`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tasks_workflow_template_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN IF EXISTS "workflowTemplateId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN IF EXISTS "cliToolId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN IF EXISTS "agentToolConfigId"`,
    );

    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN IF EXISTS "requiresApproval"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN IF EXISTS "nodeType"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."task_node_type_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."task_node_type_enum" AS ENUM('agent', 'manual')`,
    );

    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "workflowTemplateId" uuid`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "tasks"."workflowTemplateId" IS '关联工作流模板ID'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "cliToolId" character varying(64)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "tasks"."cliToolId" IS 'CLI工具标识'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "agentToolConfigId" uuid`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "tasks"."agentToolConfigId" IS '关联工具配置ID'`,
    );

    await queryRunner.query(
      `UPDATE "tasks"
       SET "workflowTemplateId" = CASE
             WHEN jsonb_typeof("configJson" -> 'workflowTemplateId') = 'string'
               THEN ("configJson" ->> 'workflowTemplateId')::uuid
             ELSE NULL
           END,
           "cliToolId" = CASE
             WHEN jsonb_typeof("configJson" -> 'cliToolId') = 'string'
               THEN "configJson" ->> 'cliToolId'
             ELSE NULL
           END,
           "agentToolConfigId" = CASE
             WHEN jsonb_typeof("configJson" -> 'agentToolConfigId') = 'string'
               THEN ("configJson" ->> 'agentToolConfigId')::uuid
             ELSE NULL
           END`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_workflow_template_id" ON "tasks" ("workflowTemplateId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD COLUMN IF NOT EXISTS "nodeType" "public"."task_node_type_enum" NOT NULL DEFAULT 'agent'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."nodeType" IS '节点类型'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD COLUMN IF NOT EXISTS "requiresApproval" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."requiresApproval" IS '节点是否需要人工审批'`,
    );

    await queryRunner.query(
      `UPDATE "task_nodes"
       SET "nodeType" = 'agent',
           "requiresApproval" = false`,
    );

    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN IF EXISTS "configJson"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN IF EXISTS "configJson"`,
    );
  }
}
