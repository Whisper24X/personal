import { PreparedWorkspace } from "@diting/plugin-api";

export const QUALITY_HANDOFF_SCHEMA_VERSION = "2026-07-03";

export type QualityRepoRef = {
  key: string;
  url: string;
  path: string;
  baseSha: string;
  headSha: string;
};

export type ImplementationHandoff = {
  schemaVersion: typeof QUALITY_HANDOFF_SCHEMA_VERSION;
  workspaceId: string;
  openspecChangeId: string;
  openspecRevision: string;
  openspecPath: string;
  sourceProgrammingTaskId: string;
  baseSha: string;
  headSha: string;
  summary: string;
  repos: QualityRepoRef[];
  changedFiles: string[];
  artifactPaths: Record<string, string>;
};

export type QualityRepairHandoff = {
  schemaVersion: typeof QUALITY_HANDOFF_SCHEMA_VERSION;
  sourceQualityTaskId: string;
  targetProgrammingTaskId: string;
  qualityReportPath: string;
  failedChecks: string[];
  repairObjective: string;
  repairDoneWhen: string[];
  artifactPaths: Record<string, string>;
};

export type HandoffAnchorValidationResult = {
  passed: boolean;
  reasons: string[];
};

export function buildImplementationHandoff(
  input: Omit<ImplementationHandoff, "schemaVersion">
): ImplementationHandoff {
  return parseImplementationHandoff({
    schemaVersion: QUALITY_HANDOFF_SCHEMA_VERSION,
    ...input
  });
}

export function parseImplementationHandoff(value: unknown): ImplementationHandoff {
  const record = expectRecord(value, "implementationHandoff");
  expectLiteral(record.schemaVersion, QUALITY_HANDOFF_SCHEMA_VERSION, "schemaVersion");
  const repos = expectArray(record.repos, "repos").map((repo, index) => parseRepo(repo, `repos[${index}]`));
  return {
    schemaVersion: QUALITY_HANDOFF_SCHEMA_VERSION,
    workspaceId: expectString(record.workspaceId, "workspaceId"),
    openspecChangeId: expectString(record.openspecChangeId, "openspecChangeId"),
    openspecRevision: expectString(record.openspecRevision, "openspecRevision"),
    openspecPath: expectString(record.openspecPath, "openspecPath"),
    sourceProgrammingTaskId: expectString(record.sourceProgrammingTaskId, "sourceProgrammingTaskId"),
    baseSha: expectString(record.baseSha, "baseSha"),
    headSha: expectString(record.headSha, "headSha"),
    summary: expectString(record.summary, "summary"),
    repos,
    changedFiles: expectStringArray(record.changedFiles, "changedFiles"),
    artifactPaths: expectStringRecord(record.artifactPaths, "artifactPaths")
  };
}

export function buildQualityRepairHandoff(
  input: Omit<QualityRepairHandoff, "schemaVersion">
): QualityRepairHandoff {
  return {
    schemaVersion: QUALITY_HANDOFF_SCHEMA_VERSION,
    sourceQualityTaskId: expectString(input.sourceQualityTaskId, "sourceQualityTaskId"),
    targetProgrammingTaskId: expectString(input.targetProgrammingTaskId, "targetProgrammingTaskId"),
    qualityReportPath: expectString(input.qualityReportPath, "qualityReportPath"),
    failedChecks: expectStringArray(input.failedChecks, "failedChecks"),
    repairObjective: expectString(input.repairObjective, "repairObjective"),
    repairDoneWhen: expectStringArray(input.repairDoneWhen, "repairDoneWhen"),
    artifactPaths: expectStringRecord(input.artifactPaths, "artifactPaths")
  };
}

export function validateHandoffAnchors(
  handoff: ImplementationHandoff,
  workspace: PreparedWorkspace
): HandoffAnchorValidationResult {
  const reasons: string[] = [];
  if (handoff.repos.length === 0) {
    reasons.push("repos is empty");
  }
  const workspaceRepos = new Map(workspace.repos.map((repo) => [repo.key, repo]));

  for (const repo of handoff.repos) {
    const workspaceRepo = workspaceRepos.get(repo.key);
    if (!workspaceRepo) {
      reasons.push(`repo ${repo.key} is missing from workspace`);
      continue;
    }
    if (workspaceRepo.url !== repo.url) {
      reasons.push(`repo ${repo.key} url mismatch`);
    }
    if (!workspaceRepo.commit) {
      reasons.push(`repo ${repo.key} workspace commit is missing`);
    }
    if (repo.baseSha !== handoff.baseSha) {
      reasons.push(`repo ${repo.key} baseSha mismatch`);
    }
    if (workspaceRepo.commit !== repo.headSha) {
      reasons.push(`repo ${repo.key} headSha mismatch`);
    }
  }

  return {
    passed: reasons.length === 0,
    reasons
  };
}

function parseRepo(value: unknown, path: string): QualityRepoRef {
  const record = expectRecord(value, path);
  return {
    key: expectString(record.key, `${path}.key`),
    url: expectString(record.url, `${path}.url`),
    path: expectString(record.path, `${path}.path`),
    baseSha: expectString(record.baseSha, `${path}.baseSha`),
    headSha: expectString(record.headSha, `${path}.headSha`)
  };
}

function expectLiteral(value: unknown, expected: string, path: string): void {
  if (value !== expected) {
    throw new Error(`${path} must be ${expected}`);
  }
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }
  return value;
}

function expectString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function expectStringArray(value: unknown, path: string): string[] {
  return expectArray(value, path).map((item, index) => expectString(item, `${path}[${index}]`));
}

function expectStringRecord(value: unknown, path: string): Record<string, string> {
  const record = expectRecord(value, path);
  for (const [key, item] of Object.entries(record)) {
    expectString(item, `${path}.${key}`);
  }
  return record as Record<string, string>;
}
