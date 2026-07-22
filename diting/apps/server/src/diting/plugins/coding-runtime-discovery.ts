import { access, constants } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join, normalize } from "node:path";
import { createHash } from "node:crypto";
import { ServerConfig } from "../config";

export type CodingRuntimeKind = "codex" | "cursor";

export type CodingRuntimeSource = "config" | "env" | "path" | "known-location";

export type CodingRuntimeDescriptor = {
  id: string;
  runtime: CodingRuntimeKind;
  bin: string;
  resolvedBin: string | null;
  displayName: string;
  priority: number;
  source: CodingRuntimeSource;
  available: boolean;
};

type CandidateDefinition = {
  runtime: CodingRuntimeKind;
  bin: string;
  source: CodingRuntimeSource;
  priority: number;
};

const RUNTIME_BASE_PRIORITY: Record<CodingRuntimeKind, number> = {
  codex: 100,
  cursor: 80
};

const SOURCE_BONUS: Record<CodingRuntimeSource, number> = {
  config: 40,
  env: 30,
  path: 20,
  "known-location": 10
};

export async function discoverCodingRuntimeDescriptors(config: ServerConfig): Promise<CodingRuntimeDescriptor[]> {
  const candidates = [
    ...buildCodexCandidates(config),
    ...buildCursorCandidates(config)
  ];
  const discovered = await Promise.all(candidates.map(async (candidate) => {
    const resolvedBin = await resolveExecutable(candidate.bin);
    return toDescriptor(candidate.runtime, candidate.bin, resolvedBin, candidate.source, candidate.priority);
  }));

  const deduped = new Map<string, CodingRuntimeDescriptor>();
  for (const descriptor of discovered) {
    if (!descriptor) {
      continue;
    }
    const existing = deduped.get(descriptor.id);
    if (!existing || descriptor.priority > existing.priority) {
      deduped.set(descriptor.id, descriptor);
    }
  }

  return [...deduped.values()].sort((left, right) => right.priority - left.priority);
}

function buildCodexCandidates(config: ServerConfig): CandidateDefinition[] {
  return buildCandidates("codex", [
    { bin: config.plugins.execution.codexBin, source: "config" },
    ...readEnvCandidates("codex", ["DITING_PLUGIN_EXECUTION_CODEX_BIN", "CODEX_CLI_BIN"]),
    ...readPathCandidates("codex", ["codex"]),
    ...readKnownCandidates("codex", [
      "/opt/homebrew/bin/codex",
      "/usr/local/bin/codex",
      "/usr/bin/codex"
    ])
  ]);
}

function buildCursorCandidates(config: ServerConfig): CandidateDefinition[] {
  return buildCandidates("cursor", [
    { bin: config.plugins.execution.cursorBin, source: "config" },
    ...readEnvCandidates("cursor", ["DITING_PLUGIN_EXECUTION_CURSOR_BIN", "CURSOR_CLI_BIN"]),
    ...readPathCandidates("cursor", ["agent", "cursor-agent"]),
    ...readKnownCandidates("cursor", [
      "/Applications/Cursor.app/Contents/Resources/app/bin/agent",
      "/opt/homebrew/bin/cursor-agent",
      "/usr/local/bin/cursor-agent",
      "/usr/bin/cursor-agent"
    ])
  ]);
}

function buildCandidates(runtime: CodingRuntimeKind, seeds: Array<{ bin: string; source: CodingRuntimeSource }>): CandidateDefinition[] {
  const seen = new Set<string>();
  const result: CandidateDefinition[] = [];
  for (const seed of seeds) {
    const normalized = normalizeCandidate(seed.bin);
    if (!normalized || seen.has(`${runtime}:${normalized}`)) {
      continue;
    }
    seen.add(`${runtime}:${normalized}`);
    result.push({
      runtime,
      bin: normalized,
      source: seed.source,
      priority: RUNTIME_BASE_PRIORITY[runtime] + SOURCE_BONUS[seed.source]
    });
  }
  return result;
}

function readEnvCandidates(runtime: CodingRuntimeKind, names: string[]): Array<{ bin: string; source: CodingRuntimeSource }> {
  return names
    .map((name) => process.env[name])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((bin) => ({ bin, source: "env" as const }));
}

function readPathCandidates(runtime: CodingRuntimeKind, commands: string[]): Array<{ bin: string; source: CodingRuntimeSource }> {
  return commands.map((bin) => ({ bin, source: "path" as const }));
}

function readKnownCandidates(runtime: CodingRuntimeKind, bins: string[]): Array<{ bin: string; source: CodingRuntimeSource }> {
  return bins.map((bin) => ({ bin, source: "known-location" as const }));
}

function normalizeCandidate(bin: string): string | null {
  const trimmed = bin.trim();
  if (!trimmed) {
    return null;
  }
  if (isAbsolute(trimmed)) {
    return normalize(trimmed);
  }
  return trimmed;
}

async function resolveExecutable(bin: string): Promise<string | null> {
  const candidate = normalizeCandidate(bin);
  if (!candidate) {
    return null;
  }
  if (isAbsolute(candidate)) {
    return await canAccess(candidate) ? candidate : null;
  }
  if (candidate.includes("/") || candidate.includes("\\")) {
    return await canAccess(candidate) ? candidate : null;
  }
  const pathEntries = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const entry of pathEntries) {
    const resolved = join(entry, candidate);
    if (await canAccess(resolved)) {
      return resolved;
    }
  }
  return null;
}

async function canAccess(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function toDescriptor(
  runtime: CodingRuntimeKind,
  bin: string,
  resolvedBin: string | null,
  source: CodingRuntimeSource,
  priority: number
): CodingRuntimeDescriptor {
  const identity = resolvedBin ?? normalizeCandidate(bin) ?? bin;
  const hash = createHash("sha1").update(`${runtime}:${identity}`).digest("hex").slice(0, 8);
  return {
    id: `${runtime}-${hash}`,
    runtime,
    bin,
    resolvedBin,
    source,
    priority,
    available: Boolean(resolvedBin),
    displayName: `${runtime === "codex" ? "Codex" : "Cursor"} (${resolvedBin ?? bin})`
  };
}
