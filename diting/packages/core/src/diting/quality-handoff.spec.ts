import { PreparedWorkspace } from "@diting/plugin-api";
import {
  buildImplementationHandoff,
  buildQualityRepairHandoff,
  parseImplementationHandoff,
  QUALITY_HANDOFF_SCHEMA_VERSION,
  validateHandoffAnchors
} from "./quality-handoff";

describe("quality handoff", () => {
  const workspace = createWorkspace();

  it("builds and parses implementation handoff with required fields and repo anchors", () => {
    const handoff = buildImplementationHandoff({
      workspaceId: workspace.workspacePath,
      openspecChangeId: "add-quality-agent",
      openspecRevision: "rev-1",
      openspecPath: "/tmp/task/openspec/changes/add-quality-agent",
      sourceProgrammingTaskId: "task-programming",
      baseSha: "base-123",
      headSha: "head-456",
      summary: "implementation finished",
      repos: [{
        key: "Repo1",
        url: "https://example.com/repo.git",
        path: "/tmp/task/repo",
        baseSha: "base-123",
        headSha: "head-456"
      }],
      changedFiles: ["packages/core/src/diting/service-execution.ts"],
      artifactPaths: { execution: "/tmp/task/artifacts/execution.json" }
    });

    expect(handoff.schemaVersion).toBe(QUALITY_HANDOFF_SCHEMA_VERSION);
    expect(parseImplementationHandoff(handoff)).toEqual(handoff);
  });

  it("rejects implementation handoff without top-level baseSha", () => {
    const invalid = buildRawImplementationHandoff();
    delete invalid.baseSha;

    expect(() => parseImplementationHandoff(invalid)).toThrow("baseSha");
  });

  it("requires each repo anchor to include key, url, path, baseSha and headSha", () => {
    const invalid = buildRawImplementationHandoff();
    delete (invalid.repos as Array<Record<string, unknown>>)[0].headSha;

    expect(() => parseImplementationHandoff(invalid)).toThrow("repos[0].headSha");
  });

  it("validates handoff anchors against prepared workspace repos", () => {
    const handoff = parseImplementationHandoff(buildRawImplementationHandoff());

    expect(validateHandoffAnchors(handoff, workspace)).toEqual({
      passed: true,
      reasons: []
    });
  });

  it("validates multi-repo handoff across programming and quality workspace paths", () => {
    const handoff = parseImplementationHandoff({
      ...buildRawImplementationHandoff(),
      headSha: "repo1-head",
      repos: [
        {
          ...buildRawRepo(),
          key: "Repo1",
          url: "https://example.com/repo-1.git",
          path: "/tmp/task-programming/repo-1",
          headSha: "repo1-head"
        },
        {
          ...buildRawRepo(),
          key: "Repo2",
          url: "https://example.com/repo-2.git",
          path: "/tmp/task-programming/repo-2",
          headSha: "repo2-head"
        },
        {
          ...buildRawRepo(),
          key: "Repo3",
          url: "https://example.com/repo-3.git",
          path: "/tmp/task-programming/repo-3",
          headSha: "repo3-head"
        }
      ]
    });
    const qualityWorkspace = {
      ...workspace,
      workspacePath: "/tmp/task-quality",
      repos: [
        {
          ...workspace.repos[0],
          key: "Repo1",
          url: "https://example.com/repo-1.git",
          path: "/tmp/task-quality/repo-1",
          commit: "repo1-head"
        },
        {
          ...workspace.repos[0],
          key: "Repo2",
          url: "https://example.com/repo-2.git",
          path: "/tmp/task-quality/repo-2",
          commit: "repo2-head"
        },
        {
          ...workspace.repos[0],
          key: "Repo3",
          url: "https://example.com/repo-3.git",
          path: "/tmp/task-quality/repo-3",
          commit: "repo3-head"
        }
      ]
    } satisfies PreparedWorkspace;

    expect(validateHandoffAnchors(handoff, qualityWorkspace)).toEqual({
      passed: true,
      reasons: []
    });
  });

  it.each([
    ["empty repos", { repos: [] }, "repos is empty"],
    ["missing repo", { repos: [{ ...buildRawRepo(), key: "Missing" }] }, "Missing"],
    ["url mismatch", { repos: [{ ...buildRawRepo(), url: "https://example.com/other.git" }] }, "url"],
    ["base mismatch", { repos: [{ ...buildRawRepo(), baseSha: "other-base" }] }, "baseSha"],
    ["head mismatch", { repos: [{ ...buildRawRepo(), headSha: "other-head" }] }, "headSha"]
  ])("fails closed for %s", (_name, override, reasonPart) => {
    const handoff = parseImplementationHandoff({
      ...buildRawImplementationHandoff(),
      ...override
    });

    const result = validateHandoffAnchors(handoff, workspace);

    expect(result.passed).toBe(false);
    expect(result.reasons.join("\n")).toContain(reasonPart);
  });

  it("fails closed when workspace repo commit is missing", () => {
    const handoff = parseImplementationHandoff(buildRawImplementationHandoff());
    const missingCommitWorkspace = {
      ...workspace,
      repos: [{ ...workspace.repos[0], commit: undefined }]
    } satisfies PreparedWorkspace;

    const result = validateHandoffAnchors(handoff, missingCommitWorkspace);

    expect(result.passed).toBe(false);
    expect(result.reasons.join("\n")).toContain("commit");
  });

  it("builds a quality repair handoff linked to the quality report", () => {
    const repairHandoff = buildQualityRepairHandoff({
      sourceQualityTaskId: "task-quality",
      targetProgrammingTaskId: "task-programming",
      qualityReportPath: "/tmp/task/artifacts/quality-report.json",
      failedChecks: ["quality.score"],
      repairObjective: "Fix quality failures",
      repairDoneWhen: ["quality gate passes"],
      artifactPaths: {
        qualityReport: "/tmp/task/artifacts/quality-report.json",
        codeReviewReport: "/tmp/task/artifacts/code-review-report.json"
      }
    });

    expect(repairHandoff).toEqual(expect.objectContaining({
      schemaVersion: QUALITY_HANDOFF_SCHEMA_VERSION,
      sourceQualityTaskId: "task-quality",
      targetProgrammingTaskId: "task-programming",
      qualityReportPath: "/tmp/task/artifacts/quality-report.json"
    }));
  });
});

function buildRawRepo(): Record<string, unknown> {
  return {
    key: "Repo1",
    url: "https://example.com/repo.git",
    path: "/tmp/task/repo",
    baseSha: "base-123",
    headSha: "head-456"
  };
}

function buildRawImplementationHandoff(): Record<string, unknown> {
  return {
    schemaVersion: QUALITY_HANDOFF_SCHEMA_VERSION,
    workspaceId: "/tmp/task",
    openspecChangeId: "add-quality-agent",
    openspecRevision: "rev-1",
    openspecPath: "/tmp/task/openspec/changes/add-quality-agent",
    sourceProgrammingTaskId: "task-programming",
    baseSha: "base-123",
    headSha: "head-456",
    summary: "implementation finished",
    repos: [buildRawRepo()],
    changedFiles: ["packages/core/src/diting/service-execution.ts"],
    artifactPaths: {}
  };
}

function createWorkspace(): PreparedWorkspace {
  return {
    workspacePath: "/tmp/task",
    repoPath: "/tmp/task/repo",
    repos: [{
      key: "Repo1",
      url: "https://example.com/repo.git",
      path: "/tmp/task/repo",
      cachePath: "/tmp/cache",
      commit: "head-456"
    }],
    specRootPath: "/tmp/task",
    branch: "main",
    cachePath: "/tmp/cache",
    artifactsPath: "/tmp/task/artifacts",
    env: {}
  };
}
