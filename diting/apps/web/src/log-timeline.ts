export type LogTimelineSortDirection = "desc" | "asc";

export type LogTimelineTone = "info" | "warn" | "danger" | "success";

export type LogTimelineSource = "transition" | "event";

export type LogTimelineItem = {
  id: string;
  source: LogTimelineSource;
  tone: LogTimelineTone;
  title: string;
  message: string;
  occurredAt: string;
  sequence: number;
  context: string[];
};

type TransitionInput = {
  taskId: string;
  traceId: string;
  from: string;
  to: string;
  reason: string;
  operator: string;
  timestamp: string;
};

type LiveEventInput = {
  id: string;
  eventType: string;
  message?: string;
  traceId: string;
  taskId?: string;
  createdAt?: string;
  data?: Record<string, unknown>;
};

export type BuildLogTimelineInput = {
  transitions?: TransitionInput[];
  liveEvents?: LiveEventInput[];
};

export function buildLogTimelineItems(input: BuildLogTimelineInput): LogTimelineItem[] {
  let sequence = 0;
  const items: LogTimelineItem[] = [];

  for (const [index, transition] of (input.transitions ?? []).entries()) {
    const timestamp = transition.timestamp?.trim() ?? "";
    items.push({
      id: `transition:${transition.taskId}:${timestamp || "missing"}:${index}`,
      source: "transition",
      tone: classifyTransitionTone(transition.to),
      title: `${transition.from} → ${transition.to}`,
      message: transition.reason || transition.operator,
      occurredAt: timestamp,
      sequence: sequence++,
      context: [transition.operator].filter(Boolean)
    });
  }

  for (const event of input.liveEvents ?? []) {
    const phase = readEventPhase(event);
    items.push({
      id: `event:${event.id}`,
      source: "event",
      tone: classifySignalTone(event.eventType),
      title: formatEventTypeLabel(event.eventType),
      message: event.message?.trim() || event.traceId,
      occurredAt: event.createdAt?.trim() ?? "",
      sequence: sequence++,
      context: [phase ? `phase:${phase}` : null, event.traceId].filter((item): item is string => Boolean(item))
    });
  }

  return sortLogTimelineItems(items, "desc");
}

export function sortLogTimelineItems(
  items: LogTimelineItem[],
  direction: LogTimelineSortDirection = "desc"
): LogTimelineItem[] {
  return [...items].sort((left, right) => compareTimelineItems(left, right, direction));
}

function compareTimelineItems(
  left: LogTimelineItem,
  right: LogTimelineItem,
  direction: LogTimelineSortDirection
): number {
  const leftTime = parseOccurredAt(left.occurredAt);
  const rightTime = parseOccurredAt(right.occurredAt);
  const leftMissing = leftTime === null;
  const rightMissing = rightTime === null;

  if (leftMissing && rightMissing) {
    return direction === "desc" ? left.sequence - right.sequence : right.sequence - left.sequence;
  }
  if (leftMissing) {
    return 1;
  }
  if (rightMissing) {
    return -1;
  }
  if (leftTime !== rightTime) {
    return direction === "desc" ? rightTime - leftTime : leftTime - rightTime;
  }
  return direction === "desc" ? right.sequence - left.sequence : left.sequence - right.sequence;
}

function parseOccurredAt(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function classifySignalTone(signal: string): LogTimelineTone {
  const normalized = signal.toLowerCase();
  if (
    normalized.includes("failed")
    || normalized.includes("error")
    || normalized.includes("stderr")
    || normalized.includes("blocked")
    || normalized.includes("needs_human")
  ) {
    return "danger";
  }
  if (normalized.includes("retry") || normalized.includes("block") || normalized.includes("repair")) {
    return "warn";
  }
  if (normalized.includes("succeeded") || normalized.includes("completed")) {
    return "success";
  }
  return "info";
}

function classifyTransitionTone(targetStatus: string): LogTimelineTone {
  const normalized = targetStatus.toLowerCase();
  if (normalized === "failed" || normalized === "waiting" || normalized === "cancelled") {
    return "danger";
  }
  if (normalized === "active") {
    return "warn";
  }
  if (normalized === "succeeded") {
    return "success";
  }
  return "info";
}

function formatEventTypeLabel(eventType: string): string {
  return eventType.replaceAll(".", " / ");
}

function readEventPhase(event: LiveEventInput): "programming" | "quality" | null {
  const phase = event.data?.phase;
  if (phase === "programming" || phase === "quality") {
    return phase;
  }
  const correlation = event.data?.correlation;
  if (!correlation || typeof correlation !== "object") {
    return null;
  }
  const correlationPhase = (correlation as Record<string, unknown>).phase;
  return correlationPhase === "programming" || correlationPhase === "quality" ? correlationPhase : null;
}
