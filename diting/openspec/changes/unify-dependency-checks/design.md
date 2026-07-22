# unify-dependency-checks Design

## Confirmed Inputs

- Superpowers design approved: `docs/superpowers/specs/2026-07-08-unify-dependency-checks-design.md`.
- User-confirmed strategy: startup shows dependency-check degraded status without globally blocking service readiness; task start blocks only dependencies required by that task.
- User-confirmed UI reference: Drydock-style modal with ready progress, grouped dependency cards, child status lines, re-check, skip, and sign-in/configuration actions.

## Architecture

Add a server-side dependency check layer:

- `DependencyCheckRegistry`: registers providers and returns sanitized dependency check results.
- `DependencyCheckProvider`: maps each dependency family to a check result, including Meegle auth, GitLab CLI/auth, and Codex/Cursor CLI availability.
- `DependencyCheckService`: exposes list/recheck behavior to HTTP routes and required dependency checks to preflight.
- HTTP routes: `GET /api/dependency-checks` and `POST /api/dependency-checks/recheck`.

Task gating must reuse the existing preflight chain:

- `TitingServices.submitTask()` records preflight results and moves blocked tasks to `waiting`.
- `ServiceExecution.ensurePreflightBeforeEnvironment()` re-runs preflight before workspace preparation.
- `ServiceScheduler.runProgrammingHandoffPreflight()` covers product-to-programming handoff.

The web console adds a dependency check modal:

- Entry points: dashboard/readiness area, task sync warning, plugins/settings area.
- Groups: `Coding Agents`, `Task Integrations`, `Platform / Repository`, `Environment`.
- Card details: Required / Optional, status badge, description, child status items, and action button.
- Actions: recheck calls dependency API; Meegle/GitLab authorization reuses existing `/api/integrations/*/auth/start|poll`; skip only closes the modal.

## Public Result Model

Dependency check public output uses a safe whitelist:

```ts
type DependencyCheckStatus = "ready" | "warning" | "blocked" | "checking" | "unknown" | "unverified";

interface DependencyCheckResult {
  id: string;
  category: "coding-agent" | "task-integration" | "platform" | "openspec" | "environment";
  label: string;
  description: string;
  status: DependencyCheckStatus;
  required: boolean;
  optionalReason?: string;
  requiredFor: string[];
  items: Array<{
    id: string;
    label: string;
    status: DependencyCheckStatus;
    detail: string;
  }>;
  action?: {
    kind: "auth" | "configure" | "install" | "open-settings" | "external-doc";
    label: string;
    target: string;
  };
  lastCheckedAt?: string;
  publicMetadata?: {
    cliName?: string;
    version?: string;
    configKey?: string;
    docsUrl?: string;
  };
}
```

`GET /api/dependency-checks` and recheck results must not return token values, short-lived device/user codes, full accounts, raw stdout/stderr, authentication file paths, or sensitive command lines. Existing authorization start/poll APIs may continue to return short-lived `userCode` / `deviceCode` only for the active login flow.

## Key Decisions

- Do not redefine `/api/readiness`; dependency-check degraded is a console dependency status, not global service readiness.
- Codex/Cursor checks only verify CLI availability; OpenSpec installation and validation are handled by a later workflow.
- Codex and Cursor are alternative coding runtimes for programming tasks; any ready runtime satisfies the programming dependency, and any ready discovered source satisfies that runtime.
- Reuse Meegle/GitLab authorization routes and frontend functions instead of adding another auth mechanism.
- Keep the first version internal to the server/web console; avoid adding a public plugin-api dependency check contract until external plugin requirements are concrete.
- Add timeout, caching, concurrency limits, and failure isolation around CLI-based checks during implementation.

## Tech Stack Profile

- Profile: `typescript` monorepo with npm workspaces.
- Server: `apps/server`, Jest, Fastify.
- Web: `apps/web`, React 19, Vite, Vitest / Testing Library.
- Core: `packages/core`, existing task lifecycle and preflight behavior.

## Risks And Constraints

- CLI auth detection differs across Codex, Cursor, and other runtimes.
- Dependency check results must be sanitized before returning to the UI or writing logs.
- OpenSpec CLI validate/archive remains user/platform driven.
- UI verification should use the target web console H5 entry with Playwright in VerifyAndReview.

## Open Questions

- Whether dependency check results should be persisted or cached only in memory.
- Whether `Skip for now` should be remembered per browser session.
- Whether external plugins should eventually expose a dependency check provider contract.
