/**
 * Redacts long filesystem paths in argv copies used for runner logs (risk mitigation:
 * avoid echoing full platform paths; secrets usually live in file contents, not paths).
 */
export function summarizeAgentCliArgsForLog(args: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < args.length) {
    const current = args[i];
    if (current === undefined) {
      break;
    }
    if (current === '--mcp-config') {
      out.push(current);
      i += 1;
      while (i < args.length) {
        const next = args[i];
        if (next === undefined) {
          break;
        }
        if (next.startsWith('-')) {
          break;
        }
        out.push(summarizePathTailForLog(next));
        i += 1;
      }
      continue;
    }
    out.push(current);
    i += 1;
  }
  return out;
}

const PATH_TAIL_MAX = 64;

function summarizePathTailForLog(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length <= PATH_TAIL_MAX) {
    return value;
  }
  return `…${trimmed.slice(-(PATH_TAIL_MAX - 1))}`;
}
