import { access, cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathExists } from "./shared";

export type LoadedSkillRecord = {
  id: string;
  sourcePath: string;
  targetPath: string;
};

export type SkillsLoadResult = {
  loaded: LoadedSkillRecord[];
  skipped: string[];
  conflicts: string[];
};

export async function loadSpecSkillsIntoWorkspace(workspacePath: string): Promise<SkillsLoadResult> {
  const targetRoot = join(workspacePath, ".cursor", "skills");
  await mkdir(targetRoot, { recursive: true });

  const discovered = await discoverSkillDirectories(workspacePath);
  const loaded: LoadedSkillRecord[] = [];
  const skipped: string[] = [];
  const conflicts: string[] = [];

  for (const sourceDir of discovered) {
    const skillId = basename(sourceDir);
    const targetDir = join(targetRoot, skillId);
    const skillFile = join(sourceDir, "SKILL.md");
    if (!(await pathExists(skillFile))) {
      skipped.push(`${sourceDir}: missing SKILL.md`);
      continue;
    }
    if (await pathExists(targetDir)) {
      conflicts.push(skillId);
    } else {
      await mkdir(dirname(targetDir), { recursive: true });
    }
    await cp(sourceDir, targetDir, { recursive: true, force: true });
    loaded.push({
      id: skillId,
      sourcePath: sourceDir,
      targetPath: targetDir
    });
  }

  return { loaded, skipped, conflicts };
}

async function discoverSkillDirectories(workspacePath: string): Promise<string[]> {
  const found = new Set<string>();
  const roots = [
    join(workspacePath, ".cursor", "skills"),
    join(workspacePath, "skills")
  ];

  for (const root of roots) {
    if (!(await pathExists(root))) {
      continue;
    }
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const dir = join(root, entry.name);
      if (await pathExists(join(dir, "SKILL.md"))) {
        found.add(resolve(dir));
      }
    }
  }

  await scanForSkillFiles(workspacePath, workspacePath, found);
  return [...found].filter((dir) => !dir.startsWith(join(workspacePath, ".cursor", "skills")));
}

async function scanForSkillFiles(
  workspacePath: string,
  current: string,
  found: Set<string>,
  depth = 0
): Promise<void> {
  if (depth > 6) {
    return;
  }
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "repos") {
      continue;
    }
    const fullPath = join(current, entry.name);
    if (entry.isFile() && entry.name === "SKILL.md") {
      found.add(resolve(dirname(fullPath)));
      continue;
    }
    if (entry.isDirectory()) {
      await scanForSkillFiles(workspacePath, fullPath, found, depth + 1);
    }
  }
}

export async function writeSkillsLoadArtifact(
  artifactsPath: string,
  result: SkillsLoadResult
): Promise<void> {
  await mkdir(artifactsPath, { recursive: true });
  await writeFile(join(artifactsPath, "skills-load.json"), JSON.stringify(result, null, 2));
}
