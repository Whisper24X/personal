import { describe, expect, it } from "vitest";
import { buildLogTimelineItems, sortLogTimelineItems } from "./log-timeline";

describe("log timeline", () => {
  it("normalizes lifecycle transitions and live events newest first by default", () => {
    const items = buildLogTimelineItems({
      transitions: [{
        taskId: "task-1",
        traceId: "trace-1",
        from: "running",
        to: "failed",
        reason: "test failed",
        operator: "controller",
        timestamp: "2026-06-23T09:10:00.000Z"
      }],
      liveEvents: [{
        id: "event-1",
        eventType: "execution.retry_scheduled",
        message: "retry scheduled",
        traceId: "trace-1",
        taskId: "task-1",
        createdAt: "2026-06-23T09:11:00.000Z"
      }]
    });

    expect(items.map((item) => item.id)).toEqual([
      "event:event-1",
      "transition:task-1:2026-06-23T09:10:00.000Z:0"
    ]);
    expect(items[0].tone).toBe("warn");
    expect(items[1].tone).toBe("danger");
  });

  it("can sort from the beginning", () => {
    const sorted = sortLogTimelineItems([
      {
        id: "new",
        source: "event",
        tone: "info",
        title: "new event",
        message: "newest event",
        occurredAt: "2026-06-23T09:11:00.000Z",
        sequence: 1,
        context: []
      },
      {
        id: "old",
        source: "transition",
        tone: "info",
        title: "old transition",
        message: "oldest transition",
        occurredAt: "2026-06-23T09:09:00.000Z",
        sequence: 0,
        context: []
      }
    ], "asc");

    expect(sorted.map((item) => item.id)).toEqual(["old", "new"]);
  });

  it("keeps missing timestamps at the end in newest-first mode", () => {
    const sorted = sortLogTimelineItems([
      {
        id: "missing",
        source: "event",
        tone: "info",
        title: "missing time",
        message: "no timestamp",
        occurredAt: "",
        sequence: 0,
        context: []
      },
      {
        id: "timed",
        source: "transition",
        tone: "info",
        title: "timed transition",
        message: "has timestamp",
        occurredAt: "2026-06-23T09:10:00.000Z",
        sequence: 1,
        context: []
      }
    ], "desc");

    expect(sorted.map((item) => item.id)).toEqual(["timed", "missing"]);
  });

  it("adds agent phase to live event context when present", () => {
    const items = buildLogTimelineItems({
      liveEvents: [{
        id: "event-quality",
        eventType: "quality.started",
        message: "quality started",
        traceId: "trace-1",
        taskId: "task-1",
        createdAt: "2026-06-23T09:11:00.000Z",
        data: { phase: "quality" }
      }]
    });

    expect(items[0]?.context).toEqual(["phase:quality", "trace-1"]);
  });
});
