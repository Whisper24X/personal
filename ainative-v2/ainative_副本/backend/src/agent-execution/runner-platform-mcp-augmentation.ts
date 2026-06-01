import path from 'node:path';
import type { AgentCliAdapterId } from './agent-cli/agent-cli-adapter.interface';

/**
 * Rewrite persisted tool config **file** paths from host worktree absolute paths to the in-container
 * workspace mount (e.g. /workspace/...). Used when `executionPlane === 'runner'`.
 *
 * For **HTTP/SSE MCP**, prefer host-run servers plus `containerRuntime.env` URLs (e.g.
 * `http://host.docker.internal:PORT/...`); this helper does not rewrite those URLs.
 */
export function rewriteRunnerWorktreeAbsolutePaths(
  adapter: AgentCliAdapterId,
  raw: Record<string, unknown>,
  hostWorktreePath: string,
  containerWorkspacePath: string,
): Record<string, unknown> {
  const hostRoot = path.resolve(hostWorktreePath);
  const containerRoot =
    containerWorkspacePath.replace(/\/+$/, '') || '/workspace';

  const rewritePathString = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return value;
    }
    if (!path.isAbsolute(trimmed)) {
      return value;
    }
    const abs = path.resolve(trimmed);
    if (abs === hostRoot || abs.startsWith(`${hostRoot}${path.sep}`)) {
      return path.join(containerRoot, path.relative(hostRoot, abs));
    }
    return value;
  };

  /**
   * Codex `config_overrides` lines are often `key=value` where `value` embeds a host worktree
   * absolute path; rewrite any such path prefix to the container mount.
   */
  const rewriteCodexConfigOverrideLine = (line: string): string => {
    const whole = rewritePathString(line);
    if (whole !== line) {
      return whole;
    }
    if (!line.includes(hostRoot)) {
      return line;
    }
    let result = '';
    let pos = 0;
    while (pos < line.length) {
      const j = line.indexOf(hostRoot, pos);
      if (j === -1) {
        result += line.slice(pos);
        break;
      }
      result += line.slice(pos, j);
      let k = j + hostRoot.length;
      while (k < line.length && (line[k] === '/' || line[k] === '\\')) {
        k += 1;
      }
      while (k < line.length) {
        const ch = line[k];
        if (
          ch === ' ' ||
          ch === '\t' ||
          ch === '\n' ||
          ch === '"' ||
          ch === "'" ||
          ch === ';' ||
          ch === ',' ||
          ch === ')' ||
          ch === ']' ||
          ch === '}'
        ) {
          break;
        }
        k += 1;
      }
      const segment = line.slice(j, k);
      result += rewritePathString(segment);
      pos = k;
    }
    return result;
  };

  const mapStringArray = (key: string): void => {
    const v = out[key];
    if (!Array.isArray(v)) {
      return;
    }
    out[key] = v.map((item) =>
      typeof item === 'string' ? rewritePathString(item) : item,
    );
  };

  const mapCodexConfigOverrides = (): void => {
    const v = out['config_overrides'];
    if (!Array.isArray(v)) {
      return;
    }
    out['config_overrides'] = v.map((item) =>
      typeof item === 'string' ? rewriteCodexConfigOverrideLine(item) : item,
    );
  };

  const out: Record<string, unknown> = { ...raw };

  switch (adapter) {
    case 'claude':
      mapStringArray('mcp_config');
      break;
    case 'gemini':
      mapStringArray('policy');
      mapStringArray('extensions');
      break;
    case 'codex':
      mapCodexConfigOverrides();
      break;
    default:
      break;
  }

  return out;
}
