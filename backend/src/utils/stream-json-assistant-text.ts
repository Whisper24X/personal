/**
 * Cursor/Claude/Codex 等 CLI 使用 stream-json / NDJSON 时 stdout 不是单个 JSON。
 * 抽取 assistant / agent_message 正文；供 goals PRD/计划解析与 project docs 流式问答。
 */

export function findMatchingJsonObjectEnd(s: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

export function extractAssistantMessageText(
  msg: Record<string, unknown>,
): string | null {
  const candidates = [
    msg.delta,
    msg.text,
    msg.content,
    msg.message,
    msg.output,
    msg.result,
  ];

  for (const candidate of candidates) {
    const text = extractTextContent(candidate);
    if (text) {
      return text;
    }
  }

  return null;
}

export function extractTextContent(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (Array.isArray(value)) {
    const textParts = value
      .map((item) => extractTextContent(item))
      .filter((item): item is string => Boolean(item));
    const joined = textParts.join('').trim();
    return joined || null;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['text', 'content', 'message', 'output', 'result']) {
      const text = extractTextContent(record[key]);
      if (text) {
        return text;
      }
    }
  }

  return null;
}

export function isAssistantLikeRecord(
  record: Record<string, unknown>,
): boolean {
  return ['type', 'event', 'method', 'kind', 'role', 'subtype'].some((key) => {
    const value = record[key];
    if (typeof value !== 'string') {
      return false;
    }
    const normalized = value.trim().toLowerCase().replace(/\./g, '_');
    return (
      normalized === 'assistant' ||
      normalized === 'assistant_message' ||
      normalized === 'agent_message' ||
      normalized === 'agent_message_delta' ||
      normalized === 'model'
    );
  });
}

export function extractAssistantTextFromRecord(
  record: Record<string, unknown>,
): string | null {
  const queue: Array<Record<string, unknown>> = [record];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (isAssistantLikeRecord(current)) {
      const text = extractAssistantMessageText(current);
      if (text) {
        return text;
      }
    }

    ['item', 'message', 'params', 'result', 'event'].forEach((key) => {
      const nested = current[key];
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        queue.push(nested as Record<string, unknown>);
      }
    });
  }

  return null;
}

/** 单条 NDJSON 行：可展示的 assistant/result 文本；非 `{` 开头的行视为纯文本。 */
export function extractLineContribution(trimmed: string): string | null {
  if (!trimmed) {
    return null;
  }
  if (!trimmed.startsWith('{')) {
    return trimmed;
  }
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') {
    return null;
  }
  const rec = obj as Record<string, unknown>;
  const text = extractAssistantTextFromRecord(rec);
  if (text) {
    return text;
  }
  const type = typeof rec.type === 'string' ? rec.type.toLowerCase() : '';
  if (type === 'result') {
    const r = rec.result;
    if (typeof r === 'string' && (r.includes('{') || r.includes('markdown'))) {
      return r;
    }
  }
  return null;
}

/**
 * 将原始 stdout 块按行缓冲，解析 NDJSON，仅输出相对上一次的可见正文增量（与 extractStreamJsonGoalChunks 拼接规则一致）。
 */
export function createNdjsonAssistantTextDeltaStream(): {
  push: (rawChunk: string) => string;
  flush: () => string;
} {
  let lineBuffer = '';
  const parts: string[] = [];
  let lastJoined = '';

  const push = (rawChunk: string): string => {
    if (!rawChunk) {
      return '';
    }
    lineBuffer += rawChunk;
    let out = '';
    while (true) {
      const nl = lineBuffer.indexOf('\n');
      if (nl === -1) {
        break;
      }
      const line = lineBuffer.slice(0, nl);
      lineBuffer = lineBuffer.slice(nl + 1);
      const part = extractLineContribution(line.trim());
      if (part) {
        parts.push(part);
        const joined = parts.join('\n');
        const delta = joined.slice(lastJoined.length);
        lastJoined = joined;
        out += delta;
      }
    }
    return out;
  };

  const flush = (): string => {
    const rest = lineBuffer.trim();
    lineBuffer = '';
    if (!rest) {
      return '';
    }
    const part = extractLineContribution(rest);
    if (part) {
      parts.push(part);
      const joined = parts.join('\n');
      const delta = joined.slice(lastJoined.length);
      lastJoined = joined;
      return delta;
    }
    return '';
  };

  return { push, flush };
}

/** 拼接 stream-json 中 assistant / agent_message / result 里可能含目标 JSON 的片段 */
export function extractStreamJsonGoalChunks(stdout: string): string {
  const parts: string[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const part = extractLineContribution(trimmed);
    if (part) {
      parts.push(part);
    }
  }
  return parts.join('\n');
}

export function tryParsePrdJsonObject(
  text: string,
): { markdown: string; uncertainPoints?: unknown } | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? trimmed).trim();

  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '{') {
      continue;
    }
    const end = findMatchingJsonObjectEnd(body, i);
    if (end < 0) {
      continue;
    }
    const slice = body.slice(i, end + 1);
    try {
      const parsed = JSON.parse(slice) as Record<string, unknown>;
      if (typeof parsed.markdown === 'string' && parsed.markdown.trim()) {
        return parsed as { markdown: string; uncertainPoints?: unknown };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function parsePrdJsonFromAgentStdout(stdout: string): {
  markdown: string;
} | null {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }

  const fromChunks = extractStreamJsonGoalChunks(trimmed);
  if (fromChunks) {
    const parsed = tryParsePrdJsonObject(fromChunks);
    if (parsed) {
      return { markdown: parsed.markdown };
    }
  }

  const fromWhole = tryParsePrdJsonObject(trimmed);
  if (fromWhole) {
    return { markdown: fromWhole.markdown };
  }

  for (const line of trimmed.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    try {
      const obj = JSON.parse(t) as Record<string, unknown>;
      if (typeof obj.markdown === 'string' && obj.markdown.trim()) {
        return { markdown: obj.markdown };
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function tryParsePlanJsonObject(
  text: string,
): { markdown: string; items: unknown[] } | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? trimmed).trim();

  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '{') {
      continue;
    }
    const end = findMatchingJsonObjectEnd(body, i);
    if (end < 0) {
      continue;
    }
    const slice = body.slice(i, end + 1);
    try {
      const parsed = JSON.parse(slice) as Record<string, unknown>;
      if (
        typeof parsed.markdown === 'string' &&
        parsed.markdown.trim() &&
        Array.isArray(parsed.items)
      ) {
        return { markdown: parsed.markdown, items: parsed.items };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function parsePlanJsonFromAgentStdout(stdout: string): {
  markdown: string;
  items: unknown[];
} | null {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }

  const fromChunks = extractStreamJsonGoalChunks(trimmed);
  if (fromChunks) {
    const parsed = tryParsePlanJsonObject(fromChunks);
    if (parsed) {
      return parsed;
    }
  }

  const fromWhole = tryParsePlanJsonObject(trimmed);
  if (fromWhole) {
    return fromWhole;
  }

  for (const line of trimmed.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    try {
      const obj = JSON.parse(t) as Record<string, unknown>;
      if (
        typeof obj.markdown === 'string' &&
        obj.markdown.trim() &&
        Array.isArray(obj.items)
      ) {
        return { markdown: obj.markdown, items: obj.items };
      }
    } catch {
      continue;
    }
  }

  return null;
}

/** 同步 docs query：从完整 stdout 得到面向用户的可见文本（非 NDJSON 原样）。 */
export function extractDisplayableAnswerFromAgentStdout(
  stdout: string,
): string {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return '';
  }
  const fromChunks = extractStreamJsonGoalChunks(trimmed);
  if (fromChunks.trim()) {
    return fromChunks.trim();
  }
  return trimmed;
}
