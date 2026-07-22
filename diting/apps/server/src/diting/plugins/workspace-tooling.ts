import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { ServerConfig } from "../config";
import { EnvironmentPreparationError, pathExists, runCommand } from "./shared";
import type { SkillsLoadResult } from "./spec-skills";

export const REQUIRED_SUPERPOWERS_SKILL_IDS = [
  "brainstorming",
  "writing-plans",
  "test-driven-development",
  "verification-before-completion"
];

export const DEFAULT_SUPERPOWERS_INSTALL_CMD = "npx -y skills add obra/superpowers --agent cursor --yes";

export async function installWorkspaceTooling(
  workspacePath: string,
  config: ServerConfig,
  skillsLoad: SkillsLoadResult
): Promise<void> {
  const timeoutMs = config.workspace.toolingTimeoutMs;
  if (config.workspace.openspecInit && !(await pathExists(join(workspacePath, "openspec")))) {
    throw new EnvironmentPreparationError(
      "tooling",
      "Spec package must include openspec/",
      join(workspacePath, "openspec"),
      false
    );
  }

  if (config.workspace.openspecInit) {
    let openspecProbe = await runCommand("openspec", ["--version"], workspacePath, timeoutMs);
    if (openspecProbe.exitCode !== 0) {
      const installCommand = [
        "install",
        "-g",
        "@fission-ai/openspec@latest",
        "--registry=https://registry.npmjs.org"
      ];
      const installResult = await runCommand("npm", installCommand, workspacePath, timeoutMs);
      if (installResult.exitCode !== 0) {
        throw new EnvironmentPreparationError(
          "tooling",
          installResult.stderr.trim() || installResult.stdout.trim() || "OpenSpec CLI install failed",
          `npm ${installCommand.join(" ")}`,
          true
        );
      }

      openspecProbe = await runCommand("openspec", ["--version"], workspacePath, timeoutMs);
    }
    if (openspecProbe.exitCode !== 0) {
      throw new EnvironmentPreparationError(
        "tooling",
        openspecProbe.stderr.trim() || openspecProbe.stdout.trim() || "openspec CLI is unavailable",
        "openspec --version",
        true
      );
    }

    const initCommand = ["init", "--tools", "cursor", "--force"];
    const initResult = await runCommand("openspec", initCommand, workspacePath, timeoutMs);
    if (initResult.exitCode !== 0) {
      throw new EnvironmentPreparationError(
        "tooling",
        initResult.stderr.trim() || initResult.stdout.trim() || "OpenSpec initialization failed",
        `openspec ${initCommand.join(" ")}`,
        true
      );
    }
    await ensureSuperpowersAvailable(workspacePath, config, skillsLoad);
  }
}

async function ensureSuperpowersAvailable(
  workspacePath: string,
  config: ServerConfig,
  _skillsLoad: SkillsLoadResult
): Promise<void> {
  const missingBeforeInstall = await missingSuperpowerSkills(workspacePath);
  if (missingBeforeInstall.length === 0) {
    return;
  }

  const installCmd = config.workspace.superpowersInstallCmd?.trim() || DEFAULT_SUPERPOWERS_INSTALL_CMD;
  const result = await runCommand("sh", ["-lc", installCmd], workspacePath, config.workspace.toolingTimeoutMs);
  if (result.exitCode !== 0) {
    throw new EnvironmentPreparationError(
      "tooling",
      result.stderr.trim() || result.stdout.trim() || "Superpowers skills are unavailable",
      installCmd,
      true
    );
  }

  const missingAfterInstall = await missingSuperpowerSkills(workspacePath);
  if (missingAfterInstall.length > 0) {
    throw new EnvironmentPreparationError(
      "tooling",
      `Superpowers skills are unavailable: ${missingAfterInstall.join(", ")}`,
      installCmd,
      true
    );
  }
}

async function missingSuperpowerSkills(workspacePath: string): Promise<string[]> {
  const missing: string[] = [];
  for (const skillId of REQUIRED_SUPERPOWERS_SKILL_IDS) {
    if (!(await hasSuperpowerSkill(workspacePath, skillId))) {
      missing.push(skillId);
    }
  }
  return missing;
}

async function hasSuperpowerSkill(workspacePath: string, skillId: string): Promise<boolean> {
  if (await pathExists(join(workspacePath, ".cursor", "skills", skillId, "SKILL.md"))) {
    return true;
  }
  const home = process.env.HOME?.trim() || homedir();
  if (await pathExists(join(home, ".cursor", "skills", skillId, "SKILL.md"))) {
    return true;
  }
  if (await pathExists(join(home, ".agents", "skills", skillId, "SKILL.md"))) {
    return true;
  }
  return hasSkillInCursorPluginCache(join(home, ".cursor", "plugins", "cache"), skillId);
}

async function hasSkillInCursorPluginCache(root: string, skillId: string, depth = 0): Promise<boolean> {
  if (depth > 8) {
    return false;
  }
  if (await pathExists(join(root, "skills", skillId, "SKILL.md"))) {
    return true;
  }
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "node_modules") {
      continue;
    }
    if (await hasSkillInCursorPluginCache(join(root, entry.name), skillId, depth + 1)) {
      return true;
    }
  }
  return false;
}

