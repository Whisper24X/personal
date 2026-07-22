import { readFile } from "node:fs/promises";
import { join } from "node:path";

type ServiceStartupDiagnosticsInput = {
  artifactsPath: string;
  serviceId: string;
};

export type ServiceStartupDiagnostics = {
  observedUrls: string[];
  stdoutTail: string | null;
  stderrTail: string | null;
  detail: string | null;
};

const LOG_TAIL_LENGTH = 2_000;

export async function buildServiceStartupDiagnostics(
  input: ServiceStartupDiagnosticsInput
): Promise<string | null> {
  return (await readServiceStartupDiagnostics(input)).detail;
}

export async function readServiceStartupDiagnostics(
  input: ServiceStartupDiagnosticsInput
): Promise<ServiceStartupDiagnostics> {
  const logsDir = join(input.artifactsPath, "target-services");
  const serviceId = sanitizeLogFilePart(input.serviceId);
  const [stdoutTail, stderrTail] = await Promise.all([
    readLogTail(join(logsDir, `${serviceId}.stdout.log`)),
    readLogTail(join(logsDir, `${serviceId}.stderr.log`))
  ]);
  const observedUrls = extractObservedUrls([stdoutTail, stderrTail].filter(Boolean).join("\n"));
  const parts: string[] = [];

  if (observedUrls.length > 0) {
    parts.push(`observedUrls=${observedUrls.join(",")}`);
  }
  if (stdoutTail) {
    parts.push(`stdoutTail=${JSON.stringify(compactLogTail(stdoutTail))}`);
  }
  if (stderrTail) {
    parts.push(`stderrTail=${JSON.stringify(compactLogTail(stderrTail))}`);
  }

  return {
    observedUrls,
    stdoutTail,
    stderrTail,
    detail: parts.length > 0 ? parts.join(" ") : null
  };
}

export function selectObservedHealthUrl(expectedHealthUrl: string, observedUrls: string[]): string | null {
  const expected = parseUrl(expectedHealthUrl);
  if (!expected) {
    return null;
  }

  for (const observedUrl of observedUrls) {
    const observed = parseUrl(observedUrl);
    if (!observed) {
      continue;
    }
    if (observed.protocol !== expected.protocol) {
      continue;
    }
    if (!isLoopbackHost(observed.hostname) || !isLoopbackHost(expected.hostname)) {
      continue;
    }
    if (observed.port === expected.port) {
      continue;
    }
    return observed.toString();
  }
  return null;
}

async function readLogTail(path: string): Promise<string | null> {
  try {
    const raw = await readFile(path, "utf8");
    const tail = raw.slice(-LOG_TAIL_LENGTH).trim();
    return tail.length > 0 ? tail : null;
  } catch {
    return null;
  }
}

function extractObservedUrls(input: string): string[] {
  const matches = stripAnsi(input).match(/https?:\/\/[^\s)]+/g) ?? [];
  return [...new Set(matches.map((url) => url.replace(/[.,;]+$/, "")))];
}

function compactLogTail(input: string): string {
  return stripAnsi(input).replace(/\s+/g, " ").trim();
}

function stripAnsi(input: string): string {
  return input.replace(/\u001b\[[0-9;]*m/g, "");
}

function sanitizeLogFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function parseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}
