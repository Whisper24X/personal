import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameAgentCliFieldsAndDropTaskTables1772971000000
  implements MigrationInterface
{
  name = 'RenameAgentCliFieldsAndDropTaskTables1772971000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('agent_tool_configs')) {
      await queryRunner.query(
        `ALTER TABLE "agent_tool_configs" RENAME TO "agent_cli_configs"`,
      );
    }

    await queryRunner.query(
      `ALTER INDEX IF EXISTS "IDX_agent_tool_config_business_line_id" RENAME TO "IDX_agent_cli_config_business_line_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX IF EXISTS "IDX_agent_tool_config_tool_id" RENAME TO "IDX_agent_cli_config_tool_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX IF EXISTS "UQ_agent_tool_config_business_line_tool_name" RENAME TO "UQ_agent_cli_config_business_line_tool_name"`,
    );
    await queryRunner.query(
      `ALTER INDEX IF EXISTS "UQ_agent_tool_config_default_per_tool" RENAME TO "UQ_agent_cli_config_default_per_tool"`,
    );

    if (await queryRunner.hasTable('task_nodes')) {
      if (await queryRunner.hasColumn('task_nodes', 'cliToolId')) {
        await queryRunner.query(
          `ALTER TABLE "task_nodes" RENAME COLUMN "cliToolId" TO "agentCliId"`,
        );
      }

      if (await queryRunner.hasColumn('task_nodes', 'agentToolConfigId')) {
        await queryRunner.query(
          `ALTER TABLE "task_nodes" RENAME COLUMN "agentToolConfigId" TO "agentCliConfigId"`,
        );
      }

      if (await queryRunner.hasColumn('task_nodes', 'outputRef')) {
        await queryRunner.query(
          `ALTER TABLE "task_nodes" RENAME COLUMN "outputRef" TO "agentClioutput"`,
        );
      }

      await queryRunner.query(
        `COMMENT ON COLUMN "task_nodes"."agentCliId" IS 'Agent CLI ID'`,
      );
      await queryRunner.query(
        `COMMENT ON COLUMN "task_nodes"."agentCliConfigId" IS 'Agent CLI配置ID'`,
      );
      await queryRunner.query(
        `COMMENT ON COLUMN "task_nodes"."agentClioutput" IS 'Agent CLI日志JSONL文件地址'`,
      );
      await queryRunner.query(`
        UPDATE "task_nodes"
        SET "input" = NULLIF(
          jsonb_strip_nulls(
            (COALESCE("input", '{}'::jsonb) - 'cliToolId' - 'agentToolConfigId' - 'agentCliId' - 'agentCliConfigId')
          ),
          '{}'::jsonb
        )
        WHERE "input" IS NOT NULL
          AND (
            "input" ? 'cliToolId'
            OR "input" ? 'agentToolConfigId'
            OR "input" ? 'agentCliId'
            OR "input" ? 'agentCliConfigId'
          )
      `);
    }

    if (await queryRunner.hasColumn('tasks', 'configJson')) {
      await queryRunner.query(`
        UPDATE "tasks"
        SET "configJson" = jsonb_strip_nulls(
          ((COALESCE("configJson", '{}'::jsonb) - 'cliToolId' - 'agentToolConfigId')) ||
          jsonb_build_object(
            'agentCliId', COALESCE("configJson" -> 'agentCliId', "configJson" -> 'cliToolId'),
            'agentCliConfigId', COALESCE("configJson" -> 'agentCliConfigId', "configJson" -> 'agentToolConfigId')
          )
        )
        WHERE "configJson" IS NOT NULL
          AND (
            "configJson" ? 'cliToolId'
            OR "configJson" ? 'agentToolConfigId'
          )
      `);
    }

    if (await queryRunner.hasTable('task_artifacts')) {
      await queryRunner.query(`COMMENT ON TABLE "task_artifacts" IS NULL`);
      await queryRunner.query(
        `DROP INDEX IF EXISTS "public"."IDX_task_artifacts_task_node_id"`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS "public"."IDX_task_artifacts_task_id"`,
      );
      await queryRunner.query(`DROP TABLE "task_artifacts"`);
    }
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."task_artifact_type_enum"`,
    );

    if (await queryRunner.hasTable('task_logs')) {
      await queryRunner.query(`COMMENT ON TABLE "task_logs" IS NULL`);
      await queryRunner.query(
        `DROP INDEX IF EXISTS "public"."IDX_task_logs_task_node_id"`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS "public"."IDX_task_logs_task_id"`,
      );
      await queryRunner.query(`DROP TABLE "task_logs"`);
    }
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."task_log_level_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'task_log_level_enum'
        ) THEN
          CREATE TYPE "public"."task_log_level_enum" AS ENUM('info', 'warn', 'error', 'debug');
        END IF;
      END
      $$;
    `);
    if (!(await queryRunner.hasTable('task_logs'))) {
      await queryRunner.query(
        `CREATE TABLE "task_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskId" uuid NOT NULL, "taskNodeId" uuid, "level" "public"."task_log_level_enum" NOT NULL DEFAULT 'info', "message" text NOT NULL, "payload" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9754457a29b4ffbb772e8a3039c" PRIMARY KEY ("id"))`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_task_logs_task_id" ON "task_logs" ("taskId")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_task_logs_task_node_id" ON "task_logs" ("taskNodeId")`,
      );
      await queryRunner.query(`COMMENT ON TABLE "task_logs" IS '任务执行日志'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_logs"."id" IS '主键（UUID）'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_logs"."taskId" IS '关联任务ID'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_logs"."taskNodeId" IS '关联任务节点ID'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_logs"."level" IS '日志级别'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_logs"."message" IS '日志消息内容'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_logs"."payload" IS '结构化日志载荷JSON'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_logs"."createdAt" IS '创建时间'`);
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'task_artifact_type_enum'
        ) THEN
          CREATE TYPE "public"."task_artifact_type_enum" AS ENUM('diff', 'report', 'file', 'preview');
        END IF;
      END
      $$;
    `);
    if (!(await queryRunner.hasTable('task_artifacts'))) {
      await queryRunner.query(
        `CREATE TABLE "task_artifacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskId" uuid NOT NULL, "taskNodeId" uuid, "artifactType" "public"."task_artifact_type_enum" NOT NULL, "name" character varying(200) NOT NULL, "downloadUrl" text, "content" text, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c2ec4d80514c8ccdcf6adf8679e" PRIMARY KEY ("id"))`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_task_artifacts_task_id" ON "task_artifacts" ("taskId")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_task_artifacts_task_node_id" ON "task_artifacts" ("taskNodeId")`,
      );
      await queryRunner.query(`COMMENT ON TABLE "task_artifacts" IS '任务执行产生的工件'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_artifacts"."id" IS '主键（UUID）'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_artifacts"."taskId" IS '关联任务ID'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_artifacts"."taskNodeId" IS '关联任务节点ID'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_artifacts"."artifactType" IS '工件类型'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_artifacts"."name" IS '工件名称'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_artifacts"."downloadUrl" IS '工件下载地址'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_artifacts"."content" IS '内联工件内容'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_artifacts"."metadata" IS '工件元数据JSON'`);
      await queryRunner.query(`COMMENT ON COLUMN "task_artifacts"."createdAt" IS '创建时间'`);
    }

    if (await queryRunner.hasColumn('tasks', 'configJson')) {
      await queryRunner.query(`
        UPDATE "tasks"
        SET "configJson" = jsonb_strip_nulls(
          ((COALESCE("configJson", '{}'::jsonb) - 'agentCliId' - 'agentCliConfigId')) ||
          jsonb_build_object(
            'cliToolId', COALESCE("configJson" -> 'cliToolId', "configJson" -> 'agentCliId'),
            'agentToolConfigId', COALESCE("configJson" -> 'agentToolConfigId', "configJson" -> 'agentCliConfigId')
          )
        )
        WHERE "configJson" IS NOT NULL
          AND (
            "configJson" ? 'agentCliId'
            OR "configJson" ? 'agentCliConfigId'
          )
      `);
    }

    if (await queryRunner.hasTable('task_nodes')) {
      if (await queryRunner.hasColumn('task_nodes', 'agentClioutput')) {
        await queryRunner.query(
          `ALTER TABLE "task_nodes" RENAME COLUMN "agentClioutput" TO "outputRef"`,
        );
      }

      if (await queryRunner.hasColumn('task_nodes', 'agentCliConfigId')) {
        await queryRunner.query(
          `ALTER TABLE "task_nodes" RENAME COLUMN "agentCliConfigId" TO "agentToolConfigId"`,
        );
      }

      if (await queryRunner.hasColumn('task_nodes', 'agentCliId')) {
        await queryRunner.query(
          `ALTER TABLE "task_nodes" RENAME COLUMN "agentCliId" TO "cliToolId"`,
        );
      }

      await queryRunner.query(
        `COMMENT ON COLUMN "task_nodes"."cliToolId" IS 'CLI工具ID'`,
      );
      await queryRunner.query(
        `COMMENT ON COLUMN "task_nodes"."agentToolConfigId" IS 'Agent工具配置ID'`,
      );
      await queryRunner.query(
        `COMMENT ON COLUMN "task_nodes"."outputRef" IS 'Agent CLI输出JSONL文件地址'`,
      );
    }

    await queryRunner.query(
      `ALTER INDEX IF EXISTS "IDX_agent_cli_config_business_line_id" RENAME TO "IDX_agent_tool_config_business_line_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX IF EXISTS "IDX_agent_cli_config_tool_id" RENAME TO "IDX_agent_tool_config_tool_id"`,
    );
    await queryRunner.query(
      `ALTER INDEX IF EXISTS "UQ_agent_cli_config_business_line_tool_name" RENAME TO "UQ_agent_tool_config_business_line_tool_name"`,
    );
    await queryRunner.query(
      `ALTER INDEX IF EXISTS "UQ_agent_cli_config_default_per_tool" RENAME TO "UQ_agent_tool_config_default_per_tool"`,
    );

    if (await queryRunner.hasTable('agent_cli_configs')) {
      await queryRunner.query(
        `ALTER TABLE "agent_cli_configs" RENAME TO "agent_tool_configs"`,
      );
    }
  }
}
