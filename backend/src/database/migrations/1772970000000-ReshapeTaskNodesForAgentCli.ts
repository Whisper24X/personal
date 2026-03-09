import { promises as fs } from 'fs';
import path from 'path';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { resolveAinativeDataRootDir } from '../../utils/workspace-paths';

type LegacyTaskNodeRow = {
  id: string;
  taskId: string;
  projectId: string;
  businessLineId: string;
  output: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  finishedAt: Date | string | null;
};

type OutputRefRow = {
  id: string;
  outputRef: string | null;
};

export class ReshapeTaskNodesForAgentCli1772970000000
  implements MigrationInterface
{
  name = 'ReshapeTaskNodesForAgentCli1772970000000';

  private readonly dataRootDir = path.resolve(resolveAinativeDataRootDir());

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD COLUMN IF NOT EXISTS "cliToolId" character varying(64)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."cliToolId" IS 'CLI工具ID'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD COLUMN IF NOT EXISTS "agentToolConfigId" uuid`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."agentToolConfigId" IS 'Agent工具配置ID'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD COLUMN IF NOT EXISTS "outputRef" text`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."outputRef" IS 'Agent CLI输出JSONL文件地址'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD COLUMN IF NOT EXISTS "runtimeJson" jsonb`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."runtimeJson" IS '节点运行中临时态JSON'`,
    );

    await queryRunner.query(
      `UPDATE "task_nodes" AS node
       SET "agentToolConfigId" = COALESCE(
             CASE
               WHEN jsonb_typeof(node."configJson" -> 'agentToolConfigId') = 'string'
                 THEN (node."configJson" ->> 'agentToolConfigId')::uuid
               ELSE NULL
             END,
             CASE
               WHEN jsonb_typeof(node."input" -> 'agentToolConfigId') = 'string'
                 THEN (node."input" ->> 'agentToolConfigId')::uuid
               ELSE NULL
             END,
             CASE
               WHEN jsonb_typeof(task."configJson" -> 'agentToolConfigId') = 'string'
                 THEN (task."configJson" ->> 'agentToolConfigId')::uuid
               ELSE NULL
             END
           ),
           "cliToolId" = COALESCE(
             NULLIF(BTRIM(node."configJson" ->> 'cliToolId'), ''),
             NULLIF(BTRIM(node."input" ->> 'cliToolId'), ''),
             NULLIF(BTRIM(task."configJson" ->> 'cliToolId'), '')
           )
       FROM "tasks" AS task
       WHERE task."id" = node."taskId"`,
    );

    await queryRunner.query(
      `UPDATE "task_nodes" AS node
       SET "cliToolId" = config."toolId"
       FROM "agent_tool_configs" AS config
       WHERE node."agentToolConfigId" = config."id"
         AND node."cliToolId" IS NULL`,
    );

    await queryRunner.query(
      `UPDATE "task_nodes" AS node
       SET "cliToolId" = COALESCE(
             NULLIF(BTRIM(project."configJson" ->> 'cliToolId'), ''),
             NULLIF(BTRIM(project."configJson" ->> 'agentAdapter'), ''),
             'codex'
           )
       FROM "tasks" AS task
       INNER JOIN "projects" AS project
         ON project."id" = task."projectId"
       WHERE task."id" = node."taskId"
         AND node."cliToolId" IS NULL`,
    );

    await queryRunner.query(
      `UPDATE "task_nodes" AS node
       SET "agentToolConfigId" = resolved."id"
       FROM (
         SELECT node_inner."id" AS "nodeId",
                (
                  SELECT config."id"
                  FROM "agent_tool_configs" AS config
                  WHERE config."businessLineId" = task."businessLineId"
                    AND config."isDefault" = true
                    AND (
                      config."toolId" = node_inner."cliToolId"
                      OR (node_inner."cliToolId" = 'codex' AND config."toolId" = 'codex-cli')
                      OR (node_inner."cliToolId" = 'codex-cli' AND config."toolId" = 'codex')
                      OR (node_inner."cliToolId" = 'cursor' AND config."toolId" = 'cursor-agent')
                      OR (node_inner."cliToolId" = 'cursor-agent' AND config."toolId" = 'cursor')
                      OR (node_inner."cliToolId" = 'claude' AND config."toolId" = 'claude-code')
                      OR (node_inner."cliToolId" = 'claude-code' AND config."toolId" = 'claude')
                      OR (node_inner."cliToolId" = 'gemini' AND config."toolId" = 'gemini-cli')
                      OR (node_inner."cliToolId" = 'gemini-cli' AND config."toolId" = 'gemini')
                    )
                  ORDER BY CASE WHEN config."toolId" = node_inner."cliToolId" THEN 0 ELSE 1 END,
                           config."createdAt" ASC
                  LIMIT 1
                ) AS "id"
         FROM "task_nodes" AS node_inner
         INNER JOIN "tasks" AS task
           ON task."id" = node_inner."taskId"
         WHERE node_inner."agentToolConfigId" IS NULL
           AND node_inner."cliToolId" IS NOT NULL
       ) AS resolved
       WHERE node."id" = resolved."nodeId"
         AND resolved."id" IS NOT NULL`,
    );

    await this.backfillFromLegacyProjectAgentToolConfigs(queryRunner);

    await queryRunner.query(
      `UPDATE "task_nodes" AS node
       SET "input" = jsonb_strip_nulls(
         ((COALESCE(node."input", '{}'::jsonb) - 'prompt' - 'instructions' - 'cliToolId' - 'agentToolConfigId')) ||
         jsonb_build_object(
           'taskInput', NULLIF(BTRIM(task."prompt"), ''),
           'nodeInput', COALESCE(
             NULLIF(BTRIM(node."input" ->> 'nodeInput'), ''),
             NULLIF(BTRIM(node."input" ->> 'prompt'), ''),
             NULLIF(BTRIM(node."input" ->> 'instructions'), '')
           )
         )
       )
       FROM "tasks" AS task
       WHERE task."id" = node."taskId"`,
    );

    await queryRunner.query(
      `UPDATE "task_nodes"
       SET "runtimeJson" = NULLIF(
         jsonb_strip_nulls(
           jsonb_build_object(
             'workerId', NULLIF(BTRIM("workerId"), ''),
             'leaseUntil', CASE
               WHEN "leaseUntil" IS NOT NULL
                 THEN to_char("leaseUntil", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
               ELSE NULL
             END,
             'heartbeatAt', CASE
               WHEN "heartbeatAt" IS NOT NULL
                 THEN to_char("heartbeatAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
               ELSE NULL
             END
           )
         ),
         '{}'::jsonb
       )
       WHERE "workerId" IS NOT NULL
          OR "leaseUntil" IS NOT NULL
          OR "heartbeatAt" IS NOT NULL`,
    );

    const legacyRows = (await queryRunner.query(
      `SELECT node."id",
              node."taskId",
              task."projectId",
              task."businessLineId",
              node."output",
              node."errorCode",
              node."errorMessage",
              node."finishedAt"
         FROM "task_nodes" AS node
         INNER JOIN "tasks" AS task
           ON task."id" = node."taskId"
        WHERE node."output" IS NOT NULL
           OR node."errorCode" IS NOT NULL
           OR node."errorMessage" IS NOT NULL`,
    )) as LegacyTaskNodeRow[];

    for (const row of legacyRows) {
      const outputRecord = this.buildLegacyOutputRecord(row);
      if (!outputRecord) {
        continue;
      }

      const outputPath = this.resolveNodeOutputPath({
        businessLineId: row.businessLineId,
        projectId: row.projectId,
        taskId: row.taskId,
        nodeId: row.id,
      });

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, `${JSON.stringify(outputRecord)}\n`, 'utf-8');

      await queryRunner.query(
        `UPDATE "task_nodes" SET "outputRef" = $1 WHERE "id" = $2`,
        [outputPath, row.id],
      );
    }

    const unresolvedRows = (await queryRunner.query(
      `SELECT "id"
         FROM "task_nodes"
        WHERE "cliToolId" IS NULL
           OR "agentToolConfigId" IS NULL
        LIMIT 5`,
    )) as Array<{ id: string }>;

    if (unresolvedRows.length > 0) {
      throw new Error(
        `task_nodes migration requires cliToolId and agentToolConfigId for all rows; unresolved node ids: ${unresolvedRows
          .map((row) => row.id)
          .join(', ')}`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "task_nodes" ALTER COLUMN "cliToolId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ALTER COLUMN "agentToolConfigId" SET NOT NULL`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_task_nodes_status_lease_until"`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_nodes_status_runtime_lease_until"
         ON "task_nodes" ("status", (("runtimeJson" ->> 'leaseUntil')))`,
    );

    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN IF EXISTS "configJson"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN IF EXISTS "output"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN IF EXISTS "errorCode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN IF EXISTS "errorMessage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN IF EXISTS "workerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN IF EXISTS "leaseUntil"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN IF EXISTS "heartbeatAt"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD COLUMN IF NOT EXISTS "configJson" jsonb`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."configJson" IS '节点执行配置JSON'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD COLUMN IF NOT EXISTS "output" jsonb`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."output" IS '节点输出JSON'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD COLUMN IF NOT EXISTS "errorCode" character varying(120)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."errorCode" IS '错误码'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD COLUMN IF NOT EXISTS "errorMessage" text`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."errorMessage" IS '错误详情'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD COLUMN IF NOT EXISTS "workerId" character varying(120)`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."workerId" IS '持有租约的工作进程ID'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD COLUMN IF NOT EXISTS "leaseUntil" timestamp`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."leaseUntil" IS '租约过期时间'`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" ADD COLUMN IF NOT EXISTS "heartbeatAt" timestamp`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "task_nodes"."heartbeatAt" IS '最近工作进程心跳时间'`,
    );

    await queryRunner.query(
      `UPDATE "task_nodes"
          SET "configJson" = NULLIF(
            jsonb_strip_nulls(
              jsonb_build_object(
                'cliToolId', "cliToolId",
                'agentToolConfigId', "agentToolConfigId"
              )
            ),
            '{}'::jsonb
          )`,
    );

    await queryRunner.query(
      `UPDATE "task_nodes"
          SET "workerId" = NULLIF(BTRIM("runtimeJson" ->> 'workerId'), ''),
              "leaseUntil" = CASE
                WHEN NULLIF(BTRIM("runtimeJson" ->> 'leaseUntil'), '') IS NOT NULL
                  THEN ("runtimeJson" ->> 'leaseUntil')::timestamptz::timestamp
                ELSE NULL
              END,
              "heartbeatAt" = CASE
                WHEN NULLIF(BTRIM("runtimeJson" ->> 'heartbeatAt'), '') IS NOT NULL
                  THEN ("runtimeJson" ->> 'heartbeatAt')::timestamptz::timestamp
                ELSE NULL
              END
        WHERE "runtimeJson" IS NOT NULL`,
    );

    const outputRows = (await queryRunner.query(
      `SELECT "id", "outputRef" FROM "task_nodes" WHERE "outputRef" IS NOT NULL`,
    )) as OutputRefRow[];

    for (const row of outputRows) {
      const parsed = await this.readOutputRecord(row.outputRef);
      if (!parsed) {
        continue;
      }

      const outputPayload = { ...parsed };
      let errorCode: string | null = null;
      let errorMessage: string | null = null;

      if (
        parsed.error &&
        typeof parsed.error === 'object' &&
        !Array.isArray(parsed.error)
      ) {
        const error = parsed.error as Record<string, unknown>;
        errorCode = typeof error.code === 'string' ? error.code : null;
        errorMessage = typeof error.message === 'string' ? error.message : null;
        delete outputPayload.error;
      }

      await queryRunner.query(
        `UPDATE "task_nodes"
            SET "output" = $1::jsonb,
                "errorCode" = $2,
                "errorMessage" = $3
          WHERE "id" = $4`,
        [JSON.stringify(outputPayload), errorCode, errorMessage, row.id],
      );
    }

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_task_nodes_status_runtime_lease_until"`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_nodes_status_lease_until" ON "task_nodes" ("status", "leaseUntil")`,
    );

    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN IF EXISTS "runtimeJson"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN IF EXISTS "outputRef"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN IF EXISTS "agentToolConfigId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_nodes" DROP COLUMN IF EXISTS "cliToolId"`,
    );
  }

  private async backfillFromLegacyProjectAgentToolConfigs(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const unresolvedRows = (await queryRunner.query(
      `SELECT node."id",
              node."taskId",
              node."cliToolId",
              task."projectId",
              task."businessLineId",
              project."configJson" AS "projectConfigJson"
         FROM "task_nodes" AS node
         INNER JOIN "tasks" AS task
           ON task."id" = node."taskId"
         INNER JOIN "projects" AS project
           ON project."id" = task."projectId"
        WHERE node."agentToolConfigId" IS NULL`,
    )) as Array<{
      id: string;
      taskId: string;
      cliToolId: string | null;
      projectId: string;
      businessLineId: string;
      projectConfigJson: Record<string, unknown> | null;
    }>;

    for (const row of unresolvedRows) {
      const projectConfig = this.toObjectRecord(row.projectConfigJson);
      const toolId = this.normalizeToolId(
        row.cliToolId ??
          this.readString(projectConfig, 'cliToolId') ??
          this.readString(projectConfig, 'agentAdapter') ??
          'codex',
      );
      const legacyEntry = this.pickLegacyAgentToolConfig({
        projectConfig,
        businessLineId: row.businessLineId,
        toolId,
      });

      if (!legacyEntry) {
        continue;
      }

      const persisted = await this.findOrCreateMigratedAgentToolConfig({
        queryRunner,
        businessLineId: row.businessLineId,
        projectId: row.projectId,
        taskId: row.taskId,
        toolId,
        entry: legacyEntry,
      });

      if (!persisted?.id) {
        continue;
      }

      await queryRunner.query(
        `UPDATE "task_nodes"
            SET "cliToolId" = COALESCE("cliToolId", $1),
                "agentToolConfigId" = $2
          WHERE "id" = $3`,
        [persisted.toolId, persisted.id, row.id],
      );
    }
  }

  private async findOrCreateMigratedAgentToolConfig({
    queryRunner,
    businessLineId,
    projectId,
    taskId,
    toolId,
    entry,
  }: {
    queryRunner: QueryRunner;
    businessLineId: string;
    projectId: string;
    taskId: string;
    toolId: string;
    entry: {
      id?: string;
      name?: string;
      config: Record<string, unknown>;
    };
  }): Promise<{ id: string; toolId: string } | null> {
    if (entry.id && this.looksLikeUuid(entry.id)) {
      const byId = (await queryRunner.query(
        `SELECT "id", "toolId"
           FROM "agent_tool_configs"
          WHERE "id" = $1
            AND "businessLineId" = $2
          LIMIT 1`,
        [entry.id, businessLineId],
      )) as Array<{ id: string; toolId: string }>;

      if (byId[0]) {
        return byId[0];
      }
    }

    const configJson = JSON.stringify(entry.config ?? {});
    const generatedName = this.buildMigratedConfigName({
      preferredName: entry.name,
      toolId,
      projectId,
      taskId,
    });

    const existing = (await queryRunner.query(
      `SELECT "id", "toolId"
         FROM "agent_tool_configs"
        WHERE "businessLineId" = $1
          AND "toolId" = $2
          AND "name" = $3
        LIMIT 1`,
      [businessLineId, toolId, generatedName],
    )) as Array<{ id: string; toolId: string }>;

    if (existing[0]) {
      return existing[0];
    }

    const inserted = (await queryRunner.query(
      `INSERT INTO "agent_tool_configs" (
         "businessLineId",
         "toolId",
         "name",
         "description",
         "configJson",
         "isDefault"
       )
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING "id", "toolId"`,
      [
        businessLineId,
        toolId,
        generatedName,
        'Migrated from project.configJson.agentToolConfigs',
        configJson,
      ],
    )) as Array<{ id: string; toolId: string }>;

    return inserted[0] ?? null;
  }

  private pickLegacyAgentToolConfig({
    projectConfig,
    businessLineId,
    toolId,
  }: {
    projectConfig: Record<string, unknown>;
    businessLineId: string;
    toolId: string;
  }): { id?: string; name?: string; config: Record<string, unknown> } | null {
    const rawList = projectConfig.agentToolConfigs;
    if (!Array.isArray(rawList)) {
      return null;
    }

    const normalizedToolIds = new Set(this.resolveToolIdCandidates(toolId));
    const entries = rawList
      .map((item) => this.normalizeLegacyAgentToolConfigEntry(item))
      .filter(
        (
          item,
        ): item is {
          id?: string;
          name?: string;
          toolId: string;
          businessLineId?: string;
          isDefault: boolean;
          config: Record<string, unknown>;
        } => item !== null && normalizedToolIds.has(item.toolId),
      );

    if (!entries.length) {
      return null;
    }

    const exactMatches = entries.filter(
      (item) => item.businessLineId && item.businessLineId === businessLineId,
    );
    const globalMatches = entries.filter((item) => !item.businessLineId);
    const selected =
      exactMatches.find((item) => item.isDefault) ??
      exactMatches[0] ??
      globalMatches.find((item) => item.isDefault) ??
      globalMatches[0] ??
      null;

    return selected
      ? {
          id: selected.id,
          name: selected.name,
          config: selected.config,
        }
      : null;
  }

  private normalizeLegacyAgentToolConfigEntry(
    raw: unknown,
  ):
    | {
        id?: string;
        name?: string;
        toolId: string;
        businessLineId?: string;
        isDefault: boolean;
        config: Record<string, unknown>;
      }
    | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }

    const source = raw as Record<string, unknown>;
    const toolId = this.normalizeToolId(
      this.readString(source, 'toolId') ??
        this.readString(source, 'tool_id') ??
        this.readString(source, 'adapter') ??
        '',
    );
    if (!toolId) {
      return null;
    }

    const config = this.readLegacyConfigObject(source);
    if (!config) {
      return null;
    }

    return {
      id: this.readString(source, 'id') ?? undefined,
      name: this.readString(source, 'name') ?? undefined,
      toolId,
      businessLineId:
        this.readString(source, 'businessLineId') ??
        this.readString(source, 'business_line_id') ??
        undefined,
      isDefault: source.isDefault === true || source.is_default === 1,
      config,
    };
  }

  private readLegacyConfigObject(
    source: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const rawConfig =
      source.config ?? source.configJson ?? source.config_json ?? null;

    if (!rawConfig) {
      return {};
    }

    if (typeof rawConfig === 'object' && !Array.isArray(rawConfig)) {
      return rawConfig as Record<string, unknown>;
    }

    if (typeof rawConfig === 'string' && rawConfig.trim()) {
      try {
        const parsed = JSON.parse(rawConfig);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  private buildMigratedConfigName({
    preferredName,
    toolId,
    projectId,
    taskId,
  }: {
    preferredName?: string;
    toolId: string;
    projectId: string;
    taskId: string;
  }): string {
    const trimmedPreferred = preferredName?.trim();
    if (trimmedPreferred) {
      return `${trimmedPreferred} [migrated ${projectId.slice(0, 8)}]`;
    }

    return `Migrated ${toolId} ${projectId.slice(0, 8)} ${taskId.slice(0, 8)}`;
  }

  private resolveToolIdCandidates(toolId: string): string[] {
    const normalized = this.normalizeToolId(toolId);
    if (normalized === 'codex') {
      return ['codex', 'codex-cli'];
    }
    if (normalized === 'codex-cli') {
      return ['codex-cli', 'codex'];
    }
    if (normalized === 'cursor') {
      return ['cursor', 'cursor-agent'];
    }
    if (normalized === 'cursor-agent') {
      return ['cursor-agent', 'cursor'];
    }
    if (normalized === 'claude') {
      return ['claude', 'claude-code'];
    }
    if (normalized === 'claude-code') {
      return ['claude-code', 'claude'];
    }
    if (normalized === 'gemini') {
      return ['gemini', 'gemini-cli'];
    }
    if (normalized === 'gemini-cli') {
      return ['gemini-cli', 'gemini'];
    }

    return normalized ? [normalized] : [];
  }

  private normalizeToolId(value: string): string {
    return value.trim().toLowerCase();
  }

  private readString(
    source: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = source[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private toObjectRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private looksLikeUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private buildLegacyOutputRecord(
    row: LegacyTaskNodeRow,
  ): Record<string, unknown> | null {
    const base =
      row.output && typeof row.output === 'object' && !Array.isArray(row.output)
        ? { ...row.output }
        : {};

    const error = this.buildErrorObject(row.errorCode, row.errorMessage);
    if (error) {
      base.error = error;
    }

    if (!base.summary) {
      if (typeof row.errorMessage === 'string' && row.errorMessage.trim()) {
        base.summary = row.errorMessage.trim();
      } else if (typeof base.stdout === 'string' && base.stdout.trim()) {
        base.summary = String(base.stdout).trim().slice(0, 2000);
      }
    }

    if (!base.finishedAt && row.finishedAt) {
      const finishedAt =
        row.finishedAt instanceof Date
          ? row.finishedAt.toISOString()
          : new Date(row.finishedAt).toISOString();
      base.finishedAt = finishedAt;
    }

    return Object.keys(base).length ? base : null;
  }

  private buildErrorObject(
    errorCode: string | null,
    errorMessage: string | null,
  ): Record<string, unknown> | null {
    const code = errorCode?.trim() || null;
    const message = errorMessage?.trim() || null;

    if (!code && !message) {
      return null;
    }

    return {
      ...(code ? { code } : {}),
      ...(message ? { message } : {}),
    };
  }

  private resolveNodeOutputPath({
    businessLineId,
    projectId,
    taskId,
    nodeId,
  }: {
    businessLineId: string;
    projectId: string;
    taskId: string;
    nodeId: string;
  }): string {
    return path.resolve(
      this.dataRootDir,
      businessLineId?.trim() || 'unknown-business-line',
      'projects',
      projectId?.trim() || 'unknown-project',
      'tasks',
      taskId,
      'nodes',
      nodeId,
      'output.jsonl',
    );
  }

  private async readOutputRecord(
    outputRef: string | null,
  ): Promise<Record<string, unknown> | null> {
    if (!outputRef?.trim()) {
      return null;
    }

    try {
      const content = await fs.readFile(outputRef.trim(), 'utf-8');
      const records = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      for (let index = records.length - 1; index >= 0; index -= 1) {
        try {
          const parsed = JSON.parse(records[index]);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
        } catch {
          continue;
        }
      }
    } catch {
      return null;
    }

    return null;
  }
}
