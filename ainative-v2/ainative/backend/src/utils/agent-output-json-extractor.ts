import {
  extractStreamJsonGoalChunks,
  findMatchingJsonObjectEnd,
} from './stream-json-assistant-text';

const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey|secret|token|authorization|password)\s*[:=]\s*["'][^"']{8,}/gi,
  /sk-[a-zA-Z0-9]{20,}/g,
  /Bearer\s+[a-zA-Z0-9._-]{20,}/g,
];

export interface JsonExtractionResult<T = unknown> {
  parsed: T | null;
  rawPreview: string;
  error?: string;
}

/**
 * Extract a JSON object from raw CLI/AI output.
 *
 * Strategy:
 * 1. Extract assistant text from NDJSON stream
 * 2. Strip markdown code fences
 * 3. Find outermost JSON object
 * 4. Parse and return
 */
export function extractJsonFromAgentOutput<T = unknown>(
  stdout: string,
): JsonExtractionResult<T> {
  const rawPreview = maskSecrets(stdout.slice(0, 2048));

  if (!stdout.trim()) {
    return { parsed: null, rawPreview, error: 'Empty output' };
  }

  const assistantText = extractStreamJsonGoalChunks(stdout.trim());
  const textToSearch = assistantText.trim() || stdout.trim();

  const stripped = stripCodeFences(textToSearch);
  const parsed = findFirstJsonObject<T>(stripped);

  if (parsed !== null) {
    return { parsed, rawPreview };
  }

  const directParsed = findFirstJsonObject<T>(textToSearch);
  if (directParsed !== null) {
    return { parsed: directParsed, rawPreview };
  }

  return {
    parsed: null,
    rawPreview,
    error: 'No valid JSON object found in output',
  };
}

function stripCodeFences(text: string): string {
  const fenceMatch = text.match(/```(?:json|jsonc)?\s*\n?([\s\S]*?)```/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  return text;
}

function findFirstJsonObject<T>(text: string): T | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;

    const end = findMatchingJsonObjectEnd(text, i);
    if (end < 0) continue;

    const slice = text.slice(i, end + 1);
    try {
      return JSON.parse(slice) as T;
    } catch {
      continue;
    }
  }
  return null;
}

export function maskSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const visible = match.slice(0, Math.min(8, match.length));
      return visible + '***MASKED***';
    });
  }
  return result;
}
