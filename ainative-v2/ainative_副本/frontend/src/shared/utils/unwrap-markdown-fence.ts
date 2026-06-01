/**
 * If the model wraps the full document in a single fenced block, unwrap it for editor paste.
 */
export function unwrapMarkdownFence(text: string): string {
  const t = text.trim()
  const closedBlock = /^```(?:markdown|md)?\s*\r?\n([\s\S]*?)\r?\n```\s*$/i
  const m = t.match(closedBlock)
  const inner = m?.[1]
  if (inner !== undefined) {
    return inner.trim()
  }
  if (/^```(?:markdown|md)?\s*\r?\n/i.test(t) && /\r?\n```\s*$/i.test(t)) {
    return t
      .replace(/^```(?:markdown|md)?\s*\r?\n/i, '')
      .replace(/\r?\n```\s*$/i, '')
      .trim()
  }
  return t
}
