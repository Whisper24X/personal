import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { TitingTask } from "@diting/plugin-api";
import { ServerConfig } from "../config";
import {
  buildMeegleCliArgs,
  EnvironmentPreparationError,
  extractFeishuFileTokenFromDownloadUrl,
  isFeishuHostUrl,
  isFeishuProjectDownloadUrl,
  pathExists,
  readTaskSpecAttachments,
  runCheckedCommand,
  runCommand,
  SpecAttachmentRef
} from "./shared";

export type MaterializedSpecDocument = {
  originalName: string;
  localPath: string;
  renamed: boolean;
  source: string;
};

export type MaterializeSpecResult = {
  documents: MaterializedSpecDocument[];
  workflowPromptsPath?: string;
};

export type SpecDownloadContext = {
  workItemId?: string | null;
};

export type MaterializeSpecOptions = {
  requireOpenSpecDirectory?: boolean;
};

export type SpecPackageInspection = {
  state: "valid" | "missing_openspec" | "unknown";
  checkedAt: string;
  attachments: string[];
  reason?: string;
  detail?: string | null;
};

const ALLOWED_EXTENSIONS = new Set([".md", ".zip", ".tar.gz", ".tgz", ".json", ".yaml", ".yml", ".txt"]);

export async function materializeSpecDocuments(
  task: TitingTask,
  workspacePath: string,
  config: ServerConfig,
  options: MaterializeSpecOptions = {}
): Promise<MaterializeSpecResult> {
  const attachments = readTaskSpecAttachments(task);
  if (attachments.length === 0) {
    throw new EnvironmentPreparationError("spec", "No spec attachments found on task", null, false);
  }

  await mkdir(workspacePath, { recursive: true });
  const documents: MaterializedSpecDocument[] = [];
  let workflowPromptsPath: string | undefined;
  let extractedArchive = false;

  for (const attachment of attachments) {
    const buffer = await downloadSpecAttachment(attachment, config, { workItemId: task.externalId });
    const originalName = attachment.name || "spec";
    const ext = resolveExtension(originalName);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new EnvironmentPreparationError("spec", `Unsupported spec file type: ${ext}`, originalName, false);
    }
    if (buffer.length > config.workspace.specMaxBytes) {
      throw new EnvironmentPreparationError(
        "spec",
        `Spec file exceeds max size ${config.workspace.specMaxBytes}`,
        originalName,
        false
      );
    }

    if (ext === ".zip" || ext === ".tar.gz" || ext === ".tgz") {
      extractedArchive = true;
      const archivePath = await writeUniqueFile(workspacePath, originalName, buffer);
      await extractArchive(archivePath, workspacePath, config);
      await rm(archivePath, { force: true });
      const workflowCandidate = await findWorkflowPromptsPath(workspacePath);
      if (workflowCandidate) {
        workflowPromptsPath = workflowCandidate;
      }
      continue;
    }

    const targetPath = await writeUniqueFile(workspacePath, originalName, buffer);
    documents.push({
      originalName,
      localPath: targetPath,
      renamed: basename(targetPath) !== originalName,
      source: attachment.localPath ? "local" : "meegle"
    });
    if (basename(targetPath).toLowerCase().includes("workflow_prompts") || basename(targetPath) === "WORKFLOW_PROMPTS.md") {
      workflowPromptsPath = targetPath;
    }
  }

  if (extractedArchive && options.requireOpenSpecDirectory !== false) {
    await assertOpenSpecDirectory(workspacePath);
  }
  workflowPromptsPath ??= await findWorkflowPromptsPath(workspacePath);
  return { documents, workflowPromptsPath };
}

export async function inspectSpecPackageAttachments(
  task: TitingTask,
  config: ServerConfig
): Promise<SpecPackageInspection | null> {
  const archiveAttachments = readTaskSpecAttachments(task).filter((attachment) => isSpecArchiveAttachmentName(attachment.name));
  if (archiveAttachments.length === 0) {
    return null;
  }

  await mkdir(config.workspace.root, { recursive: true });
  const workspacePath = await mkdtemp(join(config.workspace.root, ".spec-inspect-"));
  const checkedAt = new Date().toISOString();
  const attachmentNames = archiveAttachments.map((attachment) => attachment.name || "spec");
  try {
    await materializeSpecDocuments(task, workspacePath, config, { requireOpenSpecDirectory: true });
    return {
      state: "valid",
      checkedAt,
      attachments: attachmentNames
    };
  } catch (error) {
    if (isMissingOpenSpecError(error)) {
      return {
        state: "missing_openspec",
        checkedAt,
        attachments: attachmentNames,
        reason: error.message,
        detail: error.detail
      };
    }
    return {
      state: "unknown",
      checkedAt,
      attachments: attachmentNames,
      reason: error instanceof Error ? error.message : String(error),
      detail: error instanceof EnvironmentPreparationError ? error.detail : null
    };
  } finally {
    await rm(workspacePath, { recursive: true, force: true });
  }
}

async function downloadSpecAttachment(
  attachment: SpecAttachmentRef,
  config: ServerConfig,
  context: SpecDownloadContext = {}
): Promise<Buffer> {
  if (attachment.localPath && await pathExists(attachment.localPath)) {
    return readFile(attachment.localPath);
  }

  const fileToken =
    attachment.token?.trim()
    || (attachment.url ? extractFeishuFileTokenFromDownloadUrl(attachment.url) : undefined);
  const cliBin = config.plugins.meegle.cliBin?.trim() || "meegle";

  if (attachment.url && isFeishuProjectDownloadUrl(attachment.url)) {
    const viaCli = await downloadSpecViaMeegleAttachmentCli(attachment.url, cliBin, config, context);
    if (viaCli) {
      return viaCli;
    }
  }

  if (fileToken) {
    const viaCli = await downloadSpecViaLegacyMeegleFileCli(fileToken, cliBin, config);
    if (viaCli) {
      return viaCli;
    }
  }

  if (attachment.url) {
    if (isFeishuProjectDownloadUrl(attachment.url) || isFeishuHostUrl(attachment.url)) {
      throw new EnvironmentPreparationError(
        "spec",
        "Feishu spec file requires authenticated Meegle CLI (run `meegle auth login`, set MEEGLE_AUTH_PROFILE if needed). Server-side fetch cannot use browser session cookies.",
        attachment.url,
        true
      );
    }
    const response = await fetch(attachment.url);
    if (!response.ok) {
      throw new EnvironmentPreparationError("spec", `Failed to download spec: HTTP ${response.status}`, attachment.url, true);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  throw new EnvironmentPreparationError(
    "spec",
    `Unable to download spec attachment ${attachment.name}`,
    attachment.token ?? attachment.url ?? "",
    false
  );
}

async function downloadSpecViaMeegleAttachmentCli(
  url: string,
  cliBin: string,
  config: ServerConfig,
  context: SpecDownloadContext
): Promise<Buffer | null> {
  const workItemId = context.workItemId?.trim();
  if (!workItemId) {
    return null;
  }
  const tmpPath = join(config.workspace.root, `.spec-download-${Date.now()}`);
  await mkdir(dirname(tmpPath), { recursive: true });
  const args = buildMeegleCliArgs(config.plugins.meegle, [
    "attachment",
    "+download",
    url,
    "--output",
    tmpPath,
    "--overwrite",
    ...(config.plugins.meegle.projectKey?.trim()
      ? ["--project-key", config.plugins.meegle.projectKey.trim()]
      : []),
    "--work-item-id",
    workItemId
  ]);
  const result = await runCommand(
    cliBin,
    args,
    config.workspace.root,
    config.goalRecovery.executionTimeoutMs
  );
  if (result.exitCode === 0 && await pathExists(tmpPath)) {
    const buffer = await readFile(tmpPath);
    await rm(tmpPath, { force: true });
    return buffer;
  }
  await rm(tmpPath, { force: true });
  return null;
}

async function downloadSpecViaLegacyMeegleFileCli(
  fileToken: string,
  cliBin: string,
  config: ServerConfig
): Promise<Buffer | null> {
  const tmpPath = join(config.workspace.root, `.spec-download-${Date.now()}`);
  await mkdir(dirname(tmpPath), { recursive: true });
  const args = buildMeegleCliArgs(config.plugins.meegle, [
    "file",
    "download",
    "--token",
    fileToken,
    "-o",
    tmpPath
  ]);
  const result = await runCommand(
    cliBin,
    args,
    config.workspace.root,
    config.goalRecovery.executionTimeoutMs
  );
  if (result.exitCode === 0 && await pathExists(tmpPath)) {
    const buffer = await readFile(tmpPath);
    await rm(tmpPath, { force: true });
    return buffer;
  }
  await rm(tmpPath, { force: true });
  return null;
}

async function writeUniqueFile(root: string, originalName: string, buffer: Buffer): Promise<string> {
  let candidate = join(root, basename(originalName));
  let index = 2;
  const ext = extname(originalName);
  const base = basename(originalName, ext);
  while (await pathExists(candidate)) {
    candidate = join(root, `${base}-${index}${ext}`);
    index += 1;
  }
  await writeFile(candidate, buffer);
  return candidate;
}

async function extractArchive(archivePath: string, targetRoot: string, config: ServerConfig): Promise<void> {
  const lower = archivePath.toLowerCase();
  if (lower.endsWith(".zip")) {
    await runCheckedCommand(
      "unzip",
      ["-o", archivePath, "-d", targetRoot],
      targetRoot,
      process.env,
      config.goalRecovery.executionTimeoutMs,
      "spec-unzip"
    );
    await removeMacOsMetadataDirectories(targetRoot);
    return;
  }
  await runCheckedCommand(
    "tar",
    ["-xzf", archivePath, "-C", targetRoot],
    targetRoot,
    process.env,
    config.goalRecovery.executionTimeoutMs,
    "spec-tar"
  );
  await removeMacOsMetadataDirectories(targetRoot);
}

async function findWorkflowPromptsPath(workspacePath: string): Promise<string | undefined> {
  const candidates = [
    join(workspacePath, "WORKFLOW_PROMPTS.md"),
    join(workspacePath, "knowledge", "WORKFLOW_PROMPTS.md")
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function resolveExtension(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".tar.gz")) {
    return ".tar.gz";
  }
  return extname(lower);
}

function isSpecArchiveAttachmentName(name: string): boolean {
  const ext = resolveExtension(name);
  return ext === ".zip" || ext === ".tar.gz" || ext === ".tgz";
}

function isMissingOpenSpecError(error: unknown): error is EnvironmentPreparationError {
  return (
    error instanceof EnvironmentPreparationError
    && error.stage === "spec"
    && error.message.includes("Spec package must include openspec/")
  );
}

export async function downloadSpecToDirectory(
  attachments: SpecAttachmentRef[],
  targetDir: string,
  config: ServerConfig,
  context: SpecDownloadContext = {}
): Promise<string | undefined> {
  await mkdir(targetDir, { recursive: true });
  let workflowPromptsPath: string | undefined;
  let extractedArchive = false;
  for (const attachment of attachments) {
    const buffer = await downloadSpecAttachment(attachment, config, context);
    const name = attachment.name || "spec";
    const ext = resolveExtension(name);
    if (ext === ".zip" || ext === ".tar.gz" || ext === ".tgz") {
      extractedArchive = true;
      const archivePath = join(targetDir, basename(name));
      await writeFile(archivePath, buffer);
      await extractArchive(archivePath, targetDir, config);
      await rm(archivePath, { force: true });
    } else {
      const path = join(targetDir, basename(name));
      await writeFile(path, buffer);
      if (basename(path) === "WORKFLOW_PROMPTS.md") {
        workflowPromptsPath = path;
      }
    }
  }
  if (extractedArchive) {
    await assertOpenSpecDirectory(targetDir);
  }
  return workflowPromptsPath ?? findWorkflowPromptsPath(targetDir);
}

async function assertOpenSpecDirectory(root: string): Promise<void> {
  const path = join(root, "openspec");
  try {
    const stats = await stat(path);
    if (stats.isDirectory()) {
      return;
    }
  } catch {
    // Fall through to the normalized preparation error below.
  }
  throw new EnvironmentPreparationError(
    "spec",
    "Spec package must include openspec/",
    path,
    false
  );
}

async function removeMacOsMetadataDirectories(root: string): Promise<void> {
  let entries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const path = join(root, entry.name);
    if (entry.name === "__MACOSX") {
      await rm(path, { recursive: true, force: true });
      continue;
    }
    await removeMacOsMetadataDirectories(path);
  }
}
