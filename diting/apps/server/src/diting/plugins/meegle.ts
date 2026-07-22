import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import {
  HumanReply,
  HumanRepairIssueRef,
  HumanRepairIssueReply,
  HumanRepairIssueRequest,
  NeedsHumanPayload,
  OpenSpecReviewDecision,
  OpenSpecReviewIssueRef,
  OpenSpecReviewIssueReply,
  OpenSpecReviewIssueRequest,
  PluginHealth,
  TaskIntegrationPlugin,
  TitingTask
} from "@diting/plugin-api";
import { ServerConfig } from "../config";
import { HttpPluginContext, HttpRoutePlugin } from "../http-plugin";
import {
  applyDescriptionFallback,
  asNonEmptyString,
  buildMeegleNeedsHumanComment,
  buildMeegleResultComment,
  buildMeegleCliArgs,
  extractSpecAttachmentsFromRow,
  extractTaskDetailPayload,
  extractTaskListPayload,
  extractMoqlSearchFieldBag,
  extractWorkitemFieldsBag,
  isMeegleSpecFieldLabel,
  mapMeegleTask,
  mergeMeegleFieldBags,
  mergeMeegleFieldsIntoRow,
  mergeMeegleTaskRecords,
  parseJson,
  readJsonArray,
  readMeegleFieldAsString,
  readMeegleFieldBag,
  collectMeegleFieldStrings,
  buildCliNotFoundMessage,
  isCliBinaryMissing,
  runCommand,
  shouldFallbackToWorkitemCli
} from "./shared";
import { inspectSpecPackageAttachments, SpecPackageInspection } from "./spec-documents";

export type MeegleAuthStatus = {
  status: "authenticated" | "unauthenticated" | "unknown";
  authenticated: boolean;
  message: string;
  host?: string;
  profile?: string;
};

export type MeegleAuthStartResult = {
  status: "pending";
  authenticated: false;
  authorizationUrl: string;
  deviceCode: string;
  clientId: string;
  intervalSeconds: number;
  expiresInSeconds: number;
  userCode?: string;
  message: string;
};

export type MeegleAuthPollInput = {
  deviceCode?: string;
  clientId?: string;
  intervalSeconds?: number;
  expiresInSeconds?: number;
};

export type MeegleAuthPollResult = {
  status: "pending" | "authenticated" | "failed" | "expired";
  authenticated: boolean;
  message: string;
  host?: string;
  profile?: string;
};

export type ParsedOpenSpecReviewReply = {
  ready: boolean;
  decision: OpenSpecReviewDecision;
  body: string;
};

export function parseOpenSpecReviewReply(
  body: string,
  prefixes: { approved: string; changesRequested: string; dismissed: string } = {
    approved: "【评审通过】",
    changesRequested: "【需要修改】",
    dismissed: "【废弃】"
  }
): ParsedOpenSpecReviewReply {
  const gatePrefixes: Array<{ prefix: string; decision: OpenSpecReviewDecision }> = [
    { prefix: prefixes.approved, decision: "approved" },
    { prefix: prefixes.changesRequested, decision: "changes_requested" },
    { prefix: prefixes.dismissed, decision: "dismissed" }
  ];
  for (const item of gatePrefixes) {
    if (body.startsWith(item.prefix)) {
      return {
        ready: true,
        decision: item.decision,
        body: body.slice(item.prefix.length).trim()
      };
    }
  }
  return { ready: false, decision: "pending", body };
}

function parseTaggedHumanReply(body: string, prefix = "【回复】"): string | null {
  if (!body.startsWith(prefix)) {
    return null;
  }
  const replyBody = body.slice(prefix.length).trim();
  return replyBody.length > 0 ? replyBody : null;
}

/**
 * Meegle task source + result sink: file polling, CLI polling (legacy / MQL / latest-sprint), or webhook ingestion.
 * Implements {@link HttpRoutePlugin} for `/api/integrations/meegle/*` when wired on the Fastify server.
 */
export class MeegleTaskIntegrationPlugin implements TaskIntegrationPlugin, HttpRoutePlugin {
  private discoveredSpecFieldKeys: string[] | null = null;
  private readonly specPackageInspectionCache = new Map<string, Promise<SpecPackageInspection | null>>();
  readonly id = "meegle";
  readonly kind = "task-integration" as const;
  readonly priority = 100;
  readonly capabilities = ["meegle"];

  constructor(private readonly config: ServerConfig) {}

  /** Webhook mode checks secret; file mode validates path; CLI mode probes `meegle` auth/project. */
  async health(): Promise<PluginHealth> {
    if (this.config.plugins.meegle.mode === "webhook") {
      return {
        healthy: Boolean(this.config.plugins.meegle.webhookSecret),
        message: this.config.plugins.meegle.webhookSecret
          ? "Meegle webhook integration ready"
          : "Meegle webhook secret is not configured"
      };
    }
    if (!this.config.plugins.meegle.tasksFile) {
      return this.checkCliReadiness();
    }
    return { healthy: true, message: `Meegle file integration ready: ${this.config.plugins.meegle.tasksFile}` };
  }

  /**
   * Polling integration only: reads `tasksFile` JSON or shells out to {@link MeegleTaskIntegrationPlugin.pullCliTasks}.
   * Non-polling modes return `[]` (webhook pushes tasks instead).
   */
  async pullTasks(): Promise<TitingTask[]> {
    if (this.config.plugins.meegle.mode !== "polling") {
      return [];
    }
    if (this.config.plugins.meegle.tasksFile) {
      const payload = JSON.parse(await readFile(this.config.plugins.meegle.tasksFile, "utf8")) as { tasks?: unknown[] };
      const rows = Array.isArray(payload.tasks) ? payload.tasks : [];
      return Promise.all(rows.map((row, index) => this.mapMeegleTask(row, index)));
    }
    return this.pullCliTasks();
  }

  /**
   * Persists to `resultsFile` when configured; otherwise posts a Meegle comment via CLI when `externalId` exists.
   */
  async reportResult(task: TitingTask, summary: string): Promise<void> {
    if (this.config.plugins.meegle.resultsFile && task.externalId) {
      const previous = await readJsonArray(this.config.plugins.meegle.resultsFile);
      previous.push({
        taskId: task.id,
        externalId: task.externalId,
        status: task.status,
        summary,
        reportedAt: new Date().toISOString()
      });
      await writeFile(this.config.plugins.meegle.resultsFile, JSON.stringify(previous, null, 2));
      return;
    }
    if (!task.externalId) {
      return;
    }
    await this.addComment(task.externalId, buildMeegleResultComment(task, summary));
  }

  async reportNeedsHuman(task: TitingTask, payload: NeedsHumanPayload): Promise<void> {
    if (!task.externalId) {
      return;
    }
    await this.addComment(task.externalId, buildMeegleNeedsHumanComment(task, payload));
  }

  async pullHumanReplies(tasks: TitingTask[]): Promise<HumanReply[]> {
    const replies = await Promise.all(tasks.map(async (task) => this.listHumanReplies(task)));
    return replies.flat();
  }

  async openHumanRepairIssue(task: TitingTask, request: HumanRepairIssueRequest): Promise<HumanRepairIssueRef> {
    if (!task.externalId) {
      throw new Error(`Task ${task.id} has no Meegle external id`);
    }
    const existing = await this.listChildRepairIssues(task.externalId);
    const reusable = existing.find((item) => item.idempotencyKey === request.idempotencyKey);
    if (reusable) {
      return {
        externalId: reusable.externalId,
        title: reusable.title,
        url: reusable.url,
        idempotencyKey: request.idempotencyKey,
        reused: true
      };
    }

    const title = `【diting修复方案】${task.title} - ${request.failedChecks.join(", ") || request.failureSummary}`;
    const description = [
      `diting:parent=${task.externalId};failure=${request.failureHash};request=${request.requestId};idempotency=${request.idempotencyKey}`,
      "",
      "请在本子任务描述开头填写 `【开发中】`，并在其后补充修复方案。",
      "",
      `失败摘要：${request.failureSummary}`,
      `失败检查项：${request.failedChecks.join(", ") || "unknown"}`
    ].join("\n");
    const node = await this.resolveChildTaskDevelopmentNode(task.externalId);
    const result = await runCommand(
      this.meegleBin(),
      this.withMeegleGlobalArgs(this.buildSubtaskCreateArgs(task.externalId, node.nodeId, title, description)),
      process.cwd(),
      60_000
    );
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `Meegle child task create failed for ${task.externalId}`);
    }
    let child = extractChildRepairIssue(parseJson(result.stdout), request.idempotencyKey);
    if (!child) {
      child = await this.waitForCreatedChildRepairIssue(task.externalId, request.idempotencyKey, request.failureSummary);
    }
    if (!child) {
      throw new Error("Meegle child task create response is missing child task id");
    }
    return {
      externalId: child.externalId,
      title: child.title,
      url: child.url,
      idempotencyKey: request.idempotencyKey,
      reused: false
    };
  }

  async pullHumanRepairIssues(tasks: TitingTask[]): Promise<HumanRepairIssueReply[]> {
    const replies = await Promise.all(tasks.map(async (task) => this.readChildRepairIssueReply(task)));
    return replies.filter((reply): reply is HumanRepairIssueReply => reply !== null);
  }

  async openOpenSpecReviewIssue(task: TitingTask, request: OpenSpecReviewIssueRequest): Promise<OpenSpecReviewIssueRef> {
    if (!task.externalId) {
      throw new Error(`Task ${task.id} has no Meegle external id`);
    }
    const existing = readOpenSpecReviewMetadata(task.metadata);
    if (existing.externalId) {
      return {
        externalId: existing.externalId,
        title: `OpenSpec review ${request.changeId}`,
        url: null,
        idempotencyKey: request.idempotencyKey,
        reused: true
      };
    }
    const existingChildren = await this.listChildRepairIssues(task.externalId);
    const reusable = existingChildren.find((item) => item.idempotencyKey === request.idempotencyKey);
    if (reusable) {
      return {
        externalId: reusable.externalId,
        title: reusable.title,
        url: reusable.url,
        idempotencyKey: request.idempotencyKey,
        reused: true
      };
    }
    const title = `【OpenSpec评审】${request.changeId}`;
    const openspecPathLines = request.openspecPath
      ? [
          "",
          `OpenSpec 文档绝对路径：${request.openspecPath}`,
          "请审核该路径下的 proposal.md / design.md / specs / tasks.md。"
        ]
      : [];
    const description = [
      `diting:openspec-review=${request.idempotencyKey};change=${request.changeId};revision=${request.revision};request=${request.requestId};idempotency=${request.idempotencyKey}`,
      "",
      request.summary,
      ...openspecPathLines,
      "",
      "请在本子任务描述开头使用以下任一门禁前缀：",
      `${this.config.openspecReview.prefixes.approved}进入开发`,
      `${this.config.openspecReview.prefixes.changesRequested}补充修改意见`,
      `${this.config.openspecReview.prefixes.dismissed}停止该需求`
    ].join("\n");
    const node = await this.resolveChildTaskDevelopmentNode(task.externalId);
    const result = await runCommand(
      this.meegleBin(),
      this.withMeegleGlobalArgs(this.buildSubtaskCreateArgs(task.externalId, node.nodeId, title, description)),
      process.cwd(),
      60_000
    );
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `Meegle OpenSpec review child task create failed for ${task.externalId}`);
    }
    let child = extractChildRepairIssue(parseJson(result.stdout), request.idempotencyKey);
    if (!child) {
      child = await this.waitForCreatedChildRepairIssue(task.externalId, request.idempotencyKey, request.changeId);
    }
    if (!child) {
      throw new Error("Meegle OpenSpec review child task create response is missing child task id");
    }
    return {
      externalId: child.externalId,
      title: child.title || title,
      url: child.url,
      idempotencyKey: request.idempotencyKey,
      reused: false
    };
  }

  async pullOpenSpecReviewIssues(tasks: TitingTask[]): Promise<OpenSpecReviewIssueReply[]> {
    const replies = await Promise.all(tasks.map(async (task) => this.listOpenSpecReviewReplies(task)));
    return replies.flat();
  }

  /** Shared-secret gate for webhook requests (`x-diting-webhook-secret`). */
  verifyWebhookSecret(secret: string | undefined): boolean {
    if (this.config.plugins.meegle.mode !== "webhook") {
      return false;
    }
    return Boolean(secret) && secret === this.config.plugins.meegle.webhookSecret;
  }

  /** Returns sanitized Meegle CLI auth state for UI/readiness surfaces. */
  async getAuthStatus(): Promise<MeegleAuthStatus> {
    const result = await runCommand(this.meegleBin(), this.withMeegleGlobalArgs(["auth", "status", "--format", "json"]), process.cwd(), 30_000);
    if (result.exitCode !== 0) {
      return {
        status: "unauthenticated",
        authenticated: false,
        message: isCliBinaryMissing(result)
          ? buildCliNotFoundMessage("meegle", this.meegleBin(), "MEEGLE_CLI_BIN")
          : (result.stderr.trim() || result.stdout.trim() || "Meegle authorization required")
      };
    }
    const payload = parseOptionalJsonObject(result.stdout);
    return {
      status: "authenticated",
      authenticated: true,
      message: "Meegle CLI is authenticated",
      host: readStringCandidate(payload, ["host", "domain"]),
      profile: readStringCandidate(payload, ["profile"])
    };
  }

  /** Starts Meegle CLI device-code login and returns only browser/relay metadata. */
  async startAuth(): Promise<MeegleAuthStartResult> {
    const result = await runCommand(
      this.meegleBin(),
      this.withMeegleGlobalArgs(["auth", "login", "--device-code", "--phase", "init", "--format", "json"]),
      process.cwd(),
      30_000
    );
    if (result.exitCode !== 0) {
      if (isCliBinaryMissing(result)) {
        throw new MeegleCliNotFoundError(buildCliNotFoundMessage("meegle", this.meegleBin(), "MEEGLE_CLI_BIN"));
      }
      throw new Error(result.stderr.trim() || result.stdout.trim() || "Meegle authorization initialization failed");
    }
    const payload = parseJson(result.stdout) as Record<string, unknown>;
    const authorizationUrl = readStringCandidate(payload, [
      "authorizationUrl",
      "authorization_url",
      "verificationUriComplete",
      "verification_uri_complete",
      "verificationUrl",
      "verification_url",
      "url"
    ]);
    const deviceCode = readStringCandidate(payload, ["deviceCode", "device_code"]);
    const clientId = readStringCandidate(payload, ["clientId", "client_id"]);
    if (!authorizationUrl || !deviceCode || !clientId) {
      throw new Error("Meegle authorization response is missing authorizationUrl, deviceCode, or clientId");
    }
    const intervalSeconds = readNumberCandidate(payload, ["intervalSeconds", "interval_seconds", "interval"]) ?? 5;
    const expiresInSeconds = readNumberCandidate(payload, ["expiresInSeconds", "expires_in_seconds", "expiresIn", "expires_in"]) ?? 600;
    return {
      status: "pending",
      authenticated: false,
      authorizationUrl,
      deviceCode,
      clientId,
      intervalSeconds,
      expiresInSeconds,
      userCode: readStringCandidate(payload, ["userCode", "user_code"]),
      message: "Open the authorization URL to authorize Meegle"
    };
  }

  /** Performs a single non-blocking Meegle device-code poll. */
  async pollAuth(input: MeegleAuthPollInput): Promise<MeegleAuthPollResult> {
    const deviceCode = input.deviceCode?.trim() ?? "";
    const clientId = input.clientId?.trim() ?? "";
    if (!deviceCode || !clientId) {
      throw new Error("deviceCode and clientId are required");
    }
    const args = this.withMeegleGlobalArgs([
      "auth",
      "login",
      "--device-code",
      "--phase",
      "poll",
      "--once",
      "--device-code-value",
      deviceCode,
      "--client-id",
      clientId,
      "--interval",
      String(input.intervalSeconds ?? 5),
      "--expires-in",
      String(input.expiresInSeconds ?? 600),
      "--format",
      "json"
    ]);
    const result = await runCommand(this.meegleBin(), args, process.cwd(), 30_000);
    const combined = `${result.stdout}\n${result.stderr}`.trim();
    const payload = parseOptionalJsonObject(result.stdout);
    if (result.exitCode === 0 && payload.authenticated === true) {
      return {
        status: "authenticated",
        authenticated: true,
        message: "Meegle authorization completed",
        host: readStringCandidate(payload, ["host", "domain"]),
        profile: readStringCandidate(payload, ["profile"])
      };
    }
    const pending = result.exitCode === 0 || /authorization_pending|pending|slow_down/i.test(combined);
    if (pending) {
      return {
        status: "pending",
        authenticated: false,
        message: readStringCandidate(payload, ["message"]) ?? "Waiting for Meegle authorization"
      };
    }
    return {
      status: /expired/i.test(combined) ? "expired" : "failed",
      authenticated: false,
      message: result.stderr.trim() || result.stdout.trim() || "Meegle authorization polling failed"
    };
  }

  /** Logs out the Meegle CLI profile used by this server process. */
  async logoutAuth(): Promise<{ ok: boolean; message: string }> {
    const result = await runCommand(this.meegleBin(), this.withMeegleGlobalArgs(["auth", "logout", "--format", "json"]), process.cwd(), 30_000);
    if (result.exitCode !== 0) {
      if (isCliBinaryMissing(result)) {
        throw new MeegleCliNotFoundError(buildCliNotFoundMessage("meegle", this.meegleBin(), "MEEGLE_CLI_BIN"));
      }
      throw new Error(result.stderr.trim() || result.stdout.trim() || "Meegle logout failed");
    }
    return { ok: true, message: "Meegle CLI logged out" };
  }

  /** Structured status for ops dashboards: which auth path and files are configured. */
  webhookHealth(): {
    mode: "polling" | "webhook";
    healthy: boolean;
    authMode: "file" | "shared-secret" | "cli-device-code";
    tasksFileConfigured: boolean;
    resultsFileConfigured: boolean;
    webhookSecretConfigured: boolean;
  } {
    return {
      mode: this.config.plugins.meegle.mode,
      healthy: this.config.plugins.meegle.mode === "polling"
        ? Boolean(this.config.plugins.meegle.tasksFile)
        : Boolean(this.config.plugins.meegle.webhookSecret),
      authMode: this.config.plugins.meegle.mode === "polling"
        ? (this.config.plugins.meegle.tasksFile ? "file" : "cli-device-code")
        : "shared-secret",
      tasksFileConfigured: Boolean(this.config.plugins.meegle.tasksFile),
      resultsFileConfigured: Boolean(this.config.plugins.meegle.resultsFile),
      webhookSecretConfigured: Boolean(this.config.plugins.meegle.webhookSecret)
    };
  }

  /** Normalizes `{ tasks: [] }`, `{ task: {} }`, or bare arrays into {@link mapMeegleTask} inputs. */
  async parseWebhookTasks(payload: unknown): Promise<TitingTask[]> {
    const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const rows = Array.isArray(root.tasks)
      ? root.tasks
      : root.task
        ? [root.task]
        : [];
    return Promise.all(rows.map((row, index) => this.mapMeegleTask(row, index)));
  }

  /**
   * Registers health + webhook routes. Webhook path verifies secret, parses tasks, then calls
   * `context.services.ingestTaskFromIntegration` for each row (202 with accepted counts).
   */
  registerRoutes(fastify: FastifyInstance, context: HttpPluginContext): void {
    fastify.get("/api/integrations/meegle/health", async () => {
      const health = await this.health();
      return {
        ok: health.healthy,
        pluginId: this.id,
        ...health
      };
    });

    fastify.get("/api/integrations/meegle/auth/status", async () => this.getAuthStatus());

    fastify.post("/api/integrations/meegle/auth/start", async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        return await this.startAuth();
      } catch (error) {
        if (error instanceof MeegleCliNotFoundError) {
          return reply.status(503).send({ error: error.message });
        }
        throw error;
      }
    });

    fastify.post("/api/integrations/meegle/auth/poll", async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return await this.pollAuth((request.body ?? {}) as MeegleAuthPollInput);
      } catch (error) {
        if (error instanceof MeegleCliNotFoundError) {
          return reply.status(503).send({ error: error.message });
        }
        throw error;
      }
    });

    fastify.post("/api/integrations/meegle/auth/logout", async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        return await this.logoutAuth();
      } catch (error) {
        if (error instanceof MeegleCliNotFoundError) {
          return reply.status(503).send({ error: error.message });
        }
        throw error;
      }
    });

    fastify.post("/api/integrations/meegle/webhook", async (request: FastifyRequest, reply: FastifyReply) => {
      if (this.config.plugins.meegle.mode !== "webhook") {
        return reply.status(409).send({ error: "Meegle webhook mode is not enabled" });
      }
      const secret = request.headers["x-diting-webhook-secret"];
      const providedSecret = Array.isArray(secret) ? secret[0] : secret;
      if (!this.verifyWebhookSecret(providedSecret)) {
        return reply.status(401).send({ error: "Invalid Meegle webhook secret" });
      }
      const tasks = await this.parseWebhookTasks(request.body);
      if (tasks.length === 0) {
        return reply.status(400).send({ error: "Webhook payload must include task or tasks" });
      }
      const ingested = (
        await Promise.all(tasks.map((task) => context.services.ingestTaskFromIntegration(task, "meegle-webhook")))
      ).filter((task): task is NonNullable<typeof task> => Boolean(task));
      return reply.status(202).send({
        accepted: ingested.length,
        externalIds: ingested.map((task) => task.externalId).filter((value): value is string => Boolean(value))
      });
    });
  }

  /** Proves `meegle` CLI is on PATH and either authenticated or scoped to `projectKey`. */
  private async checkCliReadiness(): Promise<{ healthy: boolean; message: string }> {
    const projectKey = this.config.plugins.meegle.projectKey?.trim() ?? "";
    const result = projectKey
      ? await runCommand(
          this.meegleBin(),
          this.withMeegleGlobalArgs(["project", "search", "--project-key", projectKey, "-o", "json", "--envelope"]),
          process.cwd(),
          30_000
        )
      : null;
    if (!result) {
      const auth = await this.getAuthStatus();
      return {
        healthy: auth.authenticated,
        message: auth.authenticated ? `Meegle CLI integration ready: ${this.meegleBin()}` : auth.message
      };
    }
    if (result.exitCode !== 0) {
      return {
        healthy: false,
        message: result.stderr.trim() || result.stdout.trim() || "Meegle CLI readiness check failed"
      };
    }
    return {
      healthy: true,
      message: `Meegle CLI integration ready for ${projectKey}`
    };
  }

  private meegleBin(): string {
    return this.config.plugins.meegle.cliBin ?? "meegle";
  }

  private defaultExecutor(): string {
    return this.config.plugins.execution.defaultExecutor;
  }

  private productRuntime(): string {
    return this.config.plugins.agents.product.defaultRuntime;
  }

  private async mapMeegleTask(row: unknown, index: number): Promise<TitingTask> {
    const initialTask = mapMeegleTask(row, index, this.defaultExecutor(), { productRuntime: this.productRuntime() });
    const inspection = await this.inspectSpecPackage(initialTask);
    if (!inspection) {
      return initialTask;
    }
    const record = row && typeof row === "object" ? row as Record<string, unknown> : {};
    const metadata = record.metadata && typeof record.metadata === "object"
      ? record.metadata as Record<string, unknown>
      : {};
    return mapMeegleTask({
      ...record,
      metadata: {
        ...metadata,
        specPackageInspection: inspection
      }
    }, index, this.defaultExecutor(), { productRuntime: this.productRuntime() });
  }

  private async inspectSpecPackage(task: TitingTask): Promise<SpecPackageInspection | null> {
    const attachments = extractSpecAttachmentsFromRow({
      metadata: task.metadata,
      fields: task.metadata.meegleFields,
      work_item_fields: task.metadata.meegleWorkItemFields
    });
    const archives = attachments.filter((attachment) => isSpecArchiveName(attachment.name));
    if (archives.length === 0) {
      return null;
    }
    const cacheKey = [
      task.externalId ?? "",
      ...archives.map((attachment) => [
        attachment.name,
        attachment.localPath ?? "",
        attachment.url ?? "",
        attachment.token ?? ""
      ].join("|"))
    ].join("::");
    let inspection = this.specPackageInspectionCache.get(cacheKey);
    if (!inspection) {
      inspection = inspectSpecPackageAttachments(task, this.config);
      this.specPackageInspectionCache.set(cacheKey, inspection);
    }
    return inspection;
  }

  private withMeegleGlobalArgs(args: string[]): string[] {
    return buildMeegleCliArgs(this.config.plugins.meegle, args);
  }

  /**
   * CLI polling resolution order: legacy `task list/get` → if CLI only supports `workitem`, skip to newest flow:
   * latest-sprint MQL pipeline when configured, otherwise generic MQL {@link pullMqlTasks}.
   */
  private async pullCliTasks(): Promise<TitingTask[]> {
    const bin = this.config.plugins.meegle.cliBin ?? "meegle";
    const legacy = await this.tryPullLegacyCliTasks(bin);
    if (legacy) {
      return legacy;
    }
    if (this.shouldUseLatestSprintFlow()) {
      return this.pullLatestSprintTasks(bin);
    }
    return this.pullMqlTasks(bin);
  }

  /**
   * Older Meegle CLI shape: `task list --status open` then per-id `task get`. Returns `null` when stderr indicates
   * unknown `task` subcommand so callers can fall back to `workitem` flows.
   */
  private async tryPullLegacyCliTasks(bin: string): Promise<TitingTask[] | null> {
    const listArgs = this.withMeegleGlobalArgs(["task", "list", "--status", "open"]);
    const listResult = await runCommand(bin, listArgs, process.cwd(), 60_000);
    if (listResult.exitCode !== 0) {
      if (shouldFallbackToWorkitemCli(listArgs, listResult)) {
        return null;
      }
      throw new Error(listResult.stderr.trim() || listResult.stdout.trim() || "Meegle legacy task list failed");
    }

    const listItems = extractTaskListPayload(parseJson(listResult.stdout));
    const tasks: TitingTask[] = [];
    for (const [index, item] of listItems.entries()) {
      const taskId = asNonEmptyString(item.id);
      if (!taskId) {
        continue;
      }
      const detailResult = await runCommand(bin, this.withMeegleGlobalArgs(["task", "get", taskId]), process.cwd(), 60_000);
      if (detailResult.exitCode !== 0) {
        throw new Error(detailResult.stderr.trim() || detailResult.stdout.trim() || `Meegle task get failed for ${taskId}`);
      }
      const detail = extractTaskDetailPayload(parseJson(detailResult.stdout));
      tasks.push(await this.mapMeegleTask(mergeMeegleTaskRecords(item, detail), index));
    }
    return tasks;
  }

  /**
   * `workitem query` with configured MQL: list envelope → hydrate each row via {@link fetchWorkitemDetail}.
   */
  private async pullMqlTasks(bin: string): Promise<TitingTask[]> {
    const projectKey = this.requireMeegleConfig("MEEGLE_PROJECT_KEY", this.config.plugins.meegle.projectKey);
    const mql = this.requireMeegleConfig("MEEGLE_QUERY_MQL", this.config.plugins.meegle.queryMql);
    const queryResult = await runCommand(
      bin,
      this.withMeegleGlobalArgs(["workitem", "query", "--project-key", projectKey, "--mql", mql, "-o", "json", "--envelope"]),
      process.cwd(),
      60_000
    );
    if (queryResult.exitCode !== 0) {
      throw new Error(queryResult.stderr.trim() || queryResult.stdout.trim() || "Meegle query failed");
    }
    const listItems: Array<Record<string, unknown>> = extractTaskListPayload(parseJson(queryResult.stdout)).map((item) => ({
      ...item,
      projectKey
    }));
    const tasks: TitingTask[] = [];
    for (const [index, item] of listItems.entries()) {
      const taskId = asNonEmptyString(item.id);
      if (!taskId) {
        continue;
      }
      const row = await this.hydrateWorkitemRow(bin, projectKey, taskId, item, this.getDetailFields());
      tasks.push(await this.mapMeegleTask(row, index));
    }
    return tasks;
  }

  /**
   * Sprint-centric mode: newest sprint row via MQL → demand workitems linked to that sprint (optional node filter) → detail fetch.
   * Enriches task metadata with `latestSprint` payload for downstream context.
   */
  private async pullLatestSprintTasks(bin: string): Promise<TitingTask[]> {
    const projectKey = this.requireMeegleConfig("MEEGLE_PROJECT_KEY", this.config.plugins.meegle.projectKey);
    const projectScopeName = this.requireMeegleConfig("MEEGLE_PROJECT_SCOPE_NAME", this.config.plugins.meegle.projectScopeName);
    const sprintTypeName = this.requireMeegleConfig("MEEGLE_SPRINT_TYPE_NAME", this.config.plugins.meegle.sprintTypeName);
    const demandTypeName = this.requireMeegleConfig("MEEGLE_DEMAND_TYPE_NAME", this.config.plugins.meegle.demandTypeName);
    const sprintLinkField = this.requireMeegleConfig("MEEGLE_SPRINT_LINK_FIELD", this.config.plugins.meegle.sprintLinkField);
    const nodeName = this.config.plugins.meegle.nodeName?.trim() ?? "";

    const sprintQuery =
      `SELECT \`工作项id\`, \`名称\`, \`状态\` FROM \`${projectScopeName}\`.\`${sprintTypeName}\` ` +
      "ORDER BY `工作项id` DESC LIMIT 1";
    const sprintResult = await runCommand(
      bin,
      this.withMeegleGlobalArgs(["workitem", "query", "--project-key", projectKey, "--mql", sprintQuery, "-o", "json", "--envelope"]),
      process.cwd(),
      60_000
    );
    if (sprintResult.exitCode !== 0) {
      throw new Error(sprintResult.stderr.trim() || sprintResult.stdout.trim() || "Meegle latest sprint query failed");
    }
    const sprintRows = extractTaskListPayload(parseJson(sprintResult.stdout));
    const sprintId = asNonEmptyString(sprintRows[0]?.id);
    if (!sprintId) {
      return [];
    }
    const filters = [
      `any_relation_match(\`${sprintLinkField}\`, x -> x.\`工作项ID<target:all>\` = ${sprintId})`
    ];
    if (nodeName) {
      filters.push(`array_contains(in_progress_nodes_name(), ${this.quoteMqlString(nodeName)})`);
    }
    const boardRoleFilter = this.buildBoardRoleMqlFilter();
    if (boardRoleFilter) {
      filters.push(boardRoleFilter);
    }
    const demandQuery =
      `SELECT \`工作项id\`, \`名称\` FROM \`${projectScopeName}\`.\`${demandTypeName}\` ` +
      `WHERE ${filters.join(" AND ")} ORDER BY \`工作项id\` DESC LIMIT 200`;
    const demandResult = await runCommand(
      bin,
      this.withMeegleGlobalArgs(["workitem", "query", "--project-key", projectKey, "--mql", demandQuery, "-o", "json", "--envelope"]),
      process.cwd(),
      60_000
    );
    if (demandResult.exitCode !== 0) {
      throw new Error(demandResult.stderr.trim() || demandResult.stdout.trim() || "Meegle latest sprint demand query failed");
    }
    const listItems = extractTaskListPayload(parseJson(demandResult.stdout));
    const detailFields = this.getLatestSprintDetailFields();
    const boardEmailFilter = this.getBoardEmailFilter();
    const tasks: TitingTask[] = [];
    for (const [index, item] of listItems.entries()) {
      const taskId = asNonEmptyString(item.id);
      if (!taskId) {
        continue;
      }
      const row = await this.hydrateWorkitemRow(bin, projectKey, taskId, item, detailFields, sprintRows[0] ?? {});
      if (boardEmailFilter && !this.matchesBoardRoleEmail(row, boardEmailFilter)) {
        continue;
      }
      tasks.push(await this.mapMeegleTask(row, index));
    }
    return tasks;
  }

  /**
   * Fetches workitem detail and, when spec attachments are still missing, retries without `--fields`
   * so Feishu file fields keyed by internal ids are still returned.
   */
  private async hydrateWorkitemRow(
    bin: string,
    projectKey: string,
    taskId: string,
    listItem: Record<string, unknown>,
    fields: string[],
    sprint?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    let detail = await this.fetchWorkitemDetail(bin, projectKey, taskId, fields);
    let row = applyDescriptionFallback(mergeMeegleTaskRecords(listItem, detail, projectKey));
    if (extractSpecAttachmentsFromRow(row).length === 0) {
      detail = await this.fetchWorkitemDetail(bin, projectKey, taskId, []);
      row = applyDescriptionFallback(mergeMeegleTaskRecords(listItem, detail, projectKey));
    }
    if (extractSpecAttachmentsFromRow(row).length === 0) {
      const specFieldKeys = await this.resolveSpecFieldKeys(bin, projectKey);
      let supplementalFields = await this.fetchSpecFieldsByProjection(bin, projectKey, taskId, specFieldKeys);
      if (Object.keys(supplementalFields).length === 0) {
        supplementalFields = await this.fetchSpecFieldsViaMql(bin, projectKey, taskId, specFieldKeys);
      }
      if (Object.keys(supplementalFields).length > 0) {
        row = applyDescriptionFallback(
          mergeMeegleFieldsIntoRow(mergeMeegleTaskRecords(listItem, detail, projectKey), supplementalFields)
        );
      }
    }
    return sprint ? this.normalizeTaskRow(row, sprint) : row;
  }

  /** Thin wrapper around `workitem get` with explicit `--fields` projection list. */
  private async fetchWorkitemDetail(
    bin: string,
    projectKey: string,
    taskId: string,
    fields: string[]
  ): Promise<Record<string, unknown>> {
    const args = ["workitem", "get", "--work-item-id", taskId, "--project-key", projectKey, "-o", "json", "--envelope"];
    for (const field of fields) {
      args.push("--fields", field);
    }
    const result = await runCommand(bin, this.withMeegleGlobalArgs(args), process.cwd(), 60_000);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `Meegle workitem get failed for ${taskId}`);
    }
    return extractTaskDetailPayload(parseJson(result.stdout));
  }

  /**
   * Requests each candidate spec field alone via envelope `workitem get`.
   * Brief API often omits file fields in the default bundle but returns them when
   * the correct internal `field_key` is projected (display name「spec文档」may differ).
   */
  private async fetchSpecFieldsByProjection(
    bin: string,
    projectKey: string,
    taskId: string,
    fieldKeys: string[]
  ): Promise<Record<string, unknown>> {
    let merged: Record<string, unknown> = {};
    for (const fieldKey of fieldKeys) {
      try {
        const detail = await this.fetchWorkitemDetail(bin, projectKey, taskId, [fieldKey]);
        merged = mergeMeegleFieldBags(
          merged,
          readMeegleFieldBag(detail),
          extractWorkitemFieldsBag(
            Array.isArray(detail.work_item_fields)
              ? { work_item_fields: detail.work_item_fields }
              : { data: detail }
          )
        ) ?? merged;
      } catch {
        // Try next candidate key.
      }
    }
    return merged;
  }

  /** Uses MQL to read attachment columns when brief `workitem get` omits file fields. */
  private async fetchSpecFieldsViaMql(
    bin: string,
    projectKey: string,
    taskId: string,
    fieldKeys: string[]
  ): Promise<Record<string, unknown>> {
    const projectScopeName = this.config.plugins.meegle.projectScopeName?.trim() ?? "";
    const demandTypeName = this.config.plugins.meegle.demandTypeName?.trim() ?? "";
    if (!projectScopeName || !demandTypeName || fieldKeys.length === 0) {
      return {};
    }
    const selectList = fieldKeys.map((key) => `\`${key.replaceAll("`", "")}\``).join(", ");
    const mql = `SELECT ${selectList} FROM \`${projectScopeName}\`.\`${demandTypeName}\` WHERE \`工作项id\` = ${taskId}`;
    const args = this.withMeegleGlobalArgs(["workitem", "query", "--project-key", projectKey, "--mql", mql, "-o", "json", "--envelope"]);
    const result = await runCommand(bin, args, process.cwd(), 60_000);
    if (result.exitCode !== 0) {
      return {};
    }
    const bag = extractMoqlSearchFieldBag(parseJson(result.stdout));
    return bag ?? {};
  }

  private async resolveSpecFieldKeys(bin: string, projectKey: string): Promise<string[]> {
    const merged = new Set(this.withSpecDetailFields([]));
    const extra = this.config.plugins.meegle.specFieldKeys ?? [];
    for (const key of extra) {
      merged.add(key.trim());
    }
    if (this.discoveredSpecFieldKeys) {
      for (const key of this.discoveredSpecFieldKeys) {
        merged.add(key);
      }
    } else {
      const discovered = await this.discoverSpecFieldKeysFromMeta(bin, projectKey);
      this.discoveredSpecFieldKeys = discovered;
      for (const key of discovered) {
        merged.add(key);
      }
    }
    return [...merged].filter(Boolean);
  }

  private workItemTypeKeyForMeta(): string {
    const configured = this.config.plugins.meegle.demandTypeName?.trim() ?? "";
    if (configured && /^[a-z][a-z0-9_]*$/i.test(configured)) {
      return configured;
    }
    return "story";
  }

  private async discoverSpecFieldKeysFromMeta(bin: string, projectKey: string): Promise<string[]> {
    const args = [
      "workitem",
      "meta-fields",
      "--project-key",
      projectKey,
      "--work-item-type",
      this.workItemTypeKeyForMeta(),
      "--page-num",
      "1",
      "-o",
      "json"
    ];
    const result = await runCommand(bin, this.withMeegleGlobalArgs(args), process.cwd(), 60_000);
    if (result.exitCode !== 0) {
      return [];
    }
    return extractSpecFieldKeysFromMetaPayload(parseJson(result.stdout));
  }

  /** `meegle comment add` with optional `--project-key`. */
  private async addComment(taskId: string, text: string): Promise<void> {
    const bin = this.config.plugins.meegle.cliBin ?? "meegle";
    const args = ["comment", "add", "--work-item-id", taskId, "--content", text];
    const projectKey = this.config.plugins.meegle.projectKey?.trim() ?? "";
    if (projectKey) {
      args.push("--project-key", projectKey);
    }
    const result = await runCommand(bin, this.withMeegleGlobalArgs(args), process.cwd(), 60_000);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `Meegle comment add failed for ${taskId}`);
    }
  }

  private async listHumanReplies(task: TitingTask): Promise<HumanReply[]> {
    if (!task.externalId) {
      return [];
    }
    const result = await runCommand(this.meegleBin(), this.withMeegleGlobalArgs(this.buildCommentListArgs(task.externalId)), process.cwd(), 60_000);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `Meegle comment list failed for ${task.externalId}`);
    }
    const comments = extractCommentPayload(parseJson(result.stdout));
    const requestedAt = readHumanLoopRequestedAt(task.metadata);
    return comments
      .filter((comment) => !comment.body.includes("[DITING_NEEDS_HUMAN"))
      .filter((comment) => !requestedAt || new Date(comment.createdAt).getTime() >= new Date(requestedAt).getTime())
      .flatMap((comment) => {
        const body = isProductOpenSpecTask(task) ? parseTaggedHumanReply(comment.body) : comment.body;
        if (!body) {
          return [];
        }
        return [{
          taskId: task.id,
          externalId: task.externalId ?? "",
          replyId: comment.id ?? buildReplyFingerprint(task.externalId ?? "", comment),
          body,
          author: comment.author,
          createdAt: comment.createdAt
        }];
      });
  }

  private async listOpenSpecReviewReplies(task: TitingTask): Promise<OpenSpecReviewIssueReply[]> {
    if (!task.externalId) {
      return [];
    }
    const review = readOpenSpecReviewMetadata(task.metadata);
    if (!review.externalId) {
      return [];
    }
    const detail = await this.fetchSubtaskWorkitemDetail(review.externalId);
    const child = mapChildRepairIssueRecord(
      { externalId: review.externalId, title: "", url: null, updatedAt: "" },
      detail,
      this.childTaskDescriptionFieldKey()
    );
    if (review.requestedAt && new Date(child.updatedAt).getTime() < new Date(review.requestedAt).getTime()) {
      return [];
    }
    const parsed = parseOpenSpecReviewReply(child.rawDescription, this.config.openspecReview.prefixes);
    return [{
      taskId: task.id,
      parentExternalId: task.externalId,
      reviewExternalId: child.externalId,
      replyId: buildChildRepairReplyId(child.externalId, child.updatedAt, child.rawDescription),
      ready: parsed.ready,
      decision: parsed.decision,
      body: parsed.body,
      rawBody: child.rawDescription,
      updatedAt: child.updatedAt
    } satisfies OpenSpecReviewIssueReply];
  }

  private buildCommentListArgs(taskId: string): string[] {
    const args = ["comment", "list", "--work-item-id", taskId, "-o", "json", "--envelope"];
    const projectKey = this.config.plugins.meegle.projectKey?.trim() ?? "";
    if (projectKey) {
      args.push("--project-key", projectKey);
    }
    return args;
  }

  private async listChildRepairIssues(parentExternalId: string): Promise<Array<{
    externalId: string;
    title: string;
    url: string | null;
    idempotencyKey: string | null;
  }>> {
    const node = await this.resolveChildTaskDevelopmentNode(parentExternalId);
    const hydrated = await Promise.all(
      node.subTasks.map(async (subTask) => {
        const detail = await this.fetchSubtaskWorkitemDetail(subTask.externalId);
        return mapChildRepairIssueRecord(subTask, detail, this.childTaskDescriptionFieldKey());
      })
    );
    return hydrated.map(({ externalId, title, url, idempotencyKey }) => ({
      externalId,
      title,
      url,
      idempotencyKey
    }));
  }

  private async readChildRepairIssueReply(task: TitingTask): Promise<HumanRepairIssueReply | null> {
    if (!task.externalId) {
      return null;
    }
    const childIssue = readChildIssueMetadata(task.metadata);
    if (!childIssue?.externalId) {
      return null;
    }
    const detail = await this.fetchSubtaskWorkitemDetail(childIssue.externalId);
    const child = mapChildRepairIssueRecord(
      { externalId: childIssue.externalId, title: "", url: null, updatedAt: new Date(0).toISOString() },
      detail,
      this.childTaskDescriptionFieldKey()
    );
    const body = readReadyChildRepairDescription(child.rawDescription);
    return {
      taskId: task.id,
      parentExternalId: task.externalId,
      childExternalId: child.externalId,
      replyId: buildChildRepairReplyId(child.externalId, child.updatedAt, child.rawDescription),
      ready: body !== null,
      body: body ?? "",
      rawDescription: child.rawDescription,
      updatedAt: child.updatedAt
    };
  }

  private childTaskDescriptionFieldKey(): string | null {
    return this.config.plugins.meegle.childTaskDescriptionFieldKey?.trim() || null;
  }

  private childTaskNodeName(): string | null {
    return this.config.plugins.meegle.nodeName?.trim() || null;
  }

  private async resolveChildTaskDevelopmentNode(parentExternalId: string): Promise<{
    nodeId: string;
    nodeName: string;
    subTasks: Array<{ externalId: string; title: string; url: string | null; updatedAt: string }>;
  }> {
    const projectKey = this.requireMeegleConfig("MEEGLE_PROJECT_KEY", this.config.plugins.meegle.projectKey);
    const result = await runCommand(
      this.meegleBin(),
      this.withMeegleGlobalArgs(this.buildWorkflowGetNodeArgs(parentExternalId, projectKey)),
      process.cwd(),
      60_000
    );
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `Meegle workflow get-node failed for ${parentExternalId}`);
    }
    const node = pickChildTaskDevelopmentNode(parseJson(result.stdout), this.childTaskNodeName());
    if (!node) {
      throw new Error(`Meegle child task development node is unavailable for ${parentExternalId}`);
    }
    return node;
  }

  private async fetchSubtaskWorkitemDetail(subTaskId: string): Promise<Record<string, unknown>> {
    const projectKey = this.requireMeegleConfig("MEEGLE_PROJECT_KEY", this.config.plugins.meegle.projectKey);
    const result = await runCommand(
      this.meegleBin(),
      this.withMeegleGlobalArgs(this.buildSubtaskWorkitemGetArgs(subTaskId, projectKey)),
      process.cwd(),
      60_000
    );
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || `Meegle workitem get failed for subtask ${subTaskId}`);
    }
    return extractTaskDetailPayload(parseJson(result.stdout));
  }

  private async waitForCreatedChildRepairIssue(
    parentExternalId: string,
    idempotencyKey: string | null,
    fallbackText: string
  ): Promise<ReturnType<typeof extractChildRepairIssues>[number] | null> {
    const attempts = 3;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const refreshed = await this.listChildRepairIssues(parentExternalId);
      const fallback = idempotencyKey
        ? refreshed.find((item) => item.idempotencyKey === idempotencyKey) ?? null
        : refreshed.find((item) => fallbackText && item.title.includes(fallbackText)) ?? null;
      if (fallback) {
        return {
          externalId: fallback.externalId,
          title: fallback.title,
          url: fallback.url,
          rawDescription: "",
          updatedAt: new Date(0).toISOString(),
          idempotencyKey: fallback.idempotencyKey
        };
      }
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    return null;
  }

  private buildWorkflowGetNodeArgs(parentExternalId: string, projectKey: string): string[] {
    return [
      "workflow",
      "get-node",
      "--project-key",
      projectKey,
      "--work-item-id",
      parentExternalId,
      "--node-id-list",
      "_all",
      "--need-sub-task",
      "true",
      "-o",
      "json",
      "--envelope"
    ];
  }

  private buildSubtaskWorkitemGetArgs(subTaskId: string, projectKey: string): string[] {
    return [
      "workitem",
      "get",
      "--work-item-id",
      subTaskId,
      "--project-key",
      projectKey,
      "--fields",
      "_all",
      "-o",
      "json",
      "--envelope"
    ];
  }

  private buildSubtaskCreateArgs(
    parentExternalId: string,
    nodeId: string,
    title: string,
    description: string
  ): string[] {
    const projectKey = this.requireMeegleConfig("MEEGLE_PROJECT_KEY", this.config.plugins.meegle.projectKey);
    const args = [
      "subtask",
      "update",
      "--action",
      "create",
      "--node-id",
      nodeId,
      "--work-item-id",
      parentExternalId,
      "--project-key",
      projectKey,
      "--fields",
      this.buildFieldAssignment("name", title),
      "-o",
      "json",
      "--envelope"
    ];
    const descriptionFieldKey = this.childTaskDescriptionFieldKey();
    if (descriptionFieldKey) {
      args.push("--fields", this.buildFieldAssignment(descriptionFieldKey, description));
    } else {
      args.push("--fields", this.buildFieldAssignment("子任务描述", description));
    }
    return args;
  }

  /** Meegle CLI normalizes JSON `--fields` values to the struct array expected by the backend. */
  private buildFieldAssignment(field: string, value: string): string {
    return JSON.stringify({ field_key: field, field_value: value });
  }

  /** Default field bundle for generic MQL/detail hydration. */
  private getDetailFields(): string[] {
    const configured = this.config.plugins.meegle.detailFields ?? [
      "repo",
      "branch",
      "instruction",
      "priority",
      "description",
      "title",
      "spec文档",
      "spec_doc",
      "specDocs"
    ];
    return this.withSpecDetailFields(configured);
  }

  /** Lighter projection for sprint demand rows; always includes spec attachment field keys. */
  private getLatestSprintDetailFields(): string[] {
    const configured = this.config.plugins.meegle.latestSprintDetailFields ?? ["description"];
    return this.withSpecDetailFields(configured);
  }

  /** Ensures workitem detail requests always ask for spec attachment fields. */
  private withSpecDetailFields(fields: string[]): string[] {
    const merged = new Set(
      fields.map((field) => field.trim()).filter(Boolean)
    );
    for (const key of ["spec文档", "spec_doc", "specDocs", "spec_documents"]) {
      merged.add(key);
    }
    return [...merged];
  }

  /** `sourceMode=latest_sprint` wins; absent explicit `queryMql` also triggers sprint flow for CLI-only setups. */
  private shouldUseLatestSprintFlow(): boolean {
    if (this.config.plugins.meegle.sourceMode === "latest_sprint") {
      return true;
    }
    return !(this.config.plugins.meegle.queryMql?.trim());
  }

  /** CLI paths require non-empty trimmed config; throws fast with `${NAME} is required`. */
  private requireMeegleConfig(name: string, value: string | null | undefined): string {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) {
      throw new Error(`${name} is required when using the Meegle CLI`);
    }
    return trimmed;
  }

  /** Escapes user-controlled `nodeName` etc. for embedding inside MQL string literals. */
  private quoteMqlString(value: string): string {
    return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
  }

  private getBoardRoleFilter(): { roleName: string; value: string } | null {
    const value = this.config.plugins.meegle.boardValue?.trim();
    if (!value) {
      return null;
    }
    const roleName = this.config.plugins.meegle.boardField?.trim() || "板子R";
    return { roleName, value };
  }

  private getBoardEmailFilter(): { roleName: string; email: string } | null {
    const email = this.config.plugins.meegle.boardUserEmail?.trim();
    if (!email) {
      return null;
    }
    const roleName = this.config.plugins.meegle.boardField?.trim() || "板子R";
    return { roleName, email: email.toLowerCase() };
  }

  private buildBoardRoleMqlFilter(): string | null {
    if (this.getBoardEmailFilter()) {
      return null;
    }
    const boardRole = this.getBoardRoleFilter();
    if (!boardRole) {
      return null;
    }
    const roleField = boardRole.roleName.startsWith("__") ? boardRole.roleName : `__${boardRole.roleName}`;
    const safeRoleField = roleField.replaceAll("`", "");
    return `any_match(\`${safeRoleField}\`, x -> x in (${this.quoteMqlString(boardRole.value)}))`;
  }

  private matchesBoardRoleEmail(row: Record<string, unknown>, filter: { roleName: string; email: string }): boolean {
    if (!Array.isArray(row.role_members)) {
      return false;
    }
    const expectedRoleName = filter.roleName.trim();
    for (const role of row.role_members) {
      if (!role || typeof role !== "object") {
        continue;
      }
      const roleRecord = role as Record<string, unknown>;
      const roleName = asNonEmptyString(roleRecord.name) ?? asNonEmptyString(roleRecord.key);
      if (roleName !== expectedRoleName) {
        continue;
      }
      if (!Array.isArray(roleRecord.members)) {
        continue;
      }
      for (const member of roleRecord.members) {
        if (!member || typeof member !== "object") {
          continue;
        }
        const email = asNonEmptyString((member as Record<string, unknown>).email)?.toLowerCase();
        if (email === filter.email) {
          return true;
        }
      }
    }
    return false;
  }

  /** Attaches sprint snapshot under `metadata.latestSprint` for observability/linkage. */
  private normalizeTaskRow(row: Record<string, unknown>, sprint: Record<string, unknown>): Record<string, unknown> {
    return {
      ...row,
      metadata: {
        ...(typeof row.metadata === "object" && row.metadata !== null ? row.metadata as Record<string, unknown> : {}),
        latestSprint: sprint
      }
    };
  }
}

/** Collects attachment field keys from `workitem meta-fields` (display name may be「spec文档」). */
function extractSpecFieldKeysFromMetaPayload(value: unknown): string[] {
  const keys = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }
    const record = node as Record<string, unknown>;
    const fieldKey =
      asNonEmptyString(record.field_key)
      ?? asNonEmptyString(record.fieldKey)
      ?? asNonEmptyString(record.key);
    const displayName =
      asNonEmptyString(record.field_name)
      ?? asNonEmptyString(record.fieldName)
      ?? asNonEmptyString(record.name)
      ?? asNonEmptyString(record.label);
    const typeKey = (
      asNonEmptyString(record.field_type_key)
      ?? asNonEmptyString(record.field_type)
      ?? asNonEmptyString(record.type)
      ?? ""
    ).toLowerCase();
    if (fieldKey && displayName && (isMeegleSpecFieldLabel(fieldKey, displayName) || typeKey.includes("attach") || typeKey.includes("file"))) {
      keys.add(fieldKey);
      if (isMeegleSpecFieldLabel(displayName)) {
        keys.add(displayName);
      }
    }
    for (const nested of Object.values(record)) {
      visit(nested);
    }
  };
  visit(value);
  return [...keys];
}

function parseOptionalJsonObject(value: string): Record<string, unknown> {
  if (!value.trim()) {
    return {};
  }
  try {
    const parsed = parseJson(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function readStringCandidate(value: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }
  return undefined;
}

function readNumberCandidate(value: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string" && candidate.trim()) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function extractCommentPayload(value: unknown): Array<{
  id?: string;
  body: string;
  author?: string;
  createdAt: string;
}> {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? (() => {
          const record = value as Record<string, unknown>;
          const nested = record.comments ?? record.items ?? record.data ?? record.list ?? record.records;
          return Array.isArray(nested) ? nested : [];
        })()
      : [];
  return rows
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const body = readStringCandidate(item, ["content", "body", "text", "comment", "message"]) ?? "";
      const createdAt = readStringCandidate(item, ["createdAt", "created_at", "timestamp"]) ?? new Date(0).toISOString();
      return {
        id: readStringCandidate(item, ["id", "commentId", "comment_id"]),
        body,
        author: readStringCandidate(item, ["author", "creator", "user", "createdBy", "created_by"]),
        createdAt
      };
    })
    .filter((item) => item.body.trim().length > 0);
}

function readHumanLoopRequestedAt(metadata: Record<string, unknown>): string | null {
  const humanLoop = metadata.humanLoop;
  if (!humanLoop || typeof humanLoop !== "object") {
    return null;
  }
  const requestedAt = (humanLoop as Record<string, unknown>).requestedAt;
  return typeof requestedAt === "string" && requestedAt.trim() ? requestedAt : null;
}

function isProductOpenSpecTask(task: TitingTask): boolean {
  return task.agentKind === "product" || task.driverId === "openspec-product" || task.executor === "product";
}

function readOpenSpecReviewMetadata(metadata: Record<string, unknown>): { externalId: string | null; requestedAt: string | null } {
  const review = metadata.openSpecReview;
  if (!review || typeof review !== "object") {
    return { externalId: null, requestedAt: null };
  }
  const value = review as Record<string, unknown>;
  return {
    externalId: typeof value.externalId === "string" && value.externalId.trim() ? value.externalId.trim() : null,
    requestedAt: typeof value.requestedAt === "string" && value.requestedAt.trim() ? value.requestedAt.trim() : null
  };
}

function isSpecArchiveName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized.endsWith(".zip") || normalized.endsWith(".tar.gz") || normalized.endsWith(".tgz");
}

function buildReplyFingerprint(taskId: string, comment: { body: string; author?: string; createdAt: string }): string {
  return createHash("sha256")
    .update(`${taskId}:${comment.author ?? ""}:${comment.createdAt}:${comment.body}`)
    .digest("hex");
}

function readChildIssueMetadata(metadata: Record<string, unknown>): { externalId: string; idempotencyKey: string | null } | null {
  const humanLoop = metadata.humanLoop;
  if (!humanLoop || typeof humanLoop !== "object") {
    return null;
  }
  const childIssue = (humanLoop as Record<string, unknown>).childIssue;
  if (!childIssue || typeof childIssue !== "object") {
    return null;
  }
  const record = childIssue as Record<string, unknown>;
  const externalId = typeof record.externalId === "string" ? record.externalId.trim() : "";
  if (!externalId) {
    return null;
  }
  return {
    externalId,
    idempotencyKey: typeof record.idempotencyKey === "string" && record.idempotencyKey.trim()
      ? record.idempotencyKey.trim()
      : null
  };
}

function extractChildRepairIssues(value: unknown): Array<{
  externalId: string;
  title: string;
  url: string | null;
  rawDescription: string;
  updatedAt: string;
  idempotencyKey: string | null;
}> {
  const rows = unwrapChildRepairIssueRows(value);
  return rows
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => mapChildRepairIssueRecord(
      readChildRepairIssueIdentity(item),
      item,
      null
    ))
    .filter((item) => item.externalId.trim().length > 0);
}

function readChildRepairIssueIdentity(item: Record<string, unknown>): {
  externalId: string;
  title: string;
  url: string | null;
  updatedAt: string;
} {
  const workItem = readWorkItemRecord(item);
  const attribute = readWorkItemAttributeRecord(item);
  return {
    externalId:
      readStringCandidate(item, [
        "id",
        "externalId",
        "external_id",
        "childExternalId",
        "child_external_id",
        "sub_task_id",
        "subTaskId",
        "task_id",
        "taskId",
        "子任务ID"
      ])
      ?? readStringCandidate(attribute, ["work_item_id", "workItemId", "id"])
      ?? readStringCandidate(workItem, ["work_item_id", "workItemId", "id"])
      ?? "",
    title:
      readStringCandidate(item, ["title", "name", "子任务名称"])
      ?? readStringCandidate(attribute, ["work_item_name", "workItemName", "name", "title"])
      ?? readStringCandidate(workItem, ["work_item_name", "workItemName", "name", "title"])
      ?? "",
    url:
      readStringCandidate(item, ["url", "link"])
      ?? readStringCandidate(attribute, ["url", "link"])
      ?? readStringCandidate(workItem, ["url", "link"])
      ?? null,
    updatedAt:
      readStringCandidate(item, ["updatedAt", "updated_at", "modifiedAt", "modified_at"])
      ?? readStringCandidate(attribute, ["updatedAt", "updated_at", "modifiedAt", "modified_at"])
      ?? readStringCandidate(workItem, ["updatedAt", "updated_at", "modifiedAt", "modified_at"])
      ?? new Date(0).toISOString()
  };
}

function mapChildRepairIssueRecord(
  subTask: { externalId: string; title: string; url: string | null; updatedAt: string },
  detail: Record<string, unknown>,
  configuredDescriptionFieldKey: string | null
): {
  externalId: string;
  title: string;
  url: string | null;
  rawDescription: string;
  updatedAt: string;
  idempotencyKey: string | null;
} {
  const attribute = detail.work_item_attribute;
  const attributeRecord = attribute && typeof attribute === "object"
    ? attribute as Record<string, unknown>
    : {};
  const title =
    subTask.title
    || readStringCandidate(attributeRecord, ["work_item_name", "name", "title"])
    || readStringCandidate(detail, ["name", "title"])
    || "";
  const rawDescription = readChildTaskDescription(detail, configuredDescriptionFieldKey);
  const idempotencyKey = readIdempotencyKeyFromText(`${title}\n${rawDescription}`);
  return {
    externalId: subTask.externalId,
    title,
    url: subTask.url ?? readStringCandidate(detail, ["url", "link"]) ?? null,
    rawDescription,
    updatedAt:
      subTask.updatedAt
      || readStringCandidate(attributeRecord, ["updated_at", "updatedAt", "update_time", "updateTime", "modified_at", "modifiedAt"])
      || readStringCandidate(detail, ["updatedAt", "updated_at"])
      || new Date(0).toISOString(),
    idempotencyKey
  };
}

function readWorkItemAttributeRecord(detail: Record<string, unknown>): Record<string, unknown> {
  const attribute = detail.work_item_attribute;
  return attribute && typeof attribute === "object"
    ? attribute as Record<string, unknown>
    : {};
}

function readWorkItemRecord(detail: Record<string, unknown>): Record<string, unknown> {
  const workItem = detail.work_item;
  return workItem && typeof workItem === "object"
    ? workItem as Record<string, unknown>
    : {};
}

function readChildTaskDescription(
  detail: Record<string, unknown>,
  configuredDescriptionFieldKey: string | null
): string {
  const candidateKeys = [
    configuredDescriptionFieldKey,
    "子任务描述",
    "subTaskDescription",
    "sub_task_description",
    "description"
  ].filter((key): key is string => Boolean(key?.trim()));

  if (Array.isArray(detail.work_item_fields)) {
    for (const field of detail.work_item_fields) {
      if (!field || typeof field !== "object") {
        continue;
      }
      const record = field as Record<string, unknown>;
      const displayName =
        asNonEmptyString(record.name)
        ?? asNonEmptyString(record.field_name)
        ?? asNonEmptyString(record.fieldName)
        ?? "";
      const fieldKey =
        asNonEmptyString(record.key)
        ?? asNonEmptyString(record.field_key)
        ?? asNonEmptyString(record.fieldKey)
        ?? "";
      if (displayName === "子任务描述" || candidateKeys.includes(fieldKey)) {
        const text = collectMeegleFieldStrings(record.value ?? record.field_value).join("\n").trim();
        if (text) {
          return text;
        }
      }
    }
  }

  for (const key of candidateKeys) {
    const text = readMeegleFieldAsString(detail, key);
    if (text?.trim()) {
      return text.trim();
    }
  }
  return readStringCandidate(detail, candidateKeys) ?? "";
}

function pickChildTaskDevelopmentNode(
  value: unknown,
  configuredNodeName: string | null
): {
  nodeId: string;
  nodeName: string;
  subTasks: Array<{ externalId: string; title: string; url: string | null; updatedAt: string }>;
} | null {
  const nodes = extractWorkflowNodes(value);
  const normalizedTarget = configuredNodeName?.trim() ?? "";
  const matched = normalizedTarget
    ? nodes.filter((node) => node.nodeName === normalizedTarget || node.nodeName.includes(normalizedTarget))
    : nodes;

  if (normalizedTarget) {
    const namedNode = matched.find((node) => node.nodeId.trim().length > 0);
    if (namedNode) {
      return namedNode;
    }
  }

  const matchedWithSubTasks = matched.filter((node) => node.subTasks.length > 0 && node.nodeId.trim().length > 0);
  if (matchedWithSubTasks[0]) {
    return matchedWithSubTasks[0];
  }

  const anyWithSubTasks = nodes.filter((node) => node.subTasks.length > 0 && node.nodeId.trim().length > 0);
  if (anyWithSubTasks[0]) {
    return anyWithSubTasks[0];
  }

  const fallback = nodes.find((node) => node.nodeId.trim().length > 0) ?? null;
  if (!fallback?.nodeId.trim()) {
    return null;
  }
  return fallback;
}

function readWorkflowNodeIdentity(item: Record<string, unknown>): { nodeId: string; nodeName: string } {
  const basic = item.basic;
  const basicRecord = basic && typeof basic === "object" ? basic as Record<string, unknown> : null;
  const nodeId =
    readStringCandidate(basicRecord ?? {}, ["node_key", "nodeKey", "node_uuid", "nodeUuid", "template_node_id", "templateNodeId"])
    ?? readStringCandidate(item, ["node_id", "nodeId", "id", "template_node_id", "templateNodeId", "node_key", "nodeKey"])
    ?? "";
  const nodeName =
    readStringCandidate(basicRecord ?? {}, ["name", "node_name", "nodeName", "title"])
    ?? readStringCandidate(item, ["node_name", "nodeName", "name", "title"])
    ?? "";
  return { nodeId, nodeName };
}

function extractWorkflowNodes(value: unknown): Array<{
  nodeId: string;
  nodeName: string;
  subTasks: Array<{ externalId: string; title: string; url: string | null; updatedAt: string }>;
}> {
  const rows = unwrapChildRepairIssueRows(value);
  return rows
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const identity = readWorkflowNodeIdentity(item);
      return {
        nodeId: identity.nodeId,
        nodeName: identity.nodeName,
        subTasks: extractSubTasksFromNode(item)
      };
    })
    .filter((node) => node.nodeId.trim().length > 0 || node.subTasks.length > 0);
}

function extractSubTasksFromNode(node: Record<string, unknown>): Array<{
  externalId: string;
  title: string;
  url: string | null;
  updatedAt: string;
}> {
  const nested = node.sub_tasks ?? node.subTasks ?? node.subtask_list ?? node.subtaskList;
  const rows = Array.isArray(nested) ? nested : [];
  return rows
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      externalId: readStringCandidate(item, [
        "sub_task_id",
        "subTaskId",
        "task_id",
        "taskId",
        "id",
        "externalId",
        "external_id",
        "子任务ID"
      ]) ?? "",
      title: readStringCandidate(item, ["name", "title", "sub_task_name", "subTaskName", "子任务名称"]) ?? "",
      url: readStringCandidate(item, ["url", "link"]) ?? null,
      updatedAt: readStringCandidate(item, ["updated_at", "updatedAt", "modified_at", "modifiedAt"]) ?? new Date(0).toISOString()
    }))
    .filter((item) => item.externalId.trim().length > 0);
}

function unwrapChildRepairIssueRows(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const record = value as Record<string, unknown>;
  const nested = record.children ?? record.items ?? record.data ?? record.list ?? record.records ?? record.nodes ?? record.node_list ?? record.nodeList;
  if (Array.isArray(nested)) {
    return nested;
  }
  if (nested && typeof nested === "object") {
    return unwrapChildRepairIssueRows(nested);
  }
  return [record];
}

function extractChildRepairIssue(value: unknown, idempotencyKey: string | null): ReturnType<typeof extractChildRepairIssues>[number] | null {
  const rows = extractChildRepairIssues(value);
  if (idempotencyKey) {
    return rows.find((row) => row.idempotencyKey === idempotencyKey) ?? null;
  }
  return rows[0] ?? null;
}

function readReadyChildRepairDescription(rawDescription: string): string | null {
  const prefix = "【开发中】";
  if (!rawDescription.startsWith(prefix)) {
    return null;
  }
  return rawDescription.slice(prefix.length).trim();
}

function buildChildRepairReplyId(childExternalId: string, updatedAt: string, rawDescription: string): string {
  const digest = createHash("sha256")
    .update(rawDescription)
    .digest("hex");
  return `${childExternalId}:${updatedAt}:${digest}`;
}

function readIdempotencyKeyFromText(value: string): string | null {
  const match = /idempotency=([^;\s]+)/.exec(value);
  return match?.[1] ?? null;
}

/** Thrown when the meegle binary cannot be found on PATH (spawn ENOENT). */
export class MeegleCliNotFoundError extends Error {
  readonly code = "MEEGLE_CLI_NOT_FOUND";
  constructor(message: string) {
    super(message);
    this.name = "MeegleCliNotFoundError";
  }
}
