/** Conservative PII/secret redaction for memory text (host baseline). */
const PATTERNS: RegExp[] = [
  /\bsk-[a-zA-Z0-9]{20,}/g,
  /Bearer\s+[a-zA-Z0-9._\-+/=]{20,}/gi,
  /\b\d{11}(?=\D|$)/g,
  /\b1[3-9]\d{9}\b/g,
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
];

export function redactMemoryText(input: string): string {
  let o = input;
  for (const p of PATTERNS) {
    o = o.replace(p, '[redacted]');
  }
  return o;
}
