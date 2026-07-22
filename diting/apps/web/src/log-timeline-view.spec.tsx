import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider } from "./i18n";
import { LogTimelineView } from "./log-timeline-view";
import type { LogTimelineItem } from "./log-timeline";

const sampleItems: LogTimelineItem[] = [
  {
    id: "event:new",
    source: "event",
    tone: "danger",
    title: "execution / failed",
    message: "latest failure",
    occurredAt: "2026-06-23T09:11:00.000Z",
    sequence: 1,
    context: ["trace-1"]
  },
  {
    id: "transition:old",
    source: "transition",
    tone: "info",
    title: "ready → active",
    message: "oldest transition",
    occurredAt: "2026-06-23T09:09:00.000Z",
    sequence: 0,
    context: []
  }
];

function renderTimeline(items = sampleItems) {
  return render(
    <I18nProvider>
      <LogTimelineView
        formatDate={(value) => value}
        items={items}
      />
    </I18nProvider>
  );
}

describe("LogTimelineView", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows newest entries first by default", () => {
    renderTimeline();
    const titles = screen.getAllByText(/execution \/ failed|ready → active/).map((node) => node.textContent);
    expect(titles[0]).toContain("execution / failed");
  });

  it("switches to chronological replay", () => {
    renderTimeline();
    fireEvent.click(screen.getByRole("button", { name: /view from start/i }));
    const titles = screen.getAllByText(/execution \/ failed|ready → active/).map((node) => node.textContent);
    expect(titles[0]).toContain("ready → active");
  });

  it("applies danger styling to failed entries", () => {
    renderTimeline();
    expect(document.querySelector(".log-timeline-tone-danger")).not.toBeNull();
  });

  it("shows empty state when there are no entries", () => {
    renderTimeline([]);
    expect(screen.getByText(/no timeline entries yet/i)).not.toBeNull();
  });
});
