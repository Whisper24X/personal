import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  CompletionGateInput,
  CompletionGatePlugin,
  CompletionGateResult,
  PluginHealth
} from "@diting/plugin-api";

const MANUAL_PATTERNS = [
  /manual/i,
  /human/i,
  /需要人工/,
  /等待用户确认/,
  /人工确认/,
  /User Review Gate/i,
  /用户在终端执行/,
  /用户在终端执行\s+openspec\s+validate/i,
  /用户在终端执行\s+openspec\s+archive/i
];

export class DefaultOpenSpecCompletionGatePlugin implements CompletionGatePlugin {
  readonly id = "openspec-completion-gate";
  readonly kind = "completion-gate" as const;
  readonly priority = 100;
  readonly capabilities = ["openspec"];

  async health(): Promise<PluginHealth> {
    return { healthy: true, message: "OpenSpec completion gate enabled" };
  }

  async evaluate(input: CompletionGateInput): Promise<CompletionGateResult> {
    const changeResolution = await resolveOpenSpecChange(input);
    if (changeResolution.changes.length === 0) {
      return buildResult({
        passed: changeResolution.skipped,
        detail: changeResolution.detail,
        incompleteTasks: changeResolution.skipped ? [] : [changeResolution.detail],
        metadata: {
          skipped: changeResolution.skipped,
          reason: changeResolution.reason
        }
      });
    }

    const incompleteTaskPaths = new Set<string>();
    let incompleteTaskCount = 0;
    const tasksPaths: string[] = [];
    for (const change of changeResolution.changes) {
      const tasksPath = join(change.changePath, "tasks.md");
      tasksPaths.push(tasksPath);
      if (!(await pathExists(tasksPath))) {
        incompleteTaskPaths.add(tasksPath);
        incompleteTaskCount += 1;
        continue;
      }
      const tasks = parseTaskCheckboxes(await readFile(tasksPath, "utf8"));
      const incompleteInFile = tasks.filter((task) => !task.checked && !task.manual).length;
      if (incompleteInFile > 0) {
        incompleteTaskPaths.add(tasksPath);
        incompleteTaskCount += incompleteInFile;
      }
    }
    const incompleteTaskReferences = [...incompleteTaskPaths];

    return buildResult({
      passed: incompleteTaskReferences.length === 0,
      detail: incompleteTaskReferences.length === 0
        ? `All autonomous OpenSpec tasks are complete for ${changeResolution.changes.map((change) => change.changeId).join(", ")}`
        : `Incomplete autonomous OpenSpec tasks remain in ${incompleteTaskCount} checkbox item(s); inspect: ${incompleteTaskReferences.join("; ")}`,
      incompleteTasks: incompleteTaskReferences,
      metadata: {
        changeIds: changeResolution.changes.map((change) => change.changeId),
        reason: changeResolution.reason,
        tasksPaths,
        incompleteTaskCount
      }
    });
  }
}

type ResolvedChange = {
  changeId: string;
  changePath: string;
};

type ChangeResolution = {
  changes: ResolvedChange[];
  detail: string;
  reason: string;
  skipped: boolean;
};

async function resolveOpenSpecChange(input: CompletionGateInput): Promise<ChangeResolution> {
  const changesRoot = join(input.workspace.repoPath, "openspec", "changes");
  if (!(await pathExists(changesRoot))) {
    return {
      changes: [],
      detail: "No OpenSpec changes directory found; completion gate skipped",
      reason: "no-openspec",
      skipped: true
    };
  }

  const metadataChangeId = readOpenSpecChangeId(input.task.metadata);
  if (metadataChangeId) {
    const changePath = join(changesRoot, metadataChangeId);
    if (await pathExists(changePath)) {
      return {
        changes: [{ changeId: metadataChangeId, changePath }],
        detail: `Resolved OpenSpec change from task metadata: ${metadataChangeId}`,
        reason: "metadata",
        skipped: false
      };
    }
    return {
      changes: [],
      detail: `OpenSpec change from task metadata does not exist: ${metadataChangeId}`,
      reason: "missing-metadata-change",
      skipped: false
    };
  }

  const artifactChangeId = await readArtifactOpenSpecChangeId(input.workspace.artifactsPath);
  if (artifactChangeId) {
    const changePath = join(changesRoot, artifactChangeId);
    if (await pathExists(changePath)) {
      return {
        changes: [{ changeId: artifactChangeId, changePath }],
        detail: `Resolved OpenSpec change from workspace artifact: ${artifactChangeId}`,
        reason: "artifact",
        skipped: false
      };
    }
    return {
      changes: [],
      detail: `OpenSpec change from workspace artifact does not exist: ${artifactChangeId}`,
      reason: "missing-artifact-change",
      skipped: false
    };
  }

  const changeIds = await listChangeIds(changesRoot);
  if (changeIds.length === 0) {
    return {
      changes: [],
      detail: "No active OpenSpec changes found; completion gate skipped",
      reason: "no-active-change",
      skipped: true
    };
  }
  if (changeIds.length === 1) {
    const [changeId] = changeIds;
    return {
      changes: [{ changeId, changePath: join(changesRoot, changeId) }],
      detail: `Resolved single OpenSpec change: ${changeId}`,
      reason: "single-change",
      skipped: false
    };
  }

  return {
    changes: changeIds.map((changeId) => ({ changeId, changePath: join(changesRoot, changeId) })),
    detail: `Resolved all active OpenSpec changes: ${changeIds.join(", ")}`,
    reason: "all-active-changes",
    skipped: false
  };
}

function readOpenSpecChangeId(metadata: Record<string, unknown>): string | null {
  const value = metadata.openspecChangeId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function readArtifactOpenSpecChangeId(artifactsPath: string): Promise<string | null> {
  for (const fileName of ["active-openspec-change.json", "openspec-change.json"]) {
    const path = join(artifactsPath, fileName);
    if (!(await pathExists(path))) {
      continue;
    }
    try {
      const parsed = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
      const value = parsed.openspecChangeId ?? parsed.changeId;
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    } catch {
      return null;
    }
  }
  return null;
}

async function listChangeIds(changesRoot: string): Promise<string[]> {
  const entries = await readdir(changesRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== "archive")
    .sort();
}

function parseTaskCheckboxes(content: string): Array<{ checked: boolean; text: string; manual: boolean }> {
  const tasks: Array<{ checked: boolean; text: string; manual: boolean }> = [];
  const stack: Array<{ indent: number; manual: boolean }> = [];

  for (const line of content.split("\n")) {
    const match = line.match(/^(\s*)[-*]\s+\[( |x|X)\]\s+(.+?)\s*$/);
    if (!match) {
      continue;
    }
    const indent = match[1]?.length ?? 0;
    while (stack.length > 0 && indent <= stack[stack.length - 1]!.indent) {
      stack.pop();
    }
    const text = match[3]?.trim() ?? "";
    const inheritedManual = stack.some((item) => item.manual);
    const manual = inheritedManual || isManualTask(text);
    tasks.push({
      checked: match[2]?.toLowerCase() === "x",
      text,
      manual
    });
    stack.push({ indent, manual });
  }

  return tasks;
}

function isManualTask(text: string): boolean {
  return MANUAL_PATTERNS.some((pattern) => pattern.test(text));
}

function buildResult(input: {
  passed: boolean;
  detail: string;
  incompleteTasks: string[];
  metadata: Record<string, unknown>;
}): CompletionGateResult {
  return {
    passed: input.passed,
    checks: [{
      name: "openspec-autonomous-tasks",
      passed: input.passed,
      detail: input.detail
    }],
    incompleteTasks: input.incompleteTasks,
    repairObjective: input.incompleteTasks.length > 0
      ? `Complete OpenSpec autonomous tasks: ${input.incompleteTasks.join("; ")}`
      : null,
    repairDoneWhen: input.incompleteTasks,
    metadata: input.metadata
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
