import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import os from 'os';
import type { RunnerOrchestrationConfig } from '../containers/runner-orchestration.types';
import { AgentCliAdapterRegistry } from '../agent-execution/agent-cli/agent-cli-adapter.registry';
import { sanitizeAgentToolConfigJson } from '../agent-execution/agent-cli-sanitize-config';
import { AgentToolConfigRepository } from './infrastructure/persistence/agent-tool-config.repository';
import { BusinessLineRepository } from './infrastructure/persistence/business-line.repository';
import {
  extractJsonFromAgentOutput,
  maskSecrets,
} from '../utils/agent-output-json-extractor';
import type { RepoFacts } from './repo-facts-collector';
import type {
  AiCandidateSelection,
  RetryConstraints,
  RunnerCandidateManifest,
} from './service-candidate-builder';
import { validateAiCandidateSelection } from './service-candidate-builder';

export interface AiGenerationResult {
  orchestration: RunnerOrchestrationConfig | null;
  warnings: string[];
  source: 'ai';
  generatorToolId?: string;
  generatorConfigId?: string;
}

export interface AiCandidateSelectionResult {
  selection: AiCandidateSelection | null;
  warnings: string[];
  source: 'ai';
  generatorToolId?: string;
  generatorConfigId?: string;
}

export interface AiFullScanGenerationResult {
  orchestration: RunnerOrchestrationConfig | null;
  warnings: string[];
  source: 'ai-full-scan';
  reasoningSummary?: string;
  generatorToolId?: string;
  generatorConfigId?: string;
}

export interface RunnerWorkspaceScanRequest {
  workspacePath: string;
  repoPrefixes: string[];
  previousErrors?: string[];
}

type RunnerGenerationToolSource =
  | 'explicit_runner_config'
  | 'business_line_default_tool'
  | 'fallback_codex'
  | 'fallback_opencode'
  | 'fallback_after_runtime_error';

type ResolvedRunnerGenerationToolConfig = {
  id: string;
  toolId: string;
  configJson: Record<string, unknown>;
  source: RunnerGenerationToolSource;
  warnings: string[];
};

const AI_TIMEOUT_MS = 30_000;
const FULL_SCAN_AI_TIMEOUT_MS = 300_000;

const RUNNER_CONFIG_PROMPT = `You are a DevOps configuration assistant. Analyze the following repository metadata and generate a RunnerOrchestrationConfig JSON object.

Rules:
- service.name must be a stable slug from the repo prefix or app name (only [a-zA-Z0-9_.-])
- service.workdir must be relative to workspace root, usually equals the repo prefix
- Do NOT use absolute paths
- Do NOT include secrets or environment-specific values
- Only generate: services, routes, homepage, preview
- Do NOT generate: sharedVolumes, runtime fields, project fields
- Output JSON only, no markdown wrapping, no explanation

Schema:
{
  "services": [{ "name": string, "workdir": string, "command": string, "port"?: number, "installCommand"?: string, "installCheckPath"?: string }],
  "routes"?: [{ "path": string, "action": "proxy", "match": "prefix", "service": string }],
  "preview"?: { "service": string, "path": string }
}

Repository facts:
`;

const CANDIDATE_SELECTION_PROMPT = `You are a DevOps runner candidate arbiter. Choose from the provided candidate IDs only.

Rules:
- Do NOT invent command, port, workdir, route, service name, or JSON fields outside the schema.
- selectedServiceCandidateIds MUST contain existing candidate IDs only.
- previewServiceCandidateId MUST be one of selectedServiceCandidateIds and should prefer HTTP or WebSocket preview-capable candidates.
- Avoid grpc, metrics, database, raw tcp, and runner listen ports for preview.
- If retryConstraints are provided, obey them strictly.
- Output JSON only, no markdown wrapping, no explanation outside JSON.

Schema:
{
  "selectedServiceCandidateIds": string[],
  "previewServiceCandidateId"?: string,
  "routePreference"?: "single-root" | "per-service",
  "confidence": number,
  "reasoningSummary"?: string
}

Candidate manifest:
`;

const FULL_SCAN_PROMPT = `You are a DevOps runner configuration generator. You are running inside a cloned multi-repo workspace and must inspect the workspace files yourself before producing the final RunnerOrchestrationConfig used by runtime.

Rules:
- Generate a complete RunnerOrchestrationConfig JSON object for the application preview.
- service.workdir must be relative to /workspace and usually starts with the repo prefix.
- Scan only the repos explicitly listed below.
- Inspect the workspace directly. Prioritize package.json scripts, README.md, Makefile, Dockerfile, go.mod, cmd/*/main.go, vite.config.*, rsbuild.config.*, next.config.*, nuxt.config.*, and config/**/*.{ts,js,mjs,cjs,yaml,yml}.
- Prefer commands that start an HTTP preview/dev server and bind to 0.0.0.0 when the framework requires it.
- Include runnable backend or API services when they expose HTTP traffic or are likely required by sibling frontends. Go/Kratos/Gin/FastAPI/Nest services with a runnable command and an HTTP port count as must-start services.
- Do NOT omit a repo that has a runnable command plus an HTTP port unless the command or port truly cannot be determined safely.
- You may include service.env when a frontend requires base-path or API-base variables to run correctly under a sub-path preview.
- If there are multiple preview-capable services, generate a homepage at "/" and generate explicit per-service routes such as "/yanxue/", "/trip-shadow/", "/trip-miniprogram/".
- In a multi-service config, homepage.links MUST point to per-service paths and MUST NOT point to "/".
- When a homepage exists, every routed HTTP service must have its own homepage link so the preview panel can open it explicitly.
- In a multi-service config, each per-service proxy route should proxy to the service root by setting upstreamPath to "/".
- You may use exact, prefix, or regex routes, and you may use redirect routes when a frontend needs a trailing-slash redirect or dedicated static/HMR paths.
- Do NOT collapse multiple services into a single "/" proxy route unless there is exactly one preview-capable service.
- In a multi-service config with a homepage, preview.path MUST be "/" so the main preview opens the service navigation page first.
- Do NOT include secrets, .env values, runtime fields, project fields, explanations outside JSON, or markdown.
- Do NOT use grpc, metrics, database, raw tcp, or runner listen ports for preview.
- Every discovered repo should either appear in services/routes/homepage.links or be omitted only when the evidence is insufficient to start it safely.
- Output JSON only. The response may be either the config itself or {"orchestration": <config>, "reasoningSummary": string}.

Allowed config shape:
{
  "services": [{ "name": string, "workdir": string, "command": string, "port": number, "env"?: Record<string, string>, "installCommand"?: string, "installCheckPath"?: string }],
  "routes": [{ "path": string, "action": "proxy" | "redirect", "match": "prefix" | "exact" | "regex", "service"?: string, "upstreamPath"?: string, "websocket"?: boolean, "redirectTo"?: string, "redirectCode"?: number }],
  "homepage"?: { "title"?: string, "description"?: string, "links"?: [{ "label": string, "path": string }] },
  "preview": { "service": string, "path": string }
}`;

@Injectable()
export class AiRunnerConfigGenerator {
  private readonly logger = new Logger(AiRunnerConfigGenerator.name);

  constructor(
    private readonly agentCliAdapterRegistry: AgentCliAdapterRegistry,
    private readonly agentToolConfigRepository: AgentToolConfigRepository,
    private readonly businessLineRepository: BusinessLineRepository,
  ) {}

  async generate(
    businessLineId: string,
    facts: RepoFacts[],
  ): Promise<AiGenerationResult> {
    const warnings: string[] = [];

    const toolConfig = await this.resolveToolConfig(businessLineId);
    if (!toolConfig) {
      warnings.push('AI refinement skipped: no agent CLI configuration found');
      return { orchestration: null, warnings, source: 'ai' };
    }
    warnings.push(...toolConfig.warnings);

    const prompt = RUNNER_CONFIG_PROMPT + JSON.stringify(facts, null, 2);

    try {
      const execution = await this.invokeCliWithRuntimeFallback(
        businessLineId,
        toolConfig,
        prompt,
        warnings,
        this.resolveDefaultAiTimeoutMs(),
      );
      const stdout = execution.stdout;

      const { parsed, rawPreview, error } =
        extractJsonFromAgentOutput<RunnerOrchestrationConfig>(stdout);

      this.logger.debug(
        `AI output preview: ${maskSecrets(rawPreview.slice(0, 500))}`,
      );

      if (!parsed) {
        warnings.push(`AI output parsing failed: ${error ?? 'unknown'}`);
        return {
          orchestration: null,
          warnings,
          source: 'ai',
          generatorToolId: execution.toolConfig.toolId,
          generatorConfigId: execution.toolConfig.id,
        };
      }

      return {
        orchestration: parsed,
        warnings,
        source: 'ai',
        generatorToolId: execution.toolConfig.toolId,
        generatorConfigId: execution.toolConfig.id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      warnings.push(`AI generation failed: ${message}`);
      return {
        orchestration: null,
        warnings,
        source: 'ai',
        generatorToolId: toolConfig.toolId,
        generatorConfigId: toolConfig.id,
      };
    }
  }

  async selectCandidates(
    businessLineId: string,
    manifest: RunnerCandidateManifest,
    retryConstraints?: RetryConstraints,
  ): Promise<AiCandidateSelectionResult> {
    const warnings: string[] = [];
    const toolConfig = await this.resolveToolConfig(businessLineId);
    if (!toolConfig) {
      warnings.push(
        'AI candidate selection skipped: no agent CLI configuration found',
      );
      return { selection: null, warnings, source: 'ai' };
    }
    warnings.push(...toolConfig.warnings);

    const prompt =
      CANDIDATE_SELECTION_PROMPT +
      JSON.stringify(
        {
          retryConstraints,
          candidates: manifest.candidates.map((candidate) => ({
            id: candidate.id,
            repoPrefix: candidate.repoPrefix,
            name: candidate.name,
            workdir: candidate.workdir,
            command: candidate.command,
            port: candidate.port,
            protocol: candidate.protocol,
            confidence: candidate.confidence,
            previewCapable: candidate.previewCapable,
            evidence: candidate.evidence,
            rejectReasons: candidate.rejectReasons,
          })),
          warnings: manifest.warnings,
        },
        null,
        2,
      );

    try {
      const execution = await this.invokeCliWithRuntimeFallback(
        businessLineId,
        toolConfig,
        prompt,
        warnings,
        this.resolveDefaultAiTimeoutMs(),
      );
      const stdout = execution.stdout;
      const { parsed, rawPreview, error } =
        extractJsonFromAgentOutput<unknown>(stdout);

      this.logger.debug(
        `AI candidate selection preview: ${maskSecrets(rawPreview.slice(0, 500))}`,
      );

      if (!parsed) {
        warnings.push(
          `AI candidate selection parsing failed: ${error ?? 'unknown'}`,
        );
        return {
          selection: null,
          warnings,
          source: 'ai',
          generatorToolId: execution.toolConfig.toolId,
          generatorConfigId: execution.toolConfig.id,
        };
      }

      const validation = validateAiCandidateSelection(parsed, manifest);
      if (!validation.selection) {
        warnings.push(
          `AI candidate selection validation failed: ${validation.errors.join('; ')}`,
        );
        return {
          selection: null,
          warnings,
          source: 'ai',
          generatorToolId: execution.toolConfig.toolId,
          generatorConfigId: execution.toolConfig.id,
        };
      }

      return {
        selection: validation.selection,
        warnings,
        source: 'ai',
        generatorToolId: execution.toolConfig.toolId,
        generatorConfigId: execution.toolConfig.id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      warnings.push(`AI candidate selection failed: ${message}`);
      return {
        selection: null,
        warnings,
        source: 'ai',
        generatorToolId: toolConfig.toolId,
        generatorConfigId: toolConfig.id,
      };
    }
  }

  async generateFromFullScan(
    businessLineId: string,
    request: RunnerWorkspaceScanRequest,
  ): Promise<AiFullScanGenerationResult> {
    const warnings: string[] = [];
    const toolConfig = await this.resolveToolConfig(businessLineId);
    if (!toolConfig) {
      warnings.push('AI full scan skipped: no agent CLI configuration found');
      return { orchestration: null, warnings, source: 'ai-full-scan' };
    }
    warnings.push(...toolConfig.warnings);

    const prompt = this.buildWorkspaceScanPrompt(
      request.repoPrefixes,
      request.previousErrors ?? [],
    );

    try {
      const execution = await this.invokeCliWithRuntimeFallback(
        businessLineId,
        toolConfig,
        prompt,
        warnings,
        this.resolveFullScanTimeoutMs(),
        request.workspacePath,
      );
      const stdout = execution.stdout;
      const { parsed, rawPreview, error } =
        extractJsonFromAgentOutput<unknown>(stdout);

      this.logger.debug(
        `AI full scan output preview: ${maskSecrets(rawPreview.slice(0, 500))}`,
      );

      if (!parsed) {
        warnings.push(`AI full scan parsing failed: ${error ?? 'unknown'}`);
        return {
          orchestration: null,
          warnings,
          source: 'ai-full-scan',
          generatorToolId: execution.toolConfig.toolId,
          generatorConfigId: execution.toolConfig.id,
        };
      }

      const normalized = normalizeFullScanOutput(parsed);
      if (!normalized.orchestration) {
        warnings.push('AI full scan output did not contain orchestration JSON');
      }

      return {
        orchestration: normalized.orchestration,
        reasoningSummary: normalized.reasoningSummary,
        warnings,
        source: 'ai-full-scan',
        generatorToolId: execution.toolConfig.toolId,
        generatorConfigId: execution.toolConfig.id,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      warnings.push(`AI full scan failed: ${message}`);
      return {
        orchestration: null,
        warnings,
        source: 'ai-full-scan',
        generatorToolId: toolConfig.toolId,
        generatorConfigId: toolConfig.id,
      };
    }
  }

  private async resolveToolConfig(
    businessLineId: string,
  ): Promise<ResolvedRunnerGenerationToolConfig | null> {
    const bl = await this.businessLineRepository.findById(businessLineId);
    if (!bl) return null;

    const blConfig = (bl.configJson ?? {}) as Record<string, unknown>;
    const explicitId = blConfig.runnerGenerationAgentCliConfigId as
      | string
      | undefined;

    if (explicitId) {
      const configs =
        await this.agentToolConfigRepository.findByBusinessLineId(
          businessLineId,
        );
      const match = configs.find((c) => c.id === explicitId);
      if (match) {
        return this.createResolvedToolConfig(
          businessLineId,
          {
            id: match.id,
            toolId: match.toolId,
            configJson: this.parseConfigJson(match.configJson),
          },
          'explicit_runner_config',
        );
      }
    }

    const defaultToolId =
      typeof bl.defaultAgentCliToolId === 'string'
        ? bl.defaultAgentCliToolId.trim()
        : '';
    const warnings: string[] = [];

    if (defaultToolId) {
      const defaultToolConfig =
        await this.agentToolConfigRepository.findDefaultByBusinessLineIdAndToolId(
          businessLineId,
          defaultToolId,
        );
      if (defaultToolConfig) {
        return this.createResolvedToolConfig(
          businessLineId,
          {
            id: defaultToolConfig.id,
            toolId: defaultToolConfig.toolId,
            configJson: this.parseConfigJson(defaultToolConfig.configJson),
          },
          'business_line_default_tool',
        );
      }

      warnings.push(
        `runner_generation_default_tool_missing_default_config toolId=${defaultToolId}; falling back to built-in runner generation defaults`,
      );
    }

    const codexDefault =
      await this.agentToolConfigRepository.findDefaultByBusinessLineIdAndToolId(
        businessLineId,
        'codex',
      );
    if (codexDefault) {
      return this.createResolvedToolConfig(
        businessLineId,
        {
          id: codexDefault.id,
          toolId: codexDefault.toolId,
          configJson: this.parseConfigJson(codexDefault.configJson),
        },
        'fallback_codex',
        warnings,
      );
    }

    const opencodeDefault =
      await this.agentToolConfigRepository.findDefaultByBusinessLineIdAndToolId(
        businessLineId,
        'opencode',
      );
    if (opencodeDefault) {
      return this.createResolvedToolConfig(
        businessLineId,
        {
          id: opencodeDefault.id,
          toolId: opencodeDefault.toolId,
          configJson: this.parseConfigJson(opencodeDefault.configJson),
        },
        'fallback_opencode',
        warnings,
      );
    }

    return null;
  }

  private createResolvedToolConfig(
    businessLineId: string,
    config: {
      id: string;
      toolId: string;
      configJson: Record<string, unknown>;
    },
    source: RunnerGenerationToolSource,
    warnings: string[] = [],
  ): ResolvedRunnerGenerationToolConfig {
    const sourceWarning = this.buildToolSourceWarning(
      source,
      config.toolId,
      config.id,
    );
    this.logger.log(
      `runner_generation_tool_source businessLineId=${businessLineId} source=${source} toolId=${config.toolId} configId=${config.id}`,
    );
    return {
      ...config,
      source,
      warnings: [...warnings, sourceWarning],
    };
  }

  private buildToolSourceWarning(
    source: RunnerGenerationToolSource,
    toolId: string,
    configId: string,
  ): string {
    return `runner_generation_tool_source=${source} toolId=${toolId} configId=${configId}`;
  }

  private async invokeCliWithRuntimeFallback(
    businessLineId: string,
    toolConfig: ResolvedRunnerGenerationToolConfig,
    prompt: string,
    warnings: string[],
    timeoutMs: number,
    cwd = os.tmpdir(),
  ): Promise<{
    stdout: string;
    toolConfig: ResolvedRunnerGenerationToolConfig;
  }> {
    const candidates = await this.resolveRuntimeFallbackToolConfigs(
      businessLineId,
      toolConfig,
    );
    let lastRecoverableError: unknown;

    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      try {
        return {
          stdout: await this.invokeCliWithPrompt(
            candidate.toolId,
            candidate.configJson as Record<string, unknown>,
            prompt,
            timeoutMs,
            cwd,
          ),
          toolConfig: candidate,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!this.isRecoverableRunnerCliFailure(message)) {
          throw error;
        }

        lastRecoverableError = error;
        this.logger.warn(
          `runner_generation_runtime_fallback businessLineId=${businessLineId} fromToolId=${candidate.toolId} source=${candidate.source} reason=${message}`,
        );

        const nextCandidate = candidates[index + 1];
        if (!nextCandidate) {
          break;
        }

        warnings.push(
          `runner_generation_runtime_fallback fromToolId=${candidate.toolId} toToolId=${nextCandidate.toolId} reason=${message}`,
        );
        warnings.push(...nextCandidate.warnings);
      }
    }

    throw lastRecoverableError instanceof Error
      ? lastRecoverableError
      : new Error('AI CLI execution failed before runner config fallback');
  }

  private async resolveRuntimeFallbackToolConfigs(
    businessLineId: string,
    currentToolConfig: ResolvedRunnerGenerationToolConfig,
  ): Promise<ResolvedRunnerGenerationToolConfig[]> {
    const resolved: ResolvedRunnerGenerationToolConfig[] = [currentToolConfig];
    const seen = new Set<string>([currentToolConfig.toolId]);
    const candidates = ['codex', 'opencode'];
    for (const toolId of candidates) {
      if (seen.has(toolId)) {
        continue;
      }

      const config =
        await this.agentToolConfigRepository.findDefaultByBusinessLineIdAndToolId(
          businessLineId,
          toolId,
        );
      if (!config) {
        continue;
      }

      seen.add(toolId);
      resolved.push(
        this.createResolvedToolConfig(
          businessLineId,
          {
            id: config.id,
            toolId: config.toolId,
            configJson: this.parseConfigJson(config.configJson),
          },
          'fallback_after_runtime_error',
        ),
      );
    }

    return resolved;
  }

  private isRecoverableRunnerCliFailure(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      lower.includes('e2big') ||
      lower.includes('out of usage') ||
      lower.includes('increase limits') ||
      lower.includes('switch to auto') ||
      lower.includes('composer 2.5') ||
      lower.includes('quota') ||
      lower.includes('rate limit') ||
      lower.includes('timeout') ||
      lower.includes('enoent') ||
      lower.includes('command not found') ||
      lower.includes('no such file or directory') ||
      lower.includes('exit 127') ||
      lower.includes('exited with code 127')
    );
  }

  private parseConfigJson(
    raw: string | Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  private async invokeCliWithPrompt(
    toolId: string,
    configJson: Record<string, unknown>,
    prompt: string,
    timeoutMs = AI_TIMEOUT_MS,
    cwd = os.tmpdir(),
  ): Promise<string> {
    const adapterId = this.agentCliAdapterRegistry.resolve(toolId);
    if (!adapterId) {
      throw new Error(`Unsupported agent CLI tool: ${toolId}`);
    }

    const sanitized = sanitizeAgentToolConfigJson(
      this.agentCliAdapterRegistry,
      adapterId,
      configJson,
    );

    const cliAdapter = this.agentCliAdapterRegistry.getById(adapterId);
    const runnerConfig = cliAdapter.buildToolRunnerConfig({
      ...sanitized,
      prompt,
    });

    const command = runnerConfig.command?.trim() || cliAdapter.defaultCommand;
    const baseArgs = runnerConfig.args ?? cliAdapter.defaultArgs();
    const finalArgs = cliAdapter.normalizeArgs([...baseArgs]);
    const env = this.buildEnvironment(runnerConfig.env ?? {});

    const spawnArgs =
      adapterId === 'cursor' ? [...finalArgs, prompt] : finalArgs;
    const writeStdin =
      adapterId === 'cursor' || adapterId === 'opencode' ? null : prompt;

    return new Promise<string>((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let killed = false;

      const child = spawn(command, spawnArgs, {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
      });

      const timer = setTimeout(() => {
        killed = true;
        try {
          // Kill entire process group (negative pid) since detached=true
          if (child.pid) {
            process.kill(-child.pid, 'SIGTERM');
            setTimeout(() => {
              try {
                if (child.pid) process.kill(-child.pid, 'SIGKILL');
              } catch {
                /* already dead */
              }
            }, 2000);
          }
        } catch {
          try {
            child.kill('SIGKILL');
          } catch {
            /* ignore */
          }
        }
        reject(new Error(`AI CLI timeout (${Math.round(timeoutMs / 1000)}s)`));
      }, timeoutMs);

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      if (writeStdin && child.stdin) {
        child.stdin.write(prompt);
        child.stdin.end();
      }

      child.on('close', (code) => {
        clearTimeout(timer);
        if (killed) return;

        if (code !== 0) {
          const preview = maskSecrets(stderr.slice(0, 500));
          reject(new Error(`AI CLI exited with code ${code}: ${preview}`));
          return;
        }
        resolve(stdout);
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        if (killed) return;
        reject(err);
      });
    });
  }

  private buildEnvironment(
    runnerEnv: Record<string, string>,
  ): NodeJS.ProcessEnv {
    return {
      ...process.env,
      ...runnerEnv,
      GIT_TERMINAL_PROMPT: '0',
      NODE_NO_WARNINGS: '1',
    };
  }

  private resolveDefaultAiTimeoutMs(): number {
    return AI_TIMEOUT_MS;
  }

  private resolveFullScanTimeoutMs(): number {
    const raw = process.env.AINATIVE_RUNNER_AI_FULL_SCAN_TIMEOUT_MS?.trim();
    if (!raw) {
      return FULL_SCAN_AI_TIMEOUT_MS;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return FULL_SCAN_AI_TIMEOUT_MS;
    }

    return parsed;
  }

  private buildWorkspaceScanPrompt(
    repoPrefixes: string[],
    previousErrors: string[] = [],
  ): string {
    const repoList = repoPrefixes
      .map((prefix) => prefix.trim())
      .filter(Boolean)
      .map((prefix) => `- ${prefix}/`)
      .join('\n');
    const compressedErrors = previousErrors
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(-5);
    const previousErrorSection =
      compressedErrors.length > 0
        ? `\nPrevious attempt failed because:\n${compressedErrors
            .map((item) => `- ${item}`)
            .join('\n')}\n`
        : '';

    return `${FULL_SCAN_PROMPT}

Workspace root:
- The current working directory is the cloned workspace root.

Repositories to scan:
${repoList || '- (none provided)'}
${previousErrorSection}

Scan checklist:
- Find the best local dev or run command for each repo.
- Extract HTTP ports from scripts, config files, README examples, Makefile targets, or backend config YAML.
- Include backend/API services that sibling frontends depend on; do not keep only the UI repos.
- If multiple services are runnable, prefer per-service routes and a navigation homepage at "/".

Deliver exactly one JSON object that matches the schema.`;
  }
}

function normalizeFullScanOutput(value: unknown): {
  orchestration: RunnerOrchestrationConfig | null;
  reasoningSummary?: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { orchestration: null };
  }

  const raw = value as Record<string, unknown>;
  const maybeWrapped = raw.orchestration;
  const orchestration =
    maybeWrapped &&
    typeof maybeWrapped === 'object' &&
    !Array.isArray(maybeWrapped)
      ? (maybeWrapped as RunnerOrchestrationConfig)
      : (raw as RunnerOrchestrationConfig);

  return {
    orchestration,
    reasoningSummary:
      typeof raw.reasoningSummary === 'string'
        ? raw.reasoningSummary.slice(0, 1000)
        : undefined,
  };
}
