import { DependencyCheckRegistry } from "./dependency-checks/registry";
import { buildDependencyCheckProviders } from "./dependency-checks/providers";
import { DependencyCheckService } from "./dependency-checks/service";
import { sanitizeDependencyCheck } from "./dependency-checks/types";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("DependencyCheckRegistry", () => {
  it("returns checks filtered by required task scope", async () => {
    const registry = new DependencyCheckRegistry([
      {
        id: "codex",
        category: "coding-agent",
        label: "Codex CLI",
        async check() {
          return {
            id: "codex-runtime",
            category: "coding-agent" as const,
            label: "Codex CLI",
            description: "OpenAI Codex CLI",
            status: "ready" as const,
            required: false,
            requiredFor: ["programming"],
            items: [{ id: "installed", label: "Installed", status: "ready" as const, detail: "codex 0.139.0" }],
            publicMetadata: { cliName: "codex", version: "0.139.0" }
          };
        }
      },
      {
        id: "gitlab",
        category: "platform",
        label: "GitLab CLI",
        async check() {
          return {
            id: "gitlab-auth",
            category: "platform" as const,
            label: "GitLab CLI",
            description: "GitLab merge request actions",
            status: "blocked" as const,
            required: false,
            requiredFor: ["pull-request"],
            items: [{ id: "signed-in", label: "Signed in", status: "blocked" as const, detail: "not authenticated" }]
          };
        }
      }
    ]);

    const checks = await registry.list({ requiredFor: "programming" });

    expect(checks).toHaveLength(1);
    expect(checks[0]).toMatchObject({ id: "codex-runtime", category: "coding-agent", status: "ready" });
  });

  it("redacts raw output and short-lived auth codes from public details", () => {
    const sanitized = sanitizeDependencyCheck({
      id: "gitlab-auth",
      category: "platform",
      label: "GitLab CLI",
      description: "GitLab CLI auth",
      status: "blocked",
      required: true,
      requiredFor: ["pull-request"],
      items: [
        {
          id: "auth",
          label: "Signed in",
          status: "blocked",
          detail: "raw stderr token=secret device_code=ABCD user_code=WXYZ auth file /Users/me/.config/glab-cli/config.yml"
        }
      ],
      publicMetadata: {
        cliName: "glab",
        version: "1.0.0",
        configKey: "GITLAB_CLI_BIN",
        docsUrl: "https://gitlab.com/gitlab-org/cli",
        rawOutput: "token=secret"
      } as Record<string, string>
    });

    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("ABCD");
    expect(serialized).not.toContain("WXYZ");
    expect(serialized).not.toContain(".config");
    expect(sanitized.publicMetadata).toEqual({
      cliName: "glab",
      version: "1.0.0",
      configKey: "GITLAB_CLI_BIN",
      docsUrl: "https://gitlab.com/gitlab-org/cli"
    });
  });
});

describe("buildDependencyCheckProviders", () => {
  it("maps task integration, platform, and coding runtime plugins into dependency checks", async () => {
    const providers = buildDependencyCheckProviders({
      plugins: [
        {
          id: "meegle",
          kind: "task-integration",
          priority: 100,
          capabilities: [],
          async health() {
            return { healthy: false, message: "auth_required: run `meegle auth login`" };
          }
        },
        {
          id: "gitlab",
          kind: "platform",
          priority: 100,
          capabilities: [],
          async health() {
            return { healthy: true, message: "authenticated on gitlab.example.com" };
          }
        },
        {
          id: "codex",
          kind: "agent",
          priority: 100,
          capabilities: ["execute"],
          runtimeProviderId: "codex",
          async health() {
            return { healthy: true, message: "configured with binary /opt/bin/codex" };
          }
        }
      ]
    });

    const checks = await Promise.all(providers.map((provider) => provider.check()));

    expect(checks.map((check) => check.id)).toEqual(expect.arrayContaining(["meegle-auth", "gitlab-auth", "codex-runtime"]));
    expect(checks.map((check) => check.id)).not.toContain("openspec-tooling");
    expect(checks.find((check) => check.id === "meegle-auth")).toMatchObject({
      status: "blocked",
      action: { kind: "auth", target: "meegle" }
    });
    expect(checks.find((check) => check.id === "gitlab-auth")).toMatchObject({
      status: "ready",
      items: [
        expect.objectContaining({ id: "cli", label: "CLI available", status: "ready" }),
        expect.objectContaining({ id: "auth", label: "Signed in", status: "ready" })
      ]
    });
    expect(checks.find((check) => check.id === "codex-runtime")).toMatchObject({
      category: "coding-agent",
      requiredFor: ["programming"],
      items: [expect.objectContaining({ id: "cli", label: "CLI available", status: "ready" })]
    });
  });

  it("reports GitLab CLI availability separately from authorization", async () => {
    const providers = buildDependencyCheckProviders({
      plugins: [
        {
          id: "gitlab",
          kind: "platform",
          priority: 100,
          capabilities: [],
          async health() {
            return { healthy: false, message: "GitLab CLI authorization required" };
          }
        }
      ]
    });

    const gitlab = await providers.find((provider) => provider.id === "gitlab-auth")?.check();

    expect(gitlab).toMatchObject({
      status: "blocked",
      items: [
        expect.objectContaining({ id: "cli", label: "CLI available", status: "ready" }),
        expect.objectContaining({ id: "auth", label: "Signed in", status: "blocked" })
      ],
      action: { kind: "auth", target: "gitlab" }
    });
  });

  it("adds a GitLab CLI check from config when the runtime plugin is missing", async () => {
    const sandbox = await mkdtemp(join(tmpdir(), "diting-gitlab-dependency-"));
    const bin = join(sandbox, "fake-glab");
    await writeFile(bin, `#!/usr/bin/env bash
if [ "$1" = "--version" ]; then
  echo "glab version 1.2.3"
  exit 0
fi
if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  echo "authenticated"
  exit 0
fi
exit 1
`);
    await chmod(bin, 0o755);
    const providers = buildDependencyCheckProviders({
      plugins: [],
      gitlab: { cliBin: bin, host: "gitlab.example.com" }
    });

    const gitlab = await providers.find((provider) => provider.id === "gitlab-auth")?.check();

    expect(gitlab).toMatchObject({
      id: "gitlab-auth",
      label: "GitLab CLI",
      status: "ready",
      items: [
        expect.objectContaining({ id: "cli", label: "CLI available", status: "ready" }),
        expect.objectContaining({ id: "auth", label: "Signed in", status: "ready" })
      ]
    });
  });

  it("uses programming runtime checks instead of OpenSpec product runtime checks", async () => {
    const providers = buildDependencyCheckProviders({
      plugins: [
        {
          id: "codex",
          kind: "agent",
          priority: 100,
          capabilities: ["programming", "codex"],
          runtimeProviderId: "codex",
          async health() {
            return { healthy: true, message: "Codex configured with binary /opt/bin/codex" };
          }
        },
        {
          id: "openspec-product-codex",
          kind: "agent",
          priority: 101,
          capabilities: ["product", "openspec", "codex"],
          runtimeProviderId: "codex",
          async health() {
            return { healthy: false, message: "OpenSpec Product Codex is unavailable" };
          }
        }
      ]
    });

    const codex = await providers.find((provider) => provider.id === "codex-runtime")?.check();

    expect(codex).toMatchObject({
      label: "Codex CLI",
      status: "ready",
      items: [expect.objectContaining({ id: "cli", detail: "Codex configured with binary /opt/bin/codex" })]
    });
    expect(JSON.stringify(codex)).not.toContain("OpenSpec Product Codex");
  });

  it("marks a runtime ready when any discovered source is available", async () => {
    const providers = buildDependencyCheckProviders({
      plugins: [
        {
          id: "codex-path",
          kind: "agent",
          priority: 120,
          capabilities: ["programming", "codex"],
          runtimeProviderId: "codex",
          async health() {
            return { healthy: true, message: "Codex configured with binary /opt/homebrew/bin/codex" };
          }
        },
        {
          id: "codex-known-missing",
          kind: "agent",
          priority: 110,
          capabilities: ["programming", "codex"],
          runtimeProviderId: "codex",
          async health() {
            return { healthy: false, message: "Codex (/usr/bin/codex) is unavailable" };
          }
        }
      ]
    });

    const codex = await providers.find((provider) => provider.id === "codex-runtime")?.check();

    expect(codex).toMatchObject({
      status: "ready",
      items: [expect.objectContaining({
        id: "cli",
        status: "ready",
        detail: "Codex configured with binary /opt/homebrew/bin/codex"
      })]
    });
  });
});

describe("DependencyCheckService", () => {
  it("does not degrade programming dependencies when either Codex or Cursor is available", async () => {
    const service = new DependencyCheckService([
      {
        id: "codex",
        kind: "agent",
        priority: 100,
        capabilities: ["programming", "codex"],
        runtimeProviderId: "codex",
        async health() {
          return { healthy: false, message: "Codex CLI is unavailable" };
        }
      },
      {
        id: "cursor",
        kind: "agent",
        priority: 90,
        capabilities: ["programming", "cursor"],
        runtimeProviderId: "cursor",
        async health() {
          return { healthy: true, message: "Cursor configured with binary /usr/local/bin/cursor-agent" };
        }
      }
    ]);

    const summary = await service.list();

    expect(summary.degraded).toBe(false);
    expect(summary.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "codex-runtime", status: "blocked" }),
      expect.objectContaining({ id: "cursor-runtime", status: "ready" })
    ]));
  });
});
