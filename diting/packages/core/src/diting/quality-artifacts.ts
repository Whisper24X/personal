import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type QualityArtifactFilename =
  | "implementation-handoff.json"
  | "quality-report.json"
  | "quality-repair-handoff.json"
  | "code-review-report.json";

export type WriteQualityJsonArtifactInput = {
  artifactsPath: string;
  filename: QualityArtifactFilename;
  value: unknown;
};

export type WriteQualityJsonArtifactResult = {
  path: string;
};

export async function writeQualityJsonArtifact(
  input: WriteQualityJsonArtifactInput
): Promise<WriteQualityJsonArtifactResult> {
  await mkdir(input.artifactsPath, { recursive: true });
  const path = join(input.artifactsPath, input.filename);
  await writeFile(path, `${JSON.stringify(input.value, null, 2)}\n`, "utf8");
  return { path };
}
