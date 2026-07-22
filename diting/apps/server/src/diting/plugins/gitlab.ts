import { FastifyInstance, FastifyReply } from "fastify";
import { PluginHealth } from "@diting/plugin-api";
import { ServerConfig } from "../config";
import { HttpPluginContext, HttpRoutePlugin } from "../http-plugin";
import {
  buildCliNotFoundMessage,
  isCliBinaryMissing,
  runCommand
} from "./shared";

export type GitLabAuthStatus = {
  status: "authenticated" | "unauthenticated";
  authenticated: boolean;
  host: string;
  message: string;
};

export type GitLabAuthStartResult = {
  status: "pending";
  authenticated: false;
  authorizationUrl: string;
  userCode: string;
  host: string;
  intervalSeconds: number;
  message: string;
};

export type GitLabAuthPollResult = {
  status: "pending" | "authenticated" | "failed";
  authenticated: boolean;
  host: string;
  message: string;
};

export class GitLabCliNotFoundError extends Error {
  readonly code = "GITLAB_CLI_NOT_FOUND";

  constructor(message: string) {
    super(message);
    this.name = "GitLabCliNotFoundError";
  }
}

/** GitLab CLI health/auth surface for MR creation prerequisites. */
export class GitLabCliIntegrationPlugin implements HttpRoutePlugin {
  readonly id = "gitlab";
  readonly kind = "platform" as const;
  readonly priority = 90;
  readonly capabilities = ["gitlab", "merge-request", "cli-auth"];

  constructor(private readonly config: ServerConfig) {}

  async health(): Promise<PluginHealth> {
    const status = await this.getAuthStatus();
    if (status.authenticated) {
      return { healthy: true, message: `GitLab CLI integration ready for ${status.host}` };
    }
    return {
      healthy: false,
      message: `${status.message}. Run \`${this.loginCommand()}\` to authorize GitLab CLI.`
    };
  }

  async getAuthStatus(): Promise<GitLabAuthStatus> {
    const result = await runCommand(this.gitlabBin(), ["auth", "status", "--hostname", this.gitlabHost()], process.cwd(), 30_000);
    if (result.exitCode === 0) {
      return {
        status: "authenticated",
        authenticated: true,
        host: this.gitlabHost(),
        message: "GitLab CLI is authenticated"
      };
    }
    return {
      status: "unauthenticated",
      authenticated: false,
      host: this.gitlabHost(),
      message: isCliBinaryMissing(result)
        ? buildCliNotFoundMessage("GitLab", this.gitlabBin(), "GITLAB_CLI_BIN")
        : (result.stderr.trim() || result.stdout.trim() || "GitLab CLI authorization required")
    };
  }

  async startAuth(): Promise<GitLabAuthStartResult> {
    const result = await runCommand(this.gitlabBin(), ["auth", "login", "--hostname", this.gitlabHost(), "--device"], process.cwd(), 30_000);
    if (result.exitCode !== 0 && !result.timedOut) {
      if (isCliBinaryMissing(result)) {
        throw new GitLabCliNotFoundError(buildCliNotFoundMessage("GitLab", this.gitlabBin(), "GITLAB_CLI_BIN"));
      }
      throw new Error(result.stderr.trim() || result.stdout.trim() || "GitLab authorization initialization failed");
    }
    const parsed = parseGitLabDeviceAuthOutput(`${result.stdout}\n${result.stderr}`);
    if (!parsed.authorizationUrl || !parsed.userCode) {
      throw new Error(`GitLab device authorization output is missing URL or code. Run \`${this.loginCommand()}\` manually.`);
    }
    return {
      status: "pending",
      authenticated: false,
      authorizationUrl: parsed.authorizationUrl,
      userCode: parsed.userCode,
      host: this.gitlabHost(),
      intervalSeconds: 5,
      message: "Open the authorization URL and enter the GitLab device code"
    };
  }

  async pollAuth(): Promise<GitLabAuthPollResult> {
    const status = await this.getAuthStatus();
    if (status.authenticated) {
      return {
        status: "authenticated",
        authenticated: true,
        host: status.host,
        message: status.message
      };
    }
    return {
      status: "pending",
      authenticated: false,
      host: status.host,
      message: status.message
    };
  }

  async logoutAuth(): Promise<{ ok: boolean; message: string }> {
    const result = await runCommand(this.gitlabBin(), ["auth", "logout", "--hostname", this.gitlabHost()], process.cwd(), 30_000);
    if (result.exitCode !== 0) {
      if (isCliBinaryMissing(result)) {
        throw new GitLabCliNotFoundError(buildCliNotFoundMessage("GitLab", this.gitlabBin(), "GITLAB_CLI_BIN"));
      }
      throw new Error(result.stderr.trim() || result.stdout.trim() || "GitLab logout failed");
    }
    return { ok: true, message: "GitLab CLI logged out" };
  }

  registerRoutes(fastify: FastifyInstance, _context: HttpPluginContext): void {
    fastify.get("/api/integrations/gitlab/auth/status", async () => this.getAuthStatus());
    fastify.post("/api/integrations/gitlab/auth/start", async (_request, reply: FastifyReply) => {
      try {
        return await this.startAuth();
      } catch (error) {
        if (error instanceof GitLabCliNotFoundError) {
          return reply.status(503).send({ error: error.message });
        }
        throw error;
      }
    });
    fastify.post("/api/integrations/gitlab/auth/poll", async () => this.pollAuth());
    fastify.post("/api/integrations/gitlab/auth/logout", async (_request, reply: FastifyReply) => {
      try {
        return await this.logoutAuth();
      } catch (error) {
        if (error instanceof GitLabCliNotFoundError) {
          return reply.status(503).send({ error: error.message });
        }
        throw error;
      }
    });
  }

  private gitlabBin(): string {
    return this.config.plugins.gitlab.cliBin;
  }

  private gitlabHost(): string {
    return this.config.plugins.gitlab.host;
  }

  private loginCommand(): string {
    return `${this.gitlabBin()} auth login --hostname ${this.gitlabHost()} --device`;
  }
}

function parseGitLabDeviceAuthOutput(output: string): { authorizationUrl?: string; userCode?: string } {
  const authorizationUrl = output.match(/https?:\/\/[^\s)]+/)?.[0];
  const userCode = output.match(/\bcode\s+([A-Z0-9-]{4,})\b/i)?.[1]
    ?? output.match(/\benter\s+([A-Z0-9-]{4,})\b/i)?.[1];
  return { authorizationUrl, userCode };
}
