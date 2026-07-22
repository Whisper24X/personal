import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TaskPreflightCheck, TaskPreflightResult, TitingTask } from "@diting/plugin-api";
import { ServerConfig } from "../config";
import { DependencyCheckResult } from "../dependency-checks";
import { downloadSpecToDirectory } from "./spec-documents";
import {
  extractSpecAttachmentsFromRow,
  isAllowedSpecFileName,
  parseMultiRepoDescriptionBlock,
  readTaskRepos,
  readTaskSpecAttachments,
  SpecAttachmentRef
} from "./shared";
import { validateWorkflowContent } from "./workflow";

type DependencyCheckLister = {
  list(query: { requiredFor?: string }): Promise<{
    checks: DependencyCheckResult[];
  }>;
};

export async function runTaskPreflight(
  task: TitingTask,
  config: ServerConfig,
  dependencyChecks?: DependencyCheckLister
): Promise<TaskPreflightResult> {
  const checks: TaskPreflightCheck[] = [];

  const repos = readTaskRepos(task);
  checks.push({
    name: "repos",
    passed: repos.length > 0 && repos.every((repo) => Boolean(repo.url.trim())),
    detail: repos.length > 0 ? `${repos.length} repository URL(s) parsed` : "No repositories found"
  });

  checks.push({
    name: "instruction",
    passed: Boolean(task.instruction.trim()),
    detail: task.instruction.trim() ? "Instruction present" : "Instruction is empty"
  });

  const attachments = resolveTaskSpecAttachments(task);
  const productTask = isProductOpenSpecTask(task);
  const productHandoff = isProgrammingFromProduct(task);
  if (productTask) {
    checks.push({
      name: "openspec-source",
      passed: true,
      detail: attachments.length > 0
        ? "Legacy OpenSpec attachment will be imported"
        : "No spec attachment provided; product agent will generate OpenSpec in workspace"
    });
  }
  if (productHandoff) {
    const approved = hasApprovedOpenSpecHandoff(task);
    checks.push({
      name: "approved-openspec",
      passed: approved,
      detail: approved
        ? "Approved OpenSpec handoff metadata present"
        : "Programming handoff requires approved OpenSpec metadata"
    });
  }
  checks.push({
    name: "spec-attachments",
    passed: attachments.length > 0 || productTask || productHandoff,
    detail: attachments.length > 0
      ? `${attachments.length} spec attachment(s)`
      : productTask
        ? "No spec attachment; product agent generation path"
        : productHandoff
          ? "No spec attachment; approved product handoff path"
          : "spec文档 is empty"
  });

  const invalidNames = attachments
    .filter((item) => !isAllowedSpecFileName(item.name))
    .map((item) => item.name);
  const extensionCheck = invalidNames.length === 0;
  checks.push({
    name: "spec-extension",
    passed: extensionCheck,
    detail: extensionCheck
      ? "All spec files use allowed extensions"
      : `Unsupported spec file extension: ${invalidNames.join(", ")}`
  });

  if (config.workspace.preflightDeep && attachments.length > 0 && checks.every((item) => item.passed)) {
    const deepCheck = await runDeepPreflight(task, attachments, config);
    checks.push(deepCheck);
  } else if (attachments.length > 0) {
    checks.push({
      name: "workflow-prompts",
      passed: true,
      detail: "Skipped deep WORKFLOW_PROMPTS validation (light preflight)"
    });
  }
  checks.push(...await runDependencyPreflight(task, dependencyChecks));

  const passed = checks.every((check) => check.passed);
  return {
    passed,
    checks,
    error: passed ? undefined : checks.filter((check) => !check.passed).map((check) => check.detail).join("; ")
  };
}

async function runDependencyPreflight(task: TitingTask, dependencyChecks?: DependencyCheckLister): Promise<TaskPreflightCheck[]> {
  if (!dependencyChecks) {
    return [];
  }
  const requirements = inferDependencyRequirements(task);
  if (requirements.length === 0) {
    return [];
  }
  const results = await Promise.all(requirements.map((requiredFor) => dependencyChecks.list({ requiredFor })));
  const checksById = new Map<string, DependencyCheckResult>();
  for (const result of results) {
    for (const check of result.checks) {
      checksById.set(check.id, check);
    }
  }
  const checks = [...checksById.values()];
  const groupedChecks: TaskPreflightCheck[] = [];
  const groupedIds = new Set<string>();
  const codingRuntimeChecks = checks.filter((check) => (
    check.category === "coding-agent" && check.requiredFor.includes("programming")
  ));
  if (requirements.includes("programming") && codingRuntimeChecks.length > 1) {
    const readyChecks = codingRuntimeChecks.filter((check) => check.status === "ready");
    const passed = readyChecks.length > 0;
    groupedChecks.push({
      name: "dependency:coding-runtime",
      passed,
      detail: passed
        ? `Coding runtime available: ${readyChecks.map((check) => check.label).join(", ")}`
        : `Coding runtime unavailable: ${codingRuntimeChecks.map((check) => `${check.label}: ${check.status}`).join(", ")}`
    });
    for (const check of codingRuntimeChecks) {
      groupedIds.add(check.id);
    }
  }
  return [
    ...groupedChecks,
    ...checks.filter((check) => !groupedIds.has(check.id)).map((check) => ({
    name: `dependency:${check.id}`,
    passed: check.status === "ready",
    detail: `${check.label}: ${check.status}`
    }))
  ];
}

function inferDependencyRequirements(task: TitingTask): string[] {
  const metadataRequirements = task.metadata.dependencyRequirements;
  if (Array.isArray(metadataRequirements)) {
    return metadataRequirements.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (task.executor === "programming" || task.agentKind === "programming") {
    return ["programming"];
  }
  return [];
}

function isProductOpenSpecTask(task: TitingTask): boolean {
  return task.agentKind === "product" || task.executor === "product" || task.driverId === "openspec-product";
}

function isProgrammingFromProduct(task: TitingTask): boolean {
  return typeof task.metadata.sourceProductTaskId === "string"
    || task.metadata.workflowRole === "programming_from_product";
}

function hasApprovedOpenSpecHandoff(task: TitingTask): boolean {
  return Boolean(
    typeof task.metadata.sourceProductTaskId === "string"
    && typeof task.metadata.workspaceId === "string"
    && typeof task.metadata.openspecChangeId === "string"
    && task.metadata.approvedOpenSpec === true
  );
}

function resolveTaskSpecAttachments(task: TitingTask): SpecAttachmentRef[] {
  const metadata = task.metadata;
  const meegleFields =
    typeof metadata.meegleFields === "object" && metadata.meegleFields !== null
      ? metadata.meegleFields as Record<string, unknown>
      : undefined;
  const reparsed = extractSpecAttachmentsFromRow({
    metadata,
    description: task.instruction,
    instruction: task.instruction,
    ...(meegleFields ? { fields: meegleFields } : {}),
    ...(Array.isArray(metadata.meegleWorkItemFields)
      ? { work_item_fields: metadata.meegleWorkItemFields }
      : {})
  });
  if (reparsed.length > 0) {
    return reparsed;
  }
  return readTaskSpecAttachments(task);
}

async function runDeepPreflight(
  task: TitingTask,
  attachments: SpecAttachmentRef[],
  config: ServerConfig
): Promise<TaskPreflightCheck> {
  const tempDir = await mkdtemp(join(tmpdir(), "diting-preflight-"));
  try {
    const workflowPath = await downloadSpecToDirectory(attachments, tempDir, config, { workItemId: task.externalId });
    if (!workflowPath) {
      return {
        name: "workflow-prompts",
        passed: true,
        detail: "WORKFLOW_PROMPTS not provided; default Superpowers workflow will be used"
      };
    }
    await validateWorkflowContent(workflowPath);
    return {
      name: "workflow-prompts",
      passed: true,
      detail: `WORKFLOW_PROMPTS validated at ${workflowPath}`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      name: "workflow-prompts",
      passed: false,
      detail: message
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function validateDescriptionFormat(description: string): void {
  parseMultiRepoDescriptionBlock(description);
}
