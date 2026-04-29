export function ngrams(text: string, n: number): Set<string> {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (t.length < n) {
    return new Set();
  }
  const g = new Set<string>();
  for (let i = 0; i <= t.length - n; i++) {
    g.add(t.slice(i, i + n));
  }
  return g;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 1;
  }
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) {
      inter += 1;
    }
  }
  return inter / (a.size + b.size - inter);
}

export function hashSegment(text: string): string {
  let h = 0;
  const s = text.trim();
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return String(h);
}

export function splitMarkdownByHeadings(md: string): Array<{
  heading: string;
  body: string;
}> {
  const lines = md.split(/\r?\n/);
  const out: Array<{ heading: string; body: string }> = [];
  let cur: { heading: string; body: string } | null = null;
  for (const line of lines) {
    const m = /^(##+)\s+(.+)$/.exec(line);
    if (m) {
      if (cur) {
        out.push(cur);
      }
      cur = { heading: line.trim(), body: '' };
    } else if (cur) {
      cur.body += `${line}\n`;
    }
  }
  if (cur) {
    out.push(cur);
  }
  return out.length ? out : [{ heading: '## _root', body: md }];
}

export function scoreSectionsForQuery(args: {
  query: string;
  sections: Array<{ path: string; heading: string; body: string }>;
}): Array<{ path: string; heading: string; body: string; score: number }> {
  const rawTokens = args.query
    .toLowerCase()
    .split(/[\s,，。！？!?:：;；、/\\|()[\]{}"'`]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  const tokens = Array.from(new Set(rawTokens)).slice(0, 12);

  return args.sections
    .map((s) => {
      let score = 0;
      const blob = `${s.path} ${s.heading} ${s.body}`.toLowerCase();
      for (const t of tokens) {
        if (blob.includes(t)) {
          score += 2;
        }
      }
      if (s.path.toLowerCase().includes('readme')) {
        score += 0.5;
      }
      return { ...s, score };
    })
    .sort((a, b) => b.score - a.score);
}

export function buildInjectQuery(
  parts: (string | undefined)[],
  maxLen: number,
): string {
  const q = parts.filter(Boolean).join('\n');
  if (q.length <= maxLen) {
    return q;
  }
  return `${q.slice(0, maxLen)}…`;
}
