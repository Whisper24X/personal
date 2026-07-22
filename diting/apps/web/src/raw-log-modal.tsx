import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { RunRawLogItem, RunRawLogsResponse } from "./api";
import { useI18n } from "./i18n";

function sortRawLogsNewestFirst(items: RunRawLogItem[]): RunRawLogItem[] {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    const leftValid = !Number.isNaN(leftTime);
    const rightValid = !Number.isNaN(rightTime);
    if (!leftValid && !rightValid) {
      return 0;
    }
    if (!leftValid) {
      return 1;
    }
    if (!rightValid) {
      return -1;
    }
    return rightTime - leftTime;
  });
}

type ParsedRawLogText = {
  title: string;
  detail: string | null;
  fields: Array<{ label: string; value: string }>;
  rawPreview: string;
  isJson: boolean;
  level: string | null;
  variant: "default" | "agent-message" | "command" | "thread";
  kind: RawLogKind;
};

type RawLogKind =
  | "stderr"
  | "stdout.agent"
  | "stdout.command"
  | "stdout.thread"
  | "stdout.result"
  | "stdout.plain"
  | "summary"
  | "event"
  | "file";

type RawLogKindFilter = RawLogKind | "all";

type RawLogViewItem = {
  item: RunRawLogItem;
  parsed: ParsedRawLogText;
};

const DISPLAY_FIELD_KEYS = ["level", "eventType", "traceId", "durationMs", "pluginId", "status"] as const;

export function RawLogModal(props: {
  runId: string;
  isOpen: boolean;
  logs: RunRawLogsResponse | null;
  loading: boolean;
  query: { source: string; q: string };
  onQueryChange(next: { source: string; q: string }): void;
  onClose(): void;
}) {
  const { t } = useI18n();
  const [kindFilter, setKindFilter] = useState<RawLogKindFilter>("stdout.agent");
  const parsedItems = useMemo<RawLogViewItem[]>(
    () => sortRawLogsNewestFirst(props.logs?.items ?? []).map((item) => ({
      item,
      parsed: parseRawLogText(item.text, item.source, item.pluginId)
    })),
    [props.logs?.items]
  );
  const displayedItems = useMemo(
    () => parsedItems.filter(({ parsed }) => kindFilter === "all" || parsed.kind === kindFilter),
    [kindFilter, parsedItems]
  );
  useEffect(() => {
    if (props.isOpen) {
      setKindFilter("stdout.agent");
    }
  }, [props.isOpen, props.runId]);
  if (!props.isOpen) {
    return null;
  }
  const visibleText = displayedItems.map(({ item }) => item.text).join("\n");
  const hasActiveFilter = props.query.source !== "all" || kindFilter !== "all" || Boolean(props.query.q.trim());
  const emptyMessage = hasActiveFilter ? t("rawlog.emptyFiltered") : t("rawlog.empty");
  const kindCounts = groupRawLogKinds(parsedItems);
  return (
    <div aria-modal="true" className="modal-backdrop" role="dialog" aria-label={t("rawlog.title")}>
      <section className="modal-card raw-log-modal-card">
        <div className="raw-log-sticky-header">
          <header className="subpanel-header">
            <div>
              <p className="eyebrow compact">{t("rawlog.run", { id: props.runId })}</p>
              <h2>{t("rawlog.title")}</h2>
              <p className="meta raw-log-live-hint">{t("rawlog.liveHint")}</p>
            </div>
            <button className="secondary-button" onClick={props.onClose} type="button">
              {t("rawlog.close")}
            </button>
          </header>
          <div className="raw-log-toolbar">
            <span className="raw-log-count">{t("rawlog.count", { count: displayedItems.length })}</span>
            <label>
              {t("rawlog.source")}
              <select
                aria-label={t("rawlog.sourceAria")}
                value={props.query.source}
                onChange={(event) => {
                  setKindFilter("all");
                  props.onQueryChange({ ...props.query, source: event.target.value });
                }}
              >
                {["all", "stdout", "stderr", "summary", "event", "file"].map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("rawlog.type")}
              <select
                aria-label={t("rawlog.typeAria")}
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value as RawLogKindFilter)}
              >
                <option value="all">{t("common.all")}</option>
                {kindCounts.map((item) => (
                  <option key={item.kind} value={item.kind}>
                    {labelRawLogKind(item.kind)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("rawlog.search")}
              <input
                aria-label={t("rawlog.searchAria")}
                value={props.query.q}
                onChange={(event) => props.onQueryChange({ ...props.query, q: event.target.value })}
              />
            </label>
            <button className="secondary-button" onClick={() => void navigator.clipboard?.writeText(visibleText)} type="button">
              {t("rawlog.copy")}
            </button>
          </div>
          <div className="raw-log-quick-stats" aria-label={t("rawlog.sourceSummary")}>
            {kindCounts.map((item) => (
              <span className={`raw-log-stat raw-log-kind-${formatRawLogKindClass(item.kind)}`} key={item.kind}>
                {labelRawLogKind(item.kind)}
                <strong>{item.count}</strong>
              </span>
            ))}
          </div>
        </div>
        {props.loading ? <p>{t("rawlog.loading")}</p> : null}
        {displayedItems.length > 0 ? (
          <div className="raw-log-list">
            {displayedItems.map(({ item, parsed }) => (
              <RawLogItemView item={item} key={item.id} parsed={parsed} />
            ))}
          </div>
        ) : (
          <p>{emptyMessage}</p>
        )}
      </section>
    </div>
  );
}

function RawLogItemView(props: { item: RunRawLogItem; parsed: ParsedRawLogText }) {
  const { t } = useI18n();
  const parsed = props.parsed;
  const tone = props.item.source === "stderr" || parsed.level === "error" ? "danger" : props.item.source;
  const context = [
    props.item.stage,
    props.item.pluginId,
    props.item.channel,
    props.item.redacted ? "redacted" : null
  ].filter(Boolean);

  return (
    <article className={`raw-log-item raw-log-${tone} raw-log-${parsed.variant}`}>
      <header className="raw-log-item-header">
        <div className="raw-log-heading">
          <span className={`raw-log-badge raw-log-source-${props.item.source}`}>{props.item.source}</span>
          <span className={`raw-log-badge raw-log-kind-${formatRawLogKindClass(parsed.kind)}`}>
            {labelRawLogKind(parsed.kind)}
          </span>
          <p className="raw-log-title">{parsed.title}</p>
          {parsed.detail ? <p className="meta">{parsed.detail}</p> : null}
        </div>
        <time className="mono" dateTime={props.item.createdAt}>
          {formatRawLogTime(props.item.createdAt)}
        </time>
      </header>
      <div className="raw-log-meta" aria-label={t("rawlog.metadataAria")}>
        {context.map((value) => (
          <span className="raw-log-badge" key={value}>
            {value}
          </span>
        ))}
        {parsed.isJson ? <span className="raw-log-badge">json</span> : null}
      </div>
      {parsed.fields.length > 0 ? (
        <dl className="raw-log-fields">
          {parsed.fields.map((field) => (
            <div key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <MarkdownPreview content={parsed.rawPreview} />
    </article>
  );
}

function parseRawLogText(text: string, source: RunRawLogItem["source"], pluginId?: string | null): ParsedRawLogText {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed)) {
      return plainRawLog(text, source);
    }

    const isCodex = pluginId === "codex" || (typeof parsed.type === "string" && (parsed.type.includes("thread") || parsed.type.includes("turn") || parsed.type.includes("item")));

    if (isCodex) {
      if (parsed.type === "thread.started") {
        const threadId = String(parsed.thread_id ?? parsed.threadId ?? "");
        return {
          title: "Codex thread started",
          detail: null,
          fields: threadId ? [{ label: "threadId", value: threadId }] : [],
          rawPreview: threadId,
          isJson: true,
          level: "info",
          variant: "thread",
          kind: "stdout.thread"
        };
      }

      if (parsed.type === "turn.started") {
        return {
          title: "Codex turn started",
          detail: null,
          fields: [],
          rawPreview: "Turn started",
          isJson: true,
          level: "info",
          variant: "thread",
          kind: "stdout.thread"
        };
      }

      if ((parsed.type === "item.started" || parsed.type === "item.completed") && isRecord(parsed.item)) {
        const item = parsed.item;
        const itemType = String(item.type ?? "");
        const status = readStringField(item, ["status"]) ?? (parsed.type === "item.started" ? "started" : "completed");

        if (itemType === "agent_message") {
          const itemId = readStringField(item, ["id"]);
          return {
            title: "Agent response",
            detail: "assistant message",
            fields: itemId ? [{ label: "item", value: itemId }] : [],
            rawPreview: String(item.text ?? ""),
            isJson: true,
            level: "info",
            variant: "agent-message",
            kind: "stdout.agent"
          };
        }

        if (itemType === "command_execution") {
          const command = String(item.command ?? "");
          const displayCommand = unwrapShellCommand(command);
          const exitCode = item.exit_code !== undefined && item.exit_code !== null ? String(item.exit_code) : null;
          const output = String(item.aggregated_output ?? "");

          const fields: Array<{ label: string; value: string }> = [
            { label: "command", value: displayCommand }
          ];
          if (exitCode !== null) {
            fields.push({ label: "exit_code", value: exitCode });
          }
          if (status) {
            fields.push({ label: "status", value: status });
          }

          const action = parsed.type === "item.started" ? "started" : "completed";
          const level = exitCode === "0" || exitCode === null ? "info" : "error";

          return {
            title: `Codex command execution ${action}`,
            detail: displayCommand,
            fields,
            rawPreview: output || `Command: ${displayCommand}`,
            isJson: true,
            level,
            variant: "command",
            kind: "stdout.command"
          };
        }
      }

      const title = readStringField(parsed, ["type", "message", "msg"]) ?? "Codex event";
      return {
        title,
        detail: null,
        fields: [],
        rawPreview: JSON.stringify(parsed, null, 2),
        isJson: true,
        level: readStringField(parsed, ["level"]),
        variant: "default",
        kind: source === "stdout" ? "stdout.plain" : source
      };
    }

    if (source === "stdout" && parsed.result !== undefined && parsed.result !== null) {
      return {
        title: formatRawLogResultTitle(parsed.result),
        detail: null,
        fields: [],
        rawPreview: formatRawLogValue("result", parsed.result),
        isJson: true,
        level: readStringField(parsed, ["level"]),
        variant: "default",
        kind: "stdout.result"
      };
    }

    const title = readStringField(parsed, ["message", "msg", "error", "eventType"]) ?? text;
    const error = readStringField(parsed, ["error"]);
    const detail = error && error !== title ? error : null;
    const level = readStringField(parsed, ["level"]);
    const fields = DISPLAY_FIELD_KEYS.flatMap((key) => {
      const value = parsed[key];
      return value === undefined || value === null ? [] : [{ label: key, value: formatRawLogValue(key, value) }];
    });

    return {
      title,
      detail,
      fields,
      rawPreview: JSON.stringify(parsed, null, 2),
      isJson: true,
      level,
      variant: "default",
      kind: source === "stdout" ? "stdout.plain" : source
    };
  } catch {
    return parseTruncatedCodexLog(text) ?? plainRawLog(text, source);
  }
}

function parseTruncatedCodexLog(text: string): ParsedRawLogText | null {
  const eventType = readJsonStringFragment(text, "type");
  const itemType = readNestedItemType(text);
  if ((eventType !== "item.started" && eventType !== "item.completed") || itemType !== "command_execution") {
    return null;
  }

  const command = readJsonStringFragment(text, "command") ?? "";
  const displayCommand = unwrapShellCommand(command);
  const status = readJsonStringFragment(text, "status") ?? (eventType === "item.started" ? "in_progress" : "completed");
  const exitCode = readJsonScalarFragment(text, "exit_code");
  const output = readJsonStringFragment(text, "aggregated_output", { allowUnterminated: true }) ?? "";
  const isTruncated = !text.trimEnd().endsWith("}}");
  const fields: Array<{ label: string; value: string }> = [
    { label: "command", value: displayCommand }
  ];

  if (exitCode !== null && exitCode !== "null") {
    fields.push({ label: "exit_code", value: exitCode });
  }
  fields.push({ label: "status", value: status });
  if (isTruncated) {
    fields.push({ label: "output", value: "truncated" });
  }

  const action = eventType === "item.started" ? "started" : "completed";
  const preview = output || `Command: ${displayCommand}`;
  return {
    title: `Codex command execution ${action}`,
    detail: displayCommand,
    fields,
    rawPreview: isTruncated && output ? `${preview}\n\n[output truncated]` : preview,
    isJson: true,
    level: exitCode && exitCode !== "0" && exitCode !== "null" ? "error" : "info",
    variant: "command",
    kind: "stdout.command"
  };
}

function plainRawLog(text: string, source: RunRawLogItem["source"]): ParsedRawLogText {
  return {
    title: text,
    detail: null,
    fields: [],
    rawPreview: text,
    isJson: false,
    level: null,
    variant: "default",
    kind: source === "stdout" ? "stdout.plain" : source
  };
}

function groupRawLogKinds(items: RawLogViewItem[]): Array<{ kind: RawLogKind; count: number }> {
  const counts = items.reduce<Partial<Record<RawLogKind, number>>>((result, item) => {
    result[item.parsed.kind] = (result[item.parsed.kind] ?? 0) + 1;
    return result;
  }, {});
  return [
    "stderr",
    "stdout.agent",
    "stdout.command",
    "stdout.thread",
    "stdout.result",
    "stdout.plain",
    "summary",
    "event",
    "file"
  ].flatMap((kind) => {
      const count = counts[kind as RawLogKind] ?? 0;
      return count > 0 ? [{ kind: kind as RawLogKind, count }] : [];
    });
}

function labelRawLogKind(kind: RawLogKind): string {
  const labels: Record<RawLogKind, string> = {
    stderr: "stderr",
    "stdout.agent": "agent response",
    "stdout.command": "command",
    "stdout.thread": "thread",
    "stdout.result": "result",
    "stdout.plain": "stdout",
    summary: "summary",
    event: "event",
    file: "file"
  };
  return labels[kind];
}

function formatRawLogKindClass(kind: RawLogKind): string {
  return kind.replace(".", "-");
}

function readStringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function readNestedItemType(text: string): string | null {
  const match = /"item"\s*:\s*\{[\s\S]*?"type"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(text);
  return match ? decodeJsonStringFragment(match[1]) : null;
}

function readJsonStringFragment(text: string, key: string, options: { allowUnterminated?: boolean } = {}): string | null {
  const marker = `"${key}"`;
  const keyIndex = text.indexOf(marker);
  if (keyIndex < 0) {
    return null;
  }
  const colonIndex = text.indexOf(":", keyIndex + marker.length);
  if (colonIndex < 0) {
    return null;
  }
  const quoteIndex = text.indexOf("\"", colonIndex + 1);
  if (quoteIndex < 0) {
    return null;
  }

  let escaped = false;
  for (let index = quoteIndex + 1; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") {
      return decodeJsonStringFragment(text.slice(quoteIndex + 1, index));
    }
  }

  if (!options.allowUnterminated) {
    return null;
  }
  return decodeJsonStringFragment(text.slice(quoteIndex + 1));
}

function readJsonScalarFragment(text: string, key: string): string | null {
  const match = new RegExp(`"${key}"\\s*:\\s*(null|-?\\d+)`).exec(text);
  return match?.[1] ?? null;
}

function decodeJsonStringFragment(value: string): string {
  const safeValue = value.endsWith("\\") ? value.slice(0, -1) : value;
  try {
    return JSON.parse(`"${safeValue}"`) as string;
  } catch {
    return safeValue
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, "\"")
      .replace(/\\\\/g, "\\");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatRawLogValue(label: string, value: unknown): string {
  if (label === "durationMs" && typeof value === "number") {
    return `${value}ms`;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatRawLogResultTitle(value: unknown): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return stripMarkdownPreviewTitle(value);
  }
  if (isRecord(value)) {
    const title = readStringField(value, ["message", "msg", "summary", "status"]);
    return title ? stripMarkdownPreviewTitle(title) : "stdout result";
  }
  return formatRawLogValue("result", value);
}

function unwrapShellCommand(command: string): string {
  const match = /^(?:\/(?:usr\/)?bin\/)?(?:zsh|bash|sh)\s+-lc\s+(['"])([\s\S]*)\1$/.exec(command.trim());
  if (!match) {
    return command;
  }
  return match[2].trim();
}

function stripMarkdownPreviewTitle(value: string): string {
  const firstLine = value.split(/\r?\n/).find((line) => line.trim().length > 0) ?? value;
  return firstLine
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+\.\s+/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function MarkdownPreview(props: { content: string }) {
  const lines = props.content.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        index += 1;
      }
      nodes.push(
        <pre className="raw-log-markdown-code" key={`code-${index}`}>
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const content = renderInlineMarkdown(heading[2]);
      nodes.push(heading[1].length <= 2 ? <h3 key={`heading-${index}`}>{content}</h3> : <h4 key={`heading-${index}`}>{content}</h4>);
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: ReactNode[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(<li key={`item-${index}`}>{renderInlineMarkdown(lines[index].trim().replace(/^[-*]\s+/, ""))}</li>);
        index += 1;
      }
      nodes.push(<ul key={`list-${index}`}>{items}</ul>);
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      const table = parseMarkdownTable(lines, index);
      nodes.push(table.node);
      index = table.nextIndex;
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim().length > 0 &&
      !lines[index].trim().startsWith("```") &&
      !/^(#{1,6})\s+/.test(lines[index].trim()) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !isMarkdownTableStart(lines, index)
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    nodes.push(<p key={`paragraph-${index}`}>{renderInlineMarkdown(paragraphLines.join(" "))}</p>);
  }

  return <div className="raw-log-markdown">{nodes.length > 0 ? nodes : <p>{props.content}</p>}</div>;
}

function isMarkdownTableStart(lines: string[], index: number): boolean {
  const header = lines[index]?.trim();
  const separator = lines[index + 1]?.trim();
  return Boolean(header && separator && isMarkdownTableRow(header) && isMarkdownTableSeparator(separator));
}

function parseMarkdownTable(lines: string[], startIndex: number): { node: ReactNode; nextIndex: number } {
  const headers = splitMarkdownTableRow(lines[startIndex]);
  const rows: string[][] = [];
  let index = startIndex + 2;

  while (index < lines.length && isMarkdownTableRow(lines[index].trim())) {
    rows.push(splitMarkdownTableRow(lines[index]));
    index += 1;
  }

  return {
    node: (
      <table key={`table-${startIndex}`}>
        <thead>
          <tr>
            {headers.map((header, headerIndex) => (
              <th key={`header-${headerIndex}`}>{renderInlineMarkdown(header)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {headers.map((_, cellIndex) => (
                <td key={`cell-${cellIndex}`}>{renderInlineMarkdown(row[cellIndex] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
    nextIndex: index
  };
}

function isMarkdownTableRow(value: string): boolean {
  return value.includes("|") && splitMarkdownTableRow(value).length > 1;
}

function isMarkdownTableSeparator(value: string): boolean {
  const cells = splitMarkdownTableRow(value);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitMarkdownTableRow(value: string): string[] {
  return value
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderInlineMarkdown(value: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(value.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={`strong-${match.index}`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<code key={`code-${match.index}`}>{token.slice(1, -1)}</code>);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < value.length) {
    nodes.push(value.slice(lastIndex));
  }
  return nodes;
}

function formatRawLogTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
