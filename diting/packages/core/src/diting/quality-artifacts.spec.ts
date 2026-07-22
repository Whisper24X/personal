import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeQualityJsonArtifact } from "./quality-artifacts";

describe("quality artifacts", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "diting-quality-artifacts-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it.each([
    "implementation-handoff.json",
    "quality-report.json",
    "quality-repair-handoff.json",
    "code-review-report.json"
  ] as const)("writes %s and returns the artifact path", async (filename) => {
    const result = await writeQualityJsonArtifact({
      artifactsPath: tempDir,
      filename,
      value: {
        schemaVersion: "2026-07-03",
        filename,
        nested: { ok: true }
      }
    });

    expect(result.path).toBe(join(tempDir, filename));
    await expect(readFile(result.path, "utf8")).resolves.toBe(`${JSON.stringify({
      schemaVersion: "2026-07-03",
      filename,
      nested: { ok: true }
    }, null, 2)}\n`);
  });
});
