import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DependencyCheckModal } from "./dependency-check-modal";
import type { DependencyCheckSummary } from "./dependency-checks";

const summary: DependencyCheckSummary = {
  ready: 2,
  total: 3,
  degraded: true,
  checks: [
    {
      id: "codex-runtime",
      category: "coding-agent",
      label: "Codex CLI",
      description: "OpenAI Codex CLI",
      status: "ready",
      required: true,
      requiredFor: ["programming"],
      items: [{ id: "cli", label: "CLI available", status: "ready", detail: "codex 0.139.0" }]
    },
    {
      id: "meegle-auth",
      category: "task-integration",
      label: "Meegle CLI",
      description: "Meegle task intake",
      status: "ready",
      required: false,
      requiredFor: ["task-sync"],
      items: [{ id: "signed-in", label: "Signed in", status: "ready", detail: "authenticated" }]
    },
    {
      id: "gitlab-auth",
      category: "platform",
      label: "GitLab CLI",
      description: "GitLab merge requests",
      status: "blocked",
      required: false,
      requiredFor: ["pull-request"],
      items: [
        { id: "cli", label: "CLI available", status: "ready", detail: "glab found" },
        { id: "auth", label: "Signed in", status: "blocked", detail: "GitLab CLI authorization required" }
      ],
      action: { kind: "auth", label: "Authorize GitLab", target: "gitlab" }
    }
  ]
};

afterEach(() => {
  cleanup();
});

describe("DependencyCheckModal", () => {
  it("renders dependency progress and grouped cards", () => {
    render(<DependencyCheckModal isOpen summary={summary} onAction={() => undefined} onClose={() => undefined} onRecheck={() => undefined} />);

    expect(screen.getByText("2/3 ready")).toBeInTheDocument();
    expect(screen.getByText("Coding Agents")).toBeInTheDocument();
    expect(screen.getByText("Task Integrations")).toBeInTheDocument();
    expect(screen.getByText("Platform / Repository")).toBeInTheDocument();
    expect(screen.queryByText("OpenSpec Tooling")).not.toBeInTheDocument();
    expect(screen.getByText("Codex CLI")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getAllByText("Optional")).toHaveLength(2);
    expect(screen.getByText("Authorize GitLab")).toBeInTheDocument();
    expect(screen.queryByText(/Finish the highlighted steps/i)).not.toBeInTheDocument();
  });

  it("invokes action, recheck, and close callbacks", () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    const onRecheck = vi.fn();
    render(<DependencyCheckModal isOpen summary={summary} onAction={onAction} onClose={onClose} onRecheck={onRecheck} />);

    fireEvent.click(screen.getByText("Authorize GitLab"));
    fireEvent.click(screen.getByText("Re-check"));
    fireEvent.click(screen.getByText("Skip for now"));

    expect(onAction).toHaveBeenCalledWith("gitlab");
    expect(onRecheck).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps skip local to the modal state", () => {
    const onClose = vi.fn();
    render(<DependencyCheckModal isOpen summary={summary} onAction={() => undefined} onClose={onClose} onRecheck={() => undefined} />);

    fireEvent.click(screen.getByText("Skip for now"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("3/3 ready")).not.toBeInTheDocument();
  });
});
