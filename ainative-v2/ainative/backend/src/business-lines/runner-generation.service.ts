import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { resolveGitRemoteUrlWithHttpAuth } from '../git/git-remote-auth.util';
import {
  computeSubRepoFingerprint,
  normalizeSubRepoUrl,
  resolveSubRepoConfigs,
  SubRepoConfig,
} from '../git/sub-repo.types';
import { BusinessLineRepository } from './infrastructure/persistence/business-line.repository';
import { ProjectRepository } from '../projects/infrastructure/persistence/project.repository';
import type {
  BusinessLineWorkspaceConfig,
  RunnerConfigCacheMeta,
  RunnerConfigStatus,
} from '../git/workspace-native.types';
import type {
  RunnerHomepageLinkConfig,
  RunnerOrchestrationConfig,
  RunnerRouteConfig,
  RunnerServiceConfig,
} from '../containers/runner-orchestration.types';
import { collectAllRepoFacts, RepoFacts } from './repo-facts-collector';
import { AiRunnerConfigGenerator } from './ai-runner-config-generator';
import { buildDeterministicConfig } from './deterministic-runner-fallback';
import {
  validateRunnerConfig,
  validateRunnerConfigSchema,
} from './runner-config-validator';
import { RunnerOrchestrationSyncService } from './runner-orchestration-sync.service';
import {
  buildDeterministicSelection,
  buildRunnerCandidateManifest,
  type RetryConstraints,
  type RunnerCandidateManifest,
} from './service-candidate-builder';
import { assembleRunnerConfigFromSelection } from './runner-config-assembler';
import {
  RunnerConfigProbeService,
  type RunnerConfigProbeResult,
} from './runner-config-probe.service';

interface RunnerGenerationJob {
  businessLineId: string;
  force?: boolean;
}

interface RunnerGenerationResult {
  status: RunnerConfigStatus;
  orchestration?: RunnerOrchestrationConfig;
  meta?: RunnerConfigCacheMeta;
  error?: string;
  verificationWorkspacePath?: string;
}

interface ProjectRunnerGenerationResult {
  written: boolean;
  skipped: boolean;
  status: 'written' | 'no_result' | 'skipped' | 'failed';
  error?: string;
  verified?: boolean;
}

interface RepoCoverageSummary {
  coverageStatus: 'valid' | 'incomplete';
  discoveredRepoPrefixes: string[];
  selectedRepoPrefixes: string[];
  omittedRepoPrefixes: string[];
  needsConfigRepoPrefixes: string[];
  omissionReasonsByRepo: Record<string, string[]>;
  autoStartLimited: boolean;
}

interface AugmentedOrchestrationResult {
  orchestration?: RunnerOrchestrationConfig;
  warnings: string[];
  error?: string;
}

interface SelectedRepoService {
  repoPrefix: string;
  service: RunnerServiceConfig;
  facts: RepoFacts;
  repoDir: string;
  textEvidence: Array<{ file: string; content: string }>;
  kind: 'frontend' | 'backend' | 'other';
  frontendKind?: 'rsbuild-vite' | 'taro' | 'other';
}

const ACCEPTABLE_OMISSION_REASONS = new Set([
  'library',
  'non-runnable',
  'intentionally-skipped',
]);
const INCOMPLETE_OMISSION_REASONS = new Set([
  'missing-port',
  'missing-command',
  'preview-capable-not-selected',
  'discovered-preview-capable-not-started',
]);
const MUST_START_FRAMEWORK_HINTS = new Set([
  'taro',
  'vite',
  'rsbuild',
  'next',
  'nuxt',
  'cra',
  'fastapi',
  'gin',
  'kratos',
  'nest',
]);
const FRONTEND_FRAMEWORK_HINTS = new Set([
  'taro',
  'vite',
  'rsbuild',
  'next',
  'nuxt',
  'cra',
]);
const BACKEND_FRAMEWORK_HINTS = new Set(['fastapi', 'gin', 'kratos', 'nest']);

const RUNNER_GIT_TIMEOUT_MS = 300_000;
const MAX_AI_SELECTION_ATTEMPTS = 2;
const VERIFICATION_RECOVERY_PAGE_SIZE = 100;

@Injectable()
export class RunnerGenerationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RunnerGenerationService.name);
  private readonly pendingJobs = new Map<string, RunnerGenerationJob>();
  private draining = false;
  private readonly gitlabHttpAuthHost: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly businessLineRepository: BusinessLineRepository,
    private readonly projectRepository: ProjectRepository,
    private readonly aiGenerator: AiRunnerConfigGenerator,
    private readonly syncService: RunnerOrchestrationSyncService,
    private readonly probeService: RunnerConfigProbeService,
  ) {
    this.gitlabHttpAuthHost =
      this.configService.get<string>('GITLAB_HTTP_AUTH_HOST', {
        infer: true,
      }) ?? 'gitlab.yc345.tv';
  }

  onModuleInit(): void {
    setImmediate(() => {
      void this.recoverInterruptedVerificationJobs();
    });
  }

  onModuleDestroy(): void {
    this.pendingJobs.clear();
  }

  private async recoverInterruptedVerificationJobs(): Promise<void> {
    let page = 1;

    while (true) {
      const businessLines =
        await this.businessLineRepository.findAllWithPagination({
          paginationOptions: {
            page,
            limit: VERIFICATION_RECOVERY_PAGE_SIZE,
          },
        });

      if (businessLines.length === 0) return;

      for (const businessLine of businessLines) {
        const config = (businessLine.configJson ??
          {}) as Partial<BusinessLineWorkspaceConfig>;
        const meta = config.runnerConfigCacheMeta;
        if (
          config.runnerConfigStatus !== 'verifying' ||
          meta?.verificationStatus !== 'running'
        ) {
          continue;
        }

        const message =
          'Runner verification interrupted before completion; regenerating runner config';
        const finalMeta: RunnerConfigCacheMeta = {
          ...meta,
          verificationStatus: 'failed',
          verificationFinishedAt: new Date().toISOString(),
          verificationError: message,
        };

        await this.updateBusinessLineConfig(businessLine.id, {
          runnerConfigCacheMeta: finalMeta,
          runnerConfigStatus: 'needsManualReview',
          runnerConfigError: message,
          runnerConfigUpdatedAt: new Date().toISOString(),
          runnerLastAttemptedAt: new Date().toISOString(),
        });

        this.logRunnerGenerationEvent('verification_recovered', {
          businessLineId: businessLine.id,
          fingerprint: meta.inputFingerprint,
          source: meta.source,
          status: 'needsManualReview',
          verificationStatus: 'failed',
          failureKind: 'verification_interrupted',
        });

        if (resolveSubRepoConfigs(businessLine.configJson).length > 0) {
          this.enqueue(businessLine.id, { force: true });
        }
      }

      if (businessLines.length < VERIFICATION_RECOVERY_PAGE_SIZE) return;
      page += 1;
    }
  }

  enqueue(businessLineId: string, options?: { force?: boolean }): void {
    if (!businessLineId?.trim()) return;

    const existing = this.pendingJobs.get(businessLineId);
    const force = (existing?.force || options?.force) ?? false;

    this.pendingJobs.set(businessLineId, { businessLineId, force });
    this.scheduleDrain();
  }

  /**
   * Generate runner config for a specific project using its own subRepos.
   * Result is written directly to the project's containerRuntime.runnerOrchestration.
   * Fire-and-forget: caller should not await.
   */
  async generateForProject(
    projectId: string,
    options?: {
      enhancedRetry?: boolean;
      triggerReason?: string;
    },
  ): Promise<ProjectRunnerGenerationResult> {
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      return {
        written: false,
        skipped: true,
        status: 'skipped',
        error: 'Project not found',
      };
    }

    const subRepos = resolveSubRepoConfigs(project.configJson);
    if (subRepos.length === 0) {
      return {
        written: false,
        skipped: true,
        status: 'skipped',
        error: 'Project has no subRepos',
      };
    }

    try {
      const result = await this.generateRunnerConfig(
        project.businessLineId,
        subRepos,
        'project-level',
        {
          enhancedRetry: options?.enhancedRetry === true,
          triggerReason: options?.triggerReason,
        },
      );

      const resultMeta = result.meta;
      const canPersistInjectableConfig =
        !!result.orchestration &&
        Array.isArray(result.orchestration.services) &&
        result.orchestration.services.length > 0;
      const isVerifiedReady =
        result.status === 'ready' &&
        canPersistInjectableConfig &&
        resultMeta?.coverageStatus === 'valid' &&
        resultMeta?.verificationStatus === 'passed';

      if (canPersistInjectableConfig && result.orchestration) {
        const configJson = (project.configJson ?? {}) as Record<
          string,
          unknown
        >;
        const containerRuntime = (configJson.containerRuntime ?? {}) as Record<
          string,
          unknown
        >;
        const generatedAt = new Date().toISOString();
        const coverage = this.readCoverageSummaryFromMeta(
          result.meta,
          subRepos.map((item) => item.prefix),
        );

        await this.projectRepository.update(projectId, {
          configJson: {
            ...configJson,
            containerRuntime: {
              ...containerRuntime,
              runnerOrchestration: {
                ...result.orchestration,
                generatedMeta: {
                  ...(resultMeta ?? {}),
                  ...this.buildProjectGeneratedMeta(
                    coverage,
                    computeSubRepoFingerprint(subRepos),
                    generatedAt,
                    resultMeta?.runnerFingerprint ??
                      resultMeta?.inputFingerprint ??
                      undefined,
                  ),
                } as RunnerConfigCacheMeta,
              },
            },
          },
        });

        this.logger.log(
          `runner_generation_project_written projectId=${projectId} services=${result.orchestration.services?.length ?? 0} coverage=${coverage.coverageStatus}`,
        );
        return {
          written: true,
          skipped: false,
          status: 'written',
          verified: isVerifiedReady,
        };
      } else {
        const error =
          result.error ??
          this.describeProjectGenerationFailure(result.status, resultMeta);
        this.logger.warn(
          `runner_generation_project_no_result projectId=${projectId} status=${result.status} error=${error}`,
        );
        return {
          written: false,
          skipped: false,
          status: 'no_result',
          error,
          verified: false,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `runner_generation_project_failed projectId=${projectId} error=${message}`,
      );
      return {
        written: false,
        skipped: false,
        status: 'failed',
        error: message,
        verified: false,
      };
    }
  }

  private scheduleDrain(): void {
    if (this.draining) return;
    this.draining = true;
    setImmediate(() => {
      void this.drainQueue();
    });
  }

  private buildProjectGeneratedMeta(
    coverage: RepoCoverageSummary,
    subRepoFingerprint: string,
    generatedAt: string,
    runnerFingerprint?: string,
  ): RunnerConfigCacheMeta {
    const notAutoStartedRepoPrefixes = coverage.omittedRepoPrefixes.filter(
      (prefix) =>
        coverage.omissionReasonsByRepo[prefix]?.includes(
          'discovered-preview-capable-not-started',
        ) ?? false,
    );

    return {
      source: 'runner-generation-project',
      generatedAt,
      subRepoFingerprint,
      ...(runnerFingerprint ? { runnerFingerprint } : {}),
      coverageStatus: coverage.coverageStatus,
      discoveredRepoPrefixes: coverage.discoveredRepoPrefixes,
      selectedRepoPrefixes: coverage.selectedRepoPrefixes,
      notAutoStartedRepoPrefixes,
      omittedRepoPrefixes: coverage.omittedRepoPrefixes,
      needsConfigRepoPrefixes: coverage.needsConfigRepoPrefixes,
      omissionReasonsByRepo: coverage.omissionReasonsByRepo,
      autoStartLimited: coverage.autoStartLimited,
    };
  }

  private describeProjectGenerationFailure(
    status: RunnerConfigStatus,
    meta?: RunnerConfigCacheMeta,
  ): string {
    if (meta?.coverageStatus !== 'valid') {
      return 'Runner 配置覆盖不完整，未写入项目预览编排配置';
    }
    if (meta?.verificationStatus && meta.verificationStatus !== 'passed') {
      return `Runner 配置未通过验证（verification=${meta.verificationStatus}），未写入项目预览编排配置`;
    }
    if (status === 'partial') {
      return 'Runner 配置生成不完整，未写入项目预览编排配置';
    }
    if (status === 'generated' || status === 'verifying') {
      return 'Runner 配置尚未完成验证，未写入项目预览编排配置';
    }
    if (status === 'needsManualReview') {
      return 'Runner 配置需要人工处理，未写入项目预览编排配置';
    }
    return `Generation returned status=${status}`;
  }

  private readCoverageSummaryFromMeta(
    meta: RunnerConfigCacheMeta | undefined,
    repoPrefixes: string[],
  ): RepoCoverageSummary {
    const discoveredRepoPrefixes =
      meta?.discoveredRepoPrefixes?.length &&
      meta.discoveredRepoPrefixes.length > 0
        ? [...meta.discoveredRepoPrefixes]
        : [...repoPrefixes];
    const selectedRepoPrefixes = [...(meta?.selectedRepoPrefixes ?? [])];
    const omittedRepoPrefixes = [...(meta?.omittedRepoPrefixes ?? [])];
    const needsConfigRepoPrefixes = [...(meta?.needsConfigRepoPrefixes ?? [])];
    const omissionReasonsByRepo = { ...(meta?.omissionReasonsByRepo ?? {}) };

    return {
      coverageStatus: meta?.coverageStatus === 'valid' ? 'valid' : 'incomplete',
      discoveredRepoPrefixes,
      selectedRepoPrefixes,
      omittedRepoPrefixes,
      needsConfigRepoPrefixes,
      omissionReasonsByRepo,
      autoStartLimited: meta?.autoStartLimited === true,
    };
  }

  private buildRepoCoverageSummary(params: {
    repoPrefixes: string[];
    facts: RepoFacts[];
    manifest: RunnerCandidateManifest;
    orchestration: RunnerOrchestrationConfig;
  }): RepoCoverageSummary {
    const selectedRepoPrefixes = Array.from(
      new Set(
        (params.orchestration.services ?? [])
          .map((service) => service.workdir.split('/')[0]?.trim() || '')
          .filter(Boolean),
      ),
    );
    const omittedRepoPrefixes: string[] = [];
    const needsConfigRepoPrefixes: string[] = [];
    const omissionReasonsByRepo: Record<string, string[]> = {};
    const factsByPrefix = new Map(
      params.facts.map((fact) => [fact.prefix, fact] as const),
    );

    for (const prefix of params.repoPrefixes) {
      if (selectedRepoPrefixes.includes(prefix)) {
        continue;
      }

      const reasons = this.classifyRepoCoverageGap({
        prefix,
        facts: factsByPrefix.get(prefix),
        manifest: params.manifest,
        selectedRepoPrefixes,
      });
      omissionReasonsByRepo[prefix] = reasons;

      if (
        reasons.some(
          (reason) => reason === 'missing-port' || reason === 'missing-command',
        )
      ) {
        needsConfigRepoPrefixes.push(prefix);
      } else {
        omittedRepoPrefixes.push(prefix);
      }
    }

    const selectedPreviewRepoPrefixes = new Set(
      (params.orchestration.services ?? [])
        .filter((service) => typeof service.port === 'number')
        .map((service) => service.workdir.split('/')[0]?.trim() || '')
        .filter(Boolean),
    );
    const routePathsByRepoPrefix = new Map<string, string[]>();
    for (const route of params.orchestration.routes ?? []) {
      if (route.action === 'redirect') {
        continue;
      }
      const targetService = route.service?.trim();
      if (!targetService) {
        continue;
      }
      const targetRepoPrefix =
        (params.orchestration.services ?? [])
          .find((service) => service.name === targetService)
          ?.workdir.split('/')[0]
          ?.trim() || '';
      if (!targetRepoPrefix) {
        continue;
      }
      const existingPaths = routePathsByRepoPrefix.get(targetRepoPrefix) ?? [];
      if (!existingPaths.includes(route.path)) {
        existingPaths.push(route.path);
      }
      routePathsByRepoPrefix.set(targetRepoPrefix, existingPaths);
    }
    const homepageLinks = params.orchestration.homepage?.links ?? [];
    const shouldRequireHomepageLinks = homepageLinks.length > 0;

    for (const prefix of selectedPreviewRepoPrefixes) {
      if (!shouldRequireHomepageLinks) {
        break;
      }
      const hasHomepageLink = homepageLinks.some((link) => {
        const normalizedPath =
          typeof link.path === 'string' ? link.path.trim().toLowerCase() : '';
        const normalizedLabel =
          typeof link.label === 'string' ? link.label.trim().toLowerCase() : '';
        return (
          normalizedLabel === prefix.toLowerCase() ||
          normalizedPath.includes(`/${prefix.toLowerCase()}/`) ||
          (routePathsByRepoPrefix.get(prefix) ?? []).some(
            (routePath) => normalizedPath === routePath.trim().toLowerCase(),
          )
        );
      });
      if (hasHomepageLink) {
        continue;
      }

      const reasons = omissionReasonsByRepo[prefix] ?? [];
      if (!reasons.includes('selected-preview-missing-homepage-link')) {
        omissionReasonsByRepo[prefix] = [
          ...reasons,
          'selected-preview-missing-homepage-link',
        ];
      }
    }

    const coverageStatus =
      needsConfigRepoPrefixes.length > 0 ||
      omittedRepoPrefixes.some((prefix) =>
        (omissionReasonsByRepo[prefix] ?? []).some(
          (reason) => !ACCEPTABLE_OMISSION_REASONS.has(reason),
        ),
      ) ||
      Object.values(omissionReasonsByRepo).some((reasons) =>
        reasons.includes('selected-preview-missing-homepage-link'),
      )
        ? 'incomplete'
        : 'valid';

    return {
      coverageStatus,
      discoveredRepoPrefixes: [...params.repoPrefixes],
      selectedRepoPrefixes,
      omittedRepoPrefixes,
      needsConfigRepoPrefixes,
      omissionReasonsByRepo,
      autoStartLimited: false,
    };
  }

  private classifyRepoCoverageGap(params: {
    prefix: string;
    facts?: RepoFacts;
    manifest: RunnerCandidateManifest;
    selectedRepoPrefixes: string[];
  }): string[] {
    const repoCandidates = params.manifest.candidates.filter(
      (candidate) => candidate.repoPrefix === params.prefix,
    );
    const facts = params.facts;

    if (!facts) {
      return ['unknown'];
    }

    const hasCommandEvidence = facts.commandEvidence.length > 0;
    const hasHttpLikePortEvidence = facts.portEvidence.some(
      (port) =>
        port.protocol === 'http' ||
        port.protocol === 'ws' ||
        port.protocol === 'unknown',
    );
    const previewCapableCandidates = repoCandidates.filter(
      (candidate) => candidate.previewCapable,
    );
    const repoLooksMustStart =
      previewCapableCandidates.length > 0 ||
      (hasCommandEvidence &&
        (hasHttpLikePortEvidence ||
          facts.frameworkHints.some((hint) =>
            MUST_START_FRAMEWORK_HINTS.has(hint),
          )));

    if (!repoLooksMustStart) {
      return ['non-runnable'];
    }

    if (!hasCommandEvidence) {
      return ['missing-command'];
    }

    if (!hasHttpLikePortEvidence) {
      return ['missing-port'];
    }

    if (previewCapableCandidates.length > 0) {
      return ['preview-capable-not-selected'];
    }

    if (
      repoCandidates.some((candidate) =>
        candidate.rejectReasons.includes('missing-port'),
      )
    ) {
      return ['missing-port'];
    }

    if (
      repoCandidates.some((candidate) =>
        candidate.rejectReasons.includes('missing-command'),
      )
    ) {
      return ['missing-command'];
    }

    return ['preview-capable-not-selected'];
  }

  private limitSelectedCandidateIds(
    manifest: RunnerCandidateManifest,
    selectedIds: string[],
    previewServiceCandidateId?: string,
  ): string[] {
    const limit = this.getAutoStartLimit();
    if (limit <= 0 || selectedIds.length <= limit) {
      return selectedIds;
    }

    const candidateById = new Map(
      manifest.candidates.map((candidate) => [candidate.id, candidate]),
    );
    const previewId =
      previewServiceCandidateId &&
      selectedIds.includes(previewServiceCandidateId)
        ? previewServiceCandidateId
        : undefined;
    const ordered = [...selectedIds].sort((left, right) => {
      const leftCandidate = candidateById.get(left);
      const rightCandidate = candidateById.get(right);
      return (
        (rightCandidate?.confidence ?? 0) - (leftCandidate?.confidence ?? 0)
      );
    });
    const limited = previewId ? [previewId] : [];

    for (const id of ordered) {
      if (limited.includes(id)) {
        continue;
      }
      limited.push(id);
      if (limited.length >= limit) {
        break;
      }
    }

    return limited;
  }

  private getAutoStartLimit(): number {
    const raw = this.configService.get<string>(
      'AINATIVE_RUNNER_AUTO_START_LIMIT',
      {
        infer: true,
      },
    );
    const parsed = raw ? Number(raw) : 3;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 3;
  }

  private async drainQueue(): Promise<void> {
    try {
      while (this.pendingJobs.size > 0) {
        const [id, job] = [...this.pendingJobs.entries()][0];
        if (!id || !job) break;
        this.pendingJobs.delete(id);
        await this.processGeneration(job);
      }
    } finally {
      this.draining = false;
      if (this.pendingJobs.size > 0) {
        this.scheduleDrain();
      }
    }
  }

  private async processGeneration(job: RunnerGenerationJob): Promise<void> {
    const { businessLineId, force } = job;

    const bl = await this.businessLineRepository.findById(businessLineId);
    if (!bl) {
      this.logger.warn(
        `Runner generation skipped: BusinessLine ${businessLineId} not found`,
      );
      return;
    }

    const subRepos = resolveSubRepoConfigs(bl.configJson);
    if (subRepos.length === 0) {
      this.logger.debug(
        `Runner generation skipped: BusinessLine ${businessLineId} has no subRepos`,
      );
      return;
    }

    const blConfig = (bl.configJson ??
      {}) as Partial<BusinessLineWorkspaceConfig>;

    try {
      const lsResult = await this.lsRemoteAllSubRepos(subRepos);

      if (Object.keys(lsResult.heads).length === 0) {
        throw new Error(
          `All ls-remote calls failed: ${lsResult.warnings.join('; ')}`,
        );
      }

      const newFingerprint = this.computeFingerprint(subRepos, lsResult.heads);

      if (
        !force &&
        lsResult.allSucceeded &&
        newFingerprint === blConfig.runnerFingerprint &&
        blConfig.runnerConfigStatus === 'ready' &&
        blConfig.runnerConfigCacheMeta?.verificationStatus === 'passed' &&
        blConfig.runnerConfigCacheMeta?.coverageStatus === 'valid'
      ) {
        this.logger.debug(
          `Runner generation skipped: fingerprint unchanged for BusinessLine ${businessLineId}`,
        );
        return;
      }

      await this.updateBusinessLineConfig(bl.id, {
        runnerConfigStatus: 'pending',
        runnerConfigUpdatedAt: new Date().toISOString(),
      });

      // Only clone sub-repos whose HEAD was successfully resolved
      const reachableSubRepos = subRepos.filter(
        (s) => s.prefix in lsResult.heads,
      );

      const result = await this.generateRunnerConfig(
        bl.id,
        reachableSubRepos,
        newFingerprint,
        {
          lsRemoteWarnings: lsResult.warnings,
          lsRemotePartial: !lsResult.allSucceeded,
        },
      );

      if (result.status === 'ready' && result.orchestration) {
        // Sync to hidden project FIRST; only mark ready if sync doesn't throw
        const syncResult = await this.syncService.syncToHiddenProject(
          businessLineId,
          result.orchestration,
          {
            fingerprint: newFingerprint,
            generatorToolId: result.meta?.generatorToolId,
            generatorConfigId: result.meta?.generatorConfigId,
            warningCount: result.meta?.analysisWarnings?.length ?? 0,
          },
        );

        const allWarnings = [
          ...(result.meta?.analysisWarnings ?? []),
          ...(syncResult.warnings ?? []),
        ];
        const finalMeta: RunnerConfigCacheMeta = {
          ...(result.meta ?? {
            source: 'fallback',
            generatedAt: new Date().toISOString(),
          }),
          analysisWarnings: allWarnings.length > 0 ? allWarnings : undefined,
        };

        if (syncResult.synced) {
          await this.updateBusinessLineConfig(bl.id, {
            runnerConfigCache: result.orchestration,
            runnerConfigCacheMeta: finalMeta,
            runnerFingerprint: newFingerprint,
            runnerConfigStatus: 'ready',
            runnerGeneratedAt: new Date().toISOString(),
            runnerConfigError: undefined,
            runnerConfigUpdatedAt: new Date().toISOString(),
          });
        } else {
          // Config generated but not applied — don't advance fingerprint so
          // future runs retry sync when conditions change
          await this.updateBusinessLineConfig(bl.id, {
            runnerConfigCache: result.orchestration,
            runnerConfigCacheMeta: finalMeta,
            runnerConfigStatus: 'generated',
            runnerGeneratedAt: new Date().toISOString(),
            runnerConfigError: syncResult.skippedReason
              ? `Sync skipped: ${syncResult.skippedReason}`
              : undefined,
            runnerConfigUpdatedAt: new Date().toISOString(),
          });
        }

        this.logger.log(
          `Runner config generated for BusinessLine ${businessLineId} (source: ${finalMeta.source}, synced: ${syncResult.synced}, fingerprint: ${newFingerprint})`,
        );
      } else if (result.status === 'generated' && result.orchestration) {
        const finalMeta: RunnerConfigCacheMeta = {
          ...(result.meta ?? {
            source: 'fallback',
            generatedAt: new Date().toISOString(),
          }),
        };

        await this.updateBusinessLineConfig(bl.id, {
          runnerConfigCache: result.orchestration,
          runnerConfigCacheMeta: finalMeta,
          runnerConfigStatus: 'generated',
          runnerGeneratedAt: new Date().toISOString(),
          runnerConfigError: (
            result.error ?? 'Runner config generated but not runtime verified'
          ).slice(0, 2000),
          runnerConfigUpdatedAt: new Date().toISOString(),
          runnerLastAttemptedFingerprint: newFingerprint,
          runnerLastAttemptedAt: new Date().toISOString(),
        });

        this.logger.warn(
          `Runner config generated but not verified for BusinessLine ${businessLineId}: ${result.error ?? 'runtime verification skipped'}`,
        );
      } else if (result.status === 'partial' && result.orchestration) {
        const finalMeta: RunnerConfigCacheMeta = {
          ...(result.meta ?? {
            source: 'fallback',
            generatedAt: new Date().toISOString(),
          }),
          partial: true,
        };

        await this.updateBusinessLineConfig(bl.id, {
          runnerConfigCache: result.orchestration,
          runnerConfigCacheMeta: finalMeta,
          runnerConfigStatus: 'partial',
          runnerConfigError: undefined,
          runnerConfigUpdatedAt: new Date().toISOString(),
          runnerLastAttemptedFingerprint: newFingerprint,
          runnerLastAttemptedAt: new Date().toISOString(),
        });

        this.logger.warn(
          `Runner config partial for BusinessLine ${businessLineId}: ${result.error ?? 'partial clone'} (not synced to runtime source)`,
        );
      } else if (result.status === 'verifying' && result.orchestration) {
        const finalMeta: RunnerConfigCacheMeta = {
          ...(result.meta ?? {
            source: 'ai-full-scan',
            generatedAt: new Date().toISOString(),
          }),
          verificationStatus: 'running',
        };

        await this.updateBusinessLineConfig(bl.id, {
          runnerConfigCache: result.orchestration,
          runnerConfigCacheMeta: finalMeta,
          runnerConfigStatus: 'verifying',
          runnerConfigError: undefined,
          runnerConfigUpdatedAt: new Date().toISOString(),
          runnerLastAttemptedFingerprint: newFingerprint,
          runnerLastAttemptedAt: new Date().toISOString(),
        });

        if (result.verificationWorkspacePath) {
          this.scheduleVerificationJob({
            businessLineId: bl.id,
            fingerprint: newFingerprint,
            orchestration: result.orchestration,
            meta: finalMeta,
            workspacePath: result.verificationWorkspacePath,
          });
        }

        this.logger.log(
          `Runner config queued for verification for BusinessLine ${businessLineId} (fingerprint: ${newFingerprint})`,
        );
      } else if (result.status === 'needsManualReview') {
        const finalMeta: RunnerConfigCacheMeta = {
          ...(result.meta ?? {
            source: 'fallback',
            generatedAt: new Date().toISOString(),
          }),
        };

        await this.updateBusinessLineConfig(bl.id, {
          ...(result.orchestration
            ? { runnerConfigCache: result.orchestration }
            : {}),
          runnerConfigCacheMeta: finalMeta,
          runnerConfigStatus: 'needsManualReview',
          runnerConfigError: (
            result.error ?? 'Runner config needs manual review'
          ).slice(0, 2000),
          runnerConfigUpdatedAt: new Date().toISOString(),
          runnerLastAttemptedFingerprint: newFingerprint,
          runnerLastAttemptedAt: new Date().toISOString(),
        });

        this.logger.warn(
          `Runner config needs manual review for BusinessLine ${businessLineId}: ${result.error ?? 'low confidence or no preview'}`,
        );
      } else {
        await this.updateBusinessLineConfig(bl.id, {
          runnerConfigStatus: 'failed',
          runnerConfigError: (
            result.error ?? 'No runnable services detected'
          ).slice(0, 2000),
          runnerConfigUpdatedAt: new Date().toISOString(),
          runnerLastAttemptedFingerprint: newFingerprint,
          runnerLastAttemptedAt: new Date().toISOString(),
        });

        this.logger.error(
          `Runner generation failed for BusinessLine ${businessLineId}: ${result.error}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Runner generation failed for BusinessLine ${businessLineId}: ${message}`,
      );

      await this.updateBusinessLineConfig(bl.id, {
        runnerConfigStatus: 'failed',
        runnerConfigError: message.slice(0, 2000),
        runnerConfigUpdatedAt: new Date().toISOString(),
        runnerLastAttemptedFingerprint: undefined,
        runnerLastAttemptedAt: new Date().toISOString(),
      });
    }
  }

  private async generateRunnerConfig(
    businessLineId: string,
    subRepos: SubRepoConfig[],
    fingerprint: string,
    options?: {
      lsRemoteWarnings?: string[];
      lsRemotePartial?: boolean;
      enhancedRetry?: boolean;
      triggerReason?: string;
    },
  ): Promise<RunnerGenerationResult> {
    const tmpDir = await mkdtemp(path.join(tmpdir(), 'runner-analysis-'));
    const warnings: string[] = [...(options?.lsRemoteWarnings ?? [])];
    const clonedPrefixes: string[] = [];

    try {
      for (const sub of subRepos) {
        const resolvedUrl = this.resolveRemoteUrl(sub.url);
        const targetDir = path.join(tmpDir, sub.prefix);

        const cloneResult = await this.runCommand('git', [
          'clone',
          '--depth',
          '1',
          '--branch',
          sub.branch,
          '--single-branch',
          resolvedUrl,
          targetDir,
        ]);

        if (cloneResult.success) {
          clonedPrefixes.push(sub.prefix);
        } else {
          warnings.push(
            `Clone failed for ${sub.prefix}: ${cloneResult.stderr.slice(0, 200)}`,
          );
        }
      }

      if (clonedPrefixes.length === 0) {
        return {
          status: 'failed',
          error: `All sub-repo clones failed: ${warnings.join('; ')}`,
        };
      }

      let collected = await collectAllRepoFacts(tmpDir, clonedPrefixes);
      if (collected.facts.length === 0) {
        return {
          status: 'failed',
          error: 'No repo facts collected',
        };
      }

      const isPartial =
        clonedPrefixes.length < subRepos.length ||
        collected.truncated ||
        (options?.lsRemotePartial ?? false);

      if (collected.truncated) {
        warnings.push(
          `Facts truncated (32KB limit): skipped ${collected.truncatedPrefixes.join(', ')}`,
        );
      }

      let facts = collected.facts;
      let manifest = buildRunnerCandidateManifest(facts);
      warnings.push(...manifest.warnings);

      if (this.needsDeeperScan(manifest)) {
        warnings.push(
          'Candidate evidence insufficient; running targeted deep scan',
        );
        collected = await collectAllRepoFacts(tmpDir, clonedPrefixes, {
          scanMode: 'targeted',
        });
        facts = collected.facts;
        manifest = buildRunnerCandidateManifest(facts);
        warnings.push(...manifest.warnings);
      }

      if (this.needsDeeperScan(manifest)) {
        warnings.push(
          'Candidate evidence still insufficient; running bounded full scan',
        );
        collected = await collectAllRepoFacts(tmpDir, clonedPrefixes, {
          scanMode: 'bounded-full',
        });
        facts = collected.facts;
        manifest = buildRunnerCandidateManifest(facts);
        warnings.push(...manifest.warnings);
      }

      return await this.tryFullScanGeneration({
        businessLineId,
        tmpDir,
        clonedPrefixes,
        facts,
        manifest,
        fingerprint,
        warnings,
        isPartial,
        previousErrors:
          warnings.length > 0
            ? [...warnings]
            : ['Generate runnerOrchestration directly from repository evidence'],
        enhancedRetry: options?.enhancedRetry === true,
      });
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async verifyCandidateGeneration(params: {
    businessLineId: string;
    tmpDir: string;
    clonedPrefixes: string[];
    facts: RepoFacts[];
    manifest: RunnerCandidateManifest;
    fingerprint: string;
    warnings: string[];
    isPartial: boolean;
    finalOrchestration: RunnerOrchestrationConfig & InternalFields;
  }): Promise<RunnerGenerationResult> {
    const {
      businessLineId,
      tmpDir,
      clonedPrefixes,
      facts,
      manifest,
      fingerprint,
      warnings,
      isPartial,
    } = params;
    let { finalOrchestration } = params;
    const repoCoverage = this.buildRepoCoverageSummary({
      repoPrefixes: clonedPrefixes,
      facts,
      manifest,
      orchestration: stripInternalFields(finalOrchestration),
    });

    let probeResult = await this.probeService.probe({
      orchestration: stripInternalFields(finalOrchestration),
      workspacePath: tmpDir,
      fingerprint,
    });
    if (probeResult.repairedOrchestration) {
      warnings.push(
        `Runtime probe auto-repaired runner config: ${probeResult.repairSummary ?? 'updated service ports'}`,
      );
      finalOrchestration = {
        ...probeResult.repairedOrchestration,
        _source: finalOrchestration._source,
        _generatorToolId: finalOrchestration._generatorToolId,
        _generatorConfigId: finalOrchestration._generatorConfigId,
      };
    }
    warnings.push(this.formatProbeWarning(probeResult));

    if (probeResult.status === 'failed') {
      const retryConstraints = this.retryConstraintsFromProbe(
        finalOrchestration,
        probeResult,
      );
      if (
        retryConstraints.rejectPorts?.length ||
        retryConstraints.rejectCandidateIds?.length
      ) {
        warnings.push(
          'Runtime probe failed; retrying candidate arbitration once',
        );
        const retryOrchestration = await this.generateFromCandidateManifest(
          businessLineId,
          manifest,
          warnings,
          retryConstraints,
        );
        if (retryOrchestration && !retryOrchestration._needsManualReview) {
          const retryProbe = await this.probeService.probe({
            orchestration: stripInternalFields(retryOrchestration),
            workspacePath: tmpDir,
            fingerprint: `${fingerprint}-retry`,
          });
          warnings.push(this.formatProbeWarning(retryProbe));
          if (retryProbe.status === 'passed') {
            finalOrchestration = retryProbe.repairedOrchestration
              ? {
                  ...retryProbe.repairedOrchestration,
                  _source: retryOrchestration._source,
                  _generatorToolId: retryOrchestration._generatorToolId,
                  _generatorConfigId: retryOrchestration._generatorConfigId,
                }
              : retryOrchestration;
            probeResult = retryProbe;
          }
        }
      }
    }

    if (probeResult.status === 'failed') {
      const fullScanResult = await this.tryFullScanGeneration({
        businessLineId,
        tmpDir,
        clonedPrefixes,
        facts,
        manifest,
        fingerprint,
        warnings,
        isPartial,
        previousErrors: [this.formatProbeWarning(probeResult)],
      });
      if (fullScanResult.status !== 'needsManualReview') {
        return fullScanResult;
      }

      const meta = this.buildRunnerMeta(
        finalOrchestration,
        fingerprint,
        warnings,
        isPartial,
        probeResult,
        repoCoverage,
      );
      const cleanOrchestration = stripInternalFields(finalOrchestration);
      const error =
        fullScanResult.error ??
        probeResult.error ??
        'Runner config runtime probe failed';

      if (
        probeResult.mode === 'required' &&
        probeResult.failureKind === 'config-render'
      ) {
        return {
          status: 'failed',
          orchestration: cleanOrchestration,
          error,
          meta,
        };
      }

      return {
        status: 'needsManualReview',
        orchestration: cleanOrchestration,
        error,
        meta,
      };
    }

    const meta: RunnerConfigCacheMeta = {
      ...this.buildRunnerMeta(
        finalOrchestration,
        fingerprint,
        warnings,
        isPartial,
        probeResult,
        repoCoverage,
      ),
      verificationStatus:
        probeResult.status === 'passed' ? 'passed' : probeResult.status,
      verificationDurationMs: probeResult.durationMs,
    };

    const cleanOrchestration = stripInternalFields(finalOrchestration);

    if (repoCoverage.coverageStatus !== 'valid') {
      return {
        status: 'needsManualReview',
        orchestration: cleanOrchestration,
        error: 'Runner config coverage incomplete',
        meta,
      };
    }

    if (isPartial) {
      return {
        status: 'partial',
        orchestration: cleanOrchestration,
        meta,
      };
    }

    if (probeResult.status !== 'passed') {
      return {
        status: 'generated',
        orchestration: cleanOrchestration,
        error:
          probeResult.error ??
          `Runner runtime verification did not pass (status=${probeResult.status})`,
        meta,
      };
    }

    return {
      status: 'ready',
      orchestration: cleanOrchestration,
      meta,
    };
  }

  private async tryFullScanGeneration(params: {
    businessLineId: string;
    tmpDir: string;
    clonedPrefixes: string[];
    facts: RepoFacts[];
    manifest: RunnerCandidateManifest;
    fingerprint: string;
    warnings: string[];
    isPartial: boolean;
    previousErrors: string[];
    enhancedRetry?: boolean;
  }): Promise<RunnerGenerationResult> {
    const {
      businessLineId,
      tmpDir,
      clonedPrefixes,
      facts,
      manifest,
      fingerprint,
      warnings,
      isPartial,
      previousErrors,
      enhancedRetry,
    } = params;

    const aiResult = await this.aiGenerator.generateFromFullScan(
      businessLineId,
      {
        workspacePath: tmpDir,
        repoPrefixes: clonedPrefixes,
        previousErrors: enhancedRetry ? previousErrors : [],
      },
    );
    warnings.push(...aiResult.warnings);

    if (!aiResult.orchestration) {
      this.logRunnerGenerationEvent('full_scan_failed', {
        businessLineId,
        fingerprint,
        status: 'needsManualReview',
        source: 'ai-full-scan',
        failureKind: this.classifyGenerationFailure(
          aiResult.warnings.at(-1) ?? 'AI full scan produced no config',
        ),
      });
      return await this.tryMinimalFallbackAfterFullScan({
        facts,
        manifest,
        repoPrefixes: clonedPrefixes,
        workspacePath: tmpDir,
        fingerprint,
        warnings,
        isPartial,
        error: aiResult.warnings.at(-1) ?? 'AI full scan produced no config',
        reasoning: aiResult.reasoningSummary,
        generatorToolId: aiResult.generatorToolId,
        generatorConfigId: aiResult.generatorConfigId,
      });
    }

    const schema = validateRunnerConfigSchema(aiResult.orchestration);
    if (!schema.valid) {
      this.logRunnerGenerationEvent('full_scan_failed', {
        businessLineId,
        fingerprint,
        status: 'needsManualReview',
        source: 'ai-full-scan',
        failureKind: 'schema',
      });
      return await this.tryMinimalFallbackAfterFullScan({
        facts,
        manifest,
        repoPrefixes: clonedPrefixes,
        workspacePath: tmpDir,
        fingerprint,
        warnings,
        isPartial,
        error: `AI full scan schema validation failed: ${schema.errors.join('; ')}`,
        reasoning: aiResult.reasoningSummary,
        generatorToolId: aiResult.generatorToolId,
        generatorConfigId: aiResult.generatorConfigId,
      });
    }

    const baseValidation = validateRunnerConfig(
      this.buildAugmentationSeedOrchestration(aiResult.orchestration),
      {
        runnerListenPort: this.getRunnerListenPort(),
      },
    );
    if (!baseValidation.valid || !baseValidation.sanitized) {
      this.logRunnerGenerationEvent('full_scan_failed', {
        businessLineId,
        fingerprint,
        status: 'needsManualReview',
        source: 'ai-full-scan',
        failureKind: 'validator',
      });
      return await this.tryMinimalFallbackAfterFullScan({
        facts,
        manifest,
        repoPrefixes: clonedPrefixes,
        workspacePath: tmpDir,
        fingerprint,
        warnings,
        isPartial,
        error: `AI full scan validation failed: ${baseValidation.errors.join('; ')}`,
        reasoning: aiResult.reasoningSummary,
        generatorToolId: aiResult.generatorToolId,
        generatorConfigId: aiResult.generatorConfigId,
      });
    }

    const augmented = await this.applyMainSemanticAugmentation({
      orchestration: baseValidation.sanitized,
      workspacePath: tmpDir,
      facts,
      warnings,
    });
    warnings.push(...augmented.warnings);
    if (!augmented.orchestration) {
      return await this.tryMinimalFallbackAfterFullScan({
        facts,
        manifest,
        repoPrefixes: clonedPrefixes,
        workspacePath: tmpDir,
        fingerprint,
        warnings,
        isPartial,
        error:
          augmented.error ??
          'AI generation could not be converted into a main-style runner config',
        reasoning: aiResult.reasoningSummary,
        generatorToolId: aiResult.generatorToolId,
        generatorConfigId: aiResult.generatorConfigId,
      });
    }

    const validation = validateRunnerConfig(augmented.orchestration, {
      runnerListenPort: this.getRunnerListenPort(),
    });
    if (!validation.valid || !validation.sanitized) {
      return await this.tryMinimalFallbackAfterFullScan({
        facts,
        manifest,
        repoPrefixes: clonedPrefixes,
        workspacePath: tmpDir,
        fingerprint,
        warnings,
        isPartial,
        error: `Augmented AI runner config validation failed: ${validation.errors.join('; ')}`,
        reasoning: aiResult.reasoningSummary,
        generatorToolId: aiResult.generatorToolId,
        generatorConfigId: aiResult.generatorConfigId,
      });
    }

    const repoCoverage = this.buildRepoCoverageSummary({
      repoPrefixes: clonedPrefixes,
      facts,
      manifest,
      orchestration: validation.sanitized,
    });
    const meta: RunnerConfigCacheMeta = {
      source: 'ai-full-scan',
      generatedAt: new Date().toISOString(),
      coverageStatus: repoCoverage.coverageStatus,
      discoveredRepoPrefixes: repoCoverage.discoveredRepoPrefixes,
      selectedRepoPrefixes: repoCoverage.selectedRepoPrefixes,
      omittedRepoPrefixes: repoCoverage.omittedRepoPrefixes,
      needsConfigRepoPrefixes: repoCoverage.needsConfigRepoPrefixes,
      omissionReasonsByRepo: repoCoverage.omissionReasonsByRepo,
      autoStartLimited: false,
      analysisWarnings: warnings.length > 0 ? warnings : undefined,
      generatorToolId: aiResult.generatorToolId,
      generatorConfigId: aiResult.generatorConfigId,
      inputFingerprint: fingerprint,
      partial: isPartial || undefined,
      fullScanAttempted: true,
      fullScanReasoning: aiResult.reasoningSummary,
      verificationStatus: 'skipped',
    };

    const incompleteCoverageReasons = Array.from(
      new Set(
        Object.entries(repoCoverage.omissionReasonsByRepo).flatMap(
          ([prefix, reasons]) =>
            reasons
              .filter(
                (reason) =>
                  INCOMPLETE_OMISSION_REASONS.has(reason) ||
                  !ACCEPTABLE_OMISSION_REASONS.has(reason),
              )
              .map((reason) => `${prefix}:${reason}`),
        ),
      ),
    );

    if (
      repoCoverage.coverageStatus !== 'valid' ||
      incompleteCoverageReasons.length > 0
    ) {
      return await this.tryMinimalFallbackAfterFullScan({
        facts,
        manifest,
        repoPrefixes: clonedPrefixes,
        workspacePath: tmpDir,
        fingerprint,
        warnings,
        isPartial,
        error: `AI generation omitted or under-configured required repos: ${incompleteCoverageReasons.join(', ') || clonedPrefixes.join(', ')}`,
        reasoning: aiResult.reasoningSummary,
        generatorToolId: aiResult.generatorToolId,
        generatorConfigId: aiResult.generatorConfigId,
      });
    }

    const hasPreviewRoute =
      Boolean(validation.sanitized.preview) &&
      (validation.sanitized.routes ?? []).some(
        (route) => route.action === 'proxy',
      );
    if (!hasPreviewRoute) {
      return await this.tryMinimalFallbackAfterFullScan({
        facts,
        manifest,
        repoPrefixes: clonedPrefixes,
        workspacePath: tmpDir,
        fingerprint,
        warnings,
        isPartial,
        error: 'AI generation produced no preview route',
        reasoning: aiResult.reasoningSummary,
        generatorToolId: aiResult.generatorToolId,
        generatorConfigId: aiResult.generatorConfigId,
      });
    }

    this.logRunnerGenerationEvent('full_scan_completed', {
      businessLineId,
      fingerprint,
      status: isPartial ? 'partial' : 'ready',
      source: 'ai-full-scan',
      repoCount: clonedPrefixes.length,
      coverageStatus: repoCoverage.coverageStatus,
    });
    return {
      status: isPartial ? 'partial' : 'ready',
      orchestration: validation.sanitized,
      meta,
    };
  }

  private fullScanFailureResult(params: {
    fingerprint: string;
    warnings: string[];
    isPartial: boolean;
    error: string;
    reasoning?: string;
    generatorToolId?: string;
    generatorConfigId?: string;
  }): RunnerGenerationResult {
    const warning = params.error;
    params.warnings.push(warning);
    return {
      status: 'needsManualReview',
      error: params.error,
      meta: {
        source: 'ai-full-scan',
        generatedAt: new Date().toISOString(),
        analysisWarnings:
          params.warnings.length > 0 ? params.warnings : undefined,
        generatorToolId: params.generatorToolId,
        generatorConfigId: params.generatorConfigId,
        inputFingerprint: params.fingerprint,
        partial: params.isPartial || undefined,
        fullScanAttempted: true,
        fullScanError: params.error,
        fullScanReasoning: params.reasoning,
        verificationStatus: 'skipped',
        verificationError: params.error,
      },
    };
  }

  private async tryMinimalFallbackAfterFullScan(params: {
    facts: RepoFacts[];
    manifest: RunnerCandidateManifest;
    repoPrefixes: string[];
    workspacePath: string;
    fingerprint: string;
    warnings: string[];
    isPartial: boolean;
    error: string;
    reasoning?: string;
    generatorToolId?: string;
    generatorConfigId?: string;
  }): Promise<RunnerGenerationResult> {
    const fallback = this.tryFallbackGeneration(params.facts, params.warnings);
    if (!fallback) {
      return this.fullScanFailureResult({
        fingerprint: params.fingerprint,
        warnings: params.warnings,
        isPartial: params.isPartial,
        error: params.error,
        reasoning: params.reasoning,
        generatorToolId: params.generatorToolId,
        generatorConfigId: params.generatorConfigId,
      });
    }

    const augmented = await this.applyMainSemanticAugmentation({
      orchestration: stripInternalFields(fallback),
      workspacePath: params.workspacePath,
      facts: params.facts,
      warnings: params.warnings,
    });
    params.warnings.push(...augmented.warnings);
    if (!augmented.orchestration) {
      return {
        status: 'needsManualReview',
        orchestration: stripInternalFields(fallback),
        error: augmented.error ?? params.error,
        meta: {
          ...this.fullScanFailureResult({
            fingerprint: params.fingerprint,
            warnings: params.warnings,
            isPartial: params.isPartial,
            error: augmented.error ?? params.error,
            reasoning: params.reasoning,
            generatorToolId: params.generatorToolId,
            generatorConfigId: params.generatorConfigId,
          }).meta,
          source: fallback._source ?? 'fallback',
        } as RunnerConfigCacheMeta,
      };
    }

    const fallbackValidation = validateRunnerConfig(augmented.orchestration, {
      runnerListenPort: this.getRunnerListenPort(),
    });
    if (!fallbackValidation.valid || !fallbackValidation.sanitized) {
      return {
        status: 'needsManualReview',
        orchestration: augmented.orchestration,
        error: `Augmented fallback runner config validation failed: ${fallbackValidation.errors.join('; ')}`,
        meta: {
          ...(this.fullScanFailureResult({
            fingerprint: params.fingerprint,
            warnings: params.warnings,
            isPartial: params.isPartial,
            error: `Augmented fallback runner config validation failed: ${fallbackValidation.errors.join('; ')}`,
            reasoning: params.reasoning,
            generatorToolId:
              fallback._generatorToolId ?? params.generatorToolId,
            generatorConfigId:
              fallback._generatorConfigId ?? params.generatorConfigId,
          }).meta ?? {}),
          source: fallback._source ?? 'fallback',
        } as RunnerConfigCacheMeta,
      };
    }

    const cleanOrchestration = fallbackValidation.sanitized;
    const repoCoverage = this.buildRepoCoverageSummary({
      repoPrefixes: params.repoPrefixes,
      facts: params.facts,
      manifest: params.manifest,
      orchestration: cleanOrchestration,
    });
    const meta: RunnerConfigCacheMeta = {
      source: fallback._source ?? 'fallback',
      generatedAt: new Date().toISOString(),
      coverageStatus: repoCoverage.coverageStatus,
      discoveredRepoPrefixes: repoCoverage.discoveredRepoPrefixes,
      selectedRepoPrefixes: repoCoverage.selectedRepoPrefixes,
      omittedRepoPrefixes: repoCoverage.omittedRepoPrefixes,
      needsConfigRepoPrefixes: repoCoverage.needsConfigRepoPrefixes,
      omissionReasonsByRepo: repoCoverage.omissionReasonsByRepo,
      autoStartLimited: repoCoverage.autoStartLimited,
      analysisWarnings:
        params.warnings.length > 0 ? params.warnings : undefined,
      generatorToolId: fallback._generatorToolId ?? params.generatorToolId,
      generatorConfigId:
        fallback._generatorConfigId ?? params.generatorConfigId,
      inputFingerprint: params.fingerprint,
      partial: params.isPartial || undefined,
      fullScanAttempted: true,
      fullScanError: params.error,
      fullScanReasoning: params.reasoning,
      verificationStatus: 'skipped',
    };

    const hasPreviewRoute =
      Boolean(cleanOrchestration.preview) &&
      (cleanOrchestration.routes ?? []).some(
        (route) => route.action === 'proxy',
      );

    if (!hasPreviewRoute || repoCoverage.coverageStatus !== 'valid') {
      return {
        status: 'needsManualReview',
        orchestration: cleanOrchestration,
        error: params.error,
        meta: {
          ...meta,
          verificationError: params.error,
        },
      };
    }

    return {
      status: params.isPartial ? 'partial' : 'ready',
      orchestration: cleanOrchestration,
      meta,
    };
  }

  private buildAugmentationSeedOrchestration(
    orchestration: RunnerOrchestrationConfig,
  ): RunnerOrchestrationConfig {
    const routes = [...(orchestration.routes ?? [])];
    const servicesWithPort = (orchestration.services ?? []).filter(
      (service) => typeof service.port === 'number',
    );
    const routedServiceNames = new Set(
      routes
        .filter((route) => route.action !== 'redirect')
        .map((route) => route.service?.trim())
        .filter((name): name is string => Boolean(name)),
    );

    for (const service of servicesWithPort) {
      if (routedServiceNames.has(service.name)) {
        continue;
      }
      const routeSlug =
        service.workdir.split('/')[0]?.trim() || service.name.trim();
      routes.push({
        path: `/${routeSlug}/`,
        action: 'proxy',
        match: 'prefix',
        service: service.name,
      });
    }

    const homepage =
      orchestration.homepage ||
      (servicesWithPort.length > 1
        ? {
            title: 'AINative Runner',
            links: servicesWithPort.map((service) => ({
              label: service.name,
              path: `/${service.workdir.split('/')[0]?.trim() || service.name}/`,
            })),
          }
        : undefined);

    const preview =
      orchestration.preview ||
      (servicesWithPort.length > 0
        ? {
            service: servicesWithPort[0].name,
            path: homepage
              ? '/'
              : `/${servicesWithPort[0].workdir.split('/')[0]?.trim() || servicesWithPort[0].name}/`,
          }
        : undefined);

    return {
      ...orchestration,
      ...(routes.length > 0 ? { routes } : {}),
      ...(homepage ? { homepage } : {}),
      ...(preview ? { preview } : {}),
    };
  }

  private async applyMainSemanticAugmentation(params: {
    orchestration: RunnerOrchestrationConfig;
    workspacePath: string;
    facts: RepoFacts[];
    warnings: string[];
  }): Promise<AugmentedOrchestrationResult> {
    const factsByPrefix = new Map(
      params.facts.map((fact) => [fact.prefix, fact] as const),
    );
    const selectedServices: SelectedRepoService[] = [];

    for (const service of params.orchestration.services ?? []) {
      const repoPrefix = service.workdir.split('/')[0]?.trim() ?? '';
      const facts = factsByPrefix.get(repoPrefix);
      if (!repoPrefix || !facts) {
        continue;
      }

      const repoDir = path.join(params.workspacePath, repoPrefix);
      const textEvidence = await this.collectRepoTextEvidence(repoDir, facts);
      const frontendKind = this.classifyFrontendKind(facts);
      const kind =
        frontendKind !== null
          ? 'frontend'
          : this.isBackendRepoFacts(facts)
            ? 'backend'
            : 'other';

      selectedServices.push({
        repoPrefix,
        service: { ...service },
        facts,
        repoDir,
        textEvidence,
        kind,
        frontendKind: frontendKind ?? undefined,
      });
    }

    const frontendServices = selectedServices.filter(
      (item) => item.kind === 'frontend',
    );
    if (frontendServices.length === 0 || selectedServices.length <= 1) {
      return { orchestration: params.orchestration, warnings: [] };
    }

    const backendServices = selectedServices.filter(
      (item) => item.kind === 'backend',
    );
    const apiBackend = this.resolveApiBackendSelection({
      frontendServices,
      backendServices,
    });
    if (apiBackend.error) {
      return {
        warnings: [],
        error: apiBackend.error,
      };
    }

    const rsbuildLikeServices = frontendServices.filter(
      (item) => item.frontendKind === 'rsbuild-vite',
    );
    if (rsbuildLikeServices.length > 1) {
      const prefixes = rsbuildLikeServices.map((item) => item.repoPrefix);
      return {
        warnings: [],
        error: `Multiple frontend services require shared root asset routes (/static/, /public/, /rsbuild-hmr): ${prefixes.join(', ')}`,
      };
    }
    const rootRoutedFrontends = frontendServices.filter(
      (item) => item.frontendKind === 'taro',
    );
    if (rootRoutedFrontends.length > 1) {
      return {
        warnings: [],
        error: `Multiple frontend services require root catch-all routes: ${rootRoutedFrontends
          .map((item) => item.repoPrefix)
          .join(', ')}`,
      };
    }
    const rootRoutedFrontend = rootRoutedFrontends[0];

    const augmentedServices: RunnerServiceConfig[] = [];
    const routes: RunnerRouteConfig[] = [];
    const homepageLinks: RunnerHomepageLinkConfig[] = [];
    const homepageLabelByPath = new Map<string, string>();
    for (const link of params.orchestration.homepage?.links ?? []) {
      if (link?.path?.trim() && link?.label?.trim()) {
        homepageLabelByPath.set(link.path.trim(), link.label.trim());
      }
    }

    const navigableServices = selectedServices.filter(
      (item) => item.kind !== 'backend',
    );

    for (const selected of selectedServices) {
      const service = { ...selected.service };
      if (selected.kind === 'frontend') {
        const routePath = `/${selected.repoPrefix}/`;
        routes.push({
          path: `/${selected.repoPrefix}`,
          action: 'redirect',
          match: 'exact',
          redirectTo: routePath,
          redirectCode: 302,
        });
        routes.push({
          path: routePath,
          action: 'proxy',
          match: 'prefix',
          service: service.name,
          upstreamPath: '/',
          websocket: true,
        });
        if (
          selected.frontendKind === 'taro' &&
          apiBackend.service?.repoPrefix
        ) {
          const gatedPort = selected.facts.portEvidence.find(
            (candidate) =>
              candidate.protocol === 'http' &&
              candidate.evidence.includes('env-gated by TARO_APP_API'),
          );
          if (gatedPort) {
            service.port = gatedPort.value;
          }
        }

        service.env = this.buildFrontendServiceEnv({
          selected,
          service,
          routePath,
          apiBackendPrefix: apiBackend.service?.repoPrefix,
        });

        if (selected.frontendKind === 'rsbuild-vite') {
          routes.push({
            path: '/static/',
            action: 'proxy',
            match: 'prefix',
            service: service.name,
          });
          routes.push({
            path: '/public/',
            action: 'proxy',
            match: 'prefix',
            service: service.name,
          });
          if (selected.facts.frameworkHints.includes('rsbuild')) {
            routes.push({
              path: '/rsbuild-hmr',
              action: 'proxy',
              match: 'prefix',
              service: service.name,
              websocket: true,
            });
          }
        } else if (selected.frontendKind === 'taro') {
          if (apiBackend.service?.repoPrefix) {
            routes.push({
              path: '^/api/.*\\.(ts|js|mjs|vue|less|css|scss|map)$',
              action: 'proxy',
              match: 'regex',
              service: service.name,
            });
          }
          routes.push({
            path: `/_ainative/vite-hmr/${service.name}`,
            action: 'proxy',
            match: 'prefix',
            service: service.name,
            upstreamPath: '/',
            websocket: true,
          });
          routes.push({
            path: '/',
            action: 'proxy',
            match: 'prefix',
            service: service.name,
            upstreamPath: '/',
            websocket: true,
          });
        }

        homepageLinks.push({
          label:
            homepageLabelByPath.get(routePath) ??
            this.humanizeServiceLabel(selected.repoPrefix),
          path: routePath,
        });
      }

      augmentedServices.push(service);
    }

    if (apiBackend.service) {
      routes.push({
        path: '/api/',
        action: 'proxy',
        match: 'prefix',
        service: apiBackend.service.service.name,
        upstreamPath: '/',
        websocket: true,
      });
      homepageLinks.push({
        label: homepageLabelByPath.get('/api/') ?? 'Backend',
        path: '/api/',
      });
    }

    const previewService =
      this.selectPreviewService(
        navigableServices,
        params.orchestration.preview,
        rootRoutedFrontend?.service.name,
      ) ?? navigableServices[0]?.service.name;

    const homepage =
      homepageLinks.length > 1
        ? {
            title: params.orchestration.homepage?.title ?? 'AINative Runner',
            description:
              params.orchestration.homepage?.description ??
              'Application preview navigation',
            links: homepageLinks,
          }
        : params.orchestration.homepage && homepageLinks.length > 0
          ? {
              title: params.orchestration.homepage.title ?? 'AINative Runner',
              description: params.orchestration.homepage.description ?? '',
              links: homepageLinks,
            }
          : undefined;

    return {
      orchestration: {
        ...params.orchestration,
        services: augmentedServices,
        routes,
        ...(homepage ? { homepage } : {}),
        ...(previewService
          ? {
              preview: {
                service: previewService,
                path: homepage
                  ? '/'
                  : (params.orchestration.preview?.path ?? '/'),
              },
            }
          : {}),
      },
      warnings: [],
    };
  }

  private buildFrontendServiceEnv(params: {
    selected: SelectedRepoService;
    service: RunnerServiceConfig;
    routePath: string;
    apiBackendPrefix?: string;
  }): Record<string, string> {
    const env = {
      ...(params.selected.service.env ?? {}),
      CI: 'true',
      BROWSER: 'none',
    } as Record<string, string>;

    if (params.selected.frontendKind === 'rsbuild-vite') {
      env.SANDBOX = 'true';
      env.VITE_BASE_URL = params.routePath;

      const shouldOverrideAppProjectName = this.usesPathBaseEnv(
        params.selected.textEvidence,
        'APP_PROJECT_NAME',
      );
      if (shouldOverrideAppProjectName) {
        env.APP_PROJECT_NAME = params.selected.repoPrefix;
      } else {
        const configuredProjectName = this.resolveEnvValueFromEvidence(
          params.selected.textEvidence,
          'APP_PROJECT_NAME',
        );
        if (configuredProjectName) {
          env.APP_PROJECT_NAME = configuredProjectName;
        }
      }

      if (
        params.apiBackendPrefix &&
        this.repoReferencesEnvKey(params.selected.textEvidence, 'BASE_API_URL')
      ) {
        env.BASE_API_URL = '/api';
      }
      if (
        params.apiBackendPrefix &&
        this.repoReferencesEnvKey(params.selected.textEvidence, 'VITE_API_URL')
      ) {
        env.VITE_API_URL = '/api';
      }
    } else if (params.selected.frontendKind === 'taro') {
      env.AINATIVE_PREVIEW_HTML_INJECT = '1';
      env.AINATIVE_PREVIEW_HMR_PATH = `/_ainative/vite-hmr/${params.service.name}`;
      env.AINATIVE_PREVIEW_SERVICE_NAME = params.service.name;
      if (typeof params.service.port === 'number') {
        env.AINATIVE_PREVIEW_SERVICE_PORT = String(params.service.port);
      }
      if (params.apiBackendPrefix) {
        env.TARO_APP_API = '/api';
      }
    }

    return env;
  }

  private resolveApiBackendSelection(params: {
    frontendServices: SelectedRepoService[];
    backendServices: SelectedRepoService[];
  }): { service?: SelectedRepoService; error?: string } {
    if (
      params.frontendServices.length === 0 ||
      params.backendServices.length === 0
    ) {
      return {};
    }

    if (params.backendServices.length === 1) {
      return { service: params.backendServices[0] };
    }

    const referencedPrefixes = new Set<string>();
    for (const frontend of params.frontendServices) {
      for (const backend of params.backendServices) {
        if (
          this.referencesBackendPrefix(
            frontend.textEvidence,
            backend.repoPrefix,
          )
        ) {
          referencedPrefixes.add(backend.repoPrefix);
        }
      }
    }

    if (referencedPrefixes.size === 1) {
      const prefix = Array.from(referencedPrefixes)[0];
      return {
        service: params.backendServices.find(
          (item) => item.repoPrefix === prefix,
        ),
      };
    }

    if (referencedPrefixes.size > 1) {
      return {
        error: `Multiple backend services are referenced by frontend evidence: ${Array.from(
          referencedPrefixes,
        ).join(', ')}`,
      };
    }

    return {
      error:
        'Multiple backend/api services were discovered but no unique /api target could be inferred',
    };
  }

  private referencesBackendPrefix(
    textEvidence: Array<{ file: string; content: string }>,
    repoPrefix: string,
  ): boolean {
    return textEvidence.some(({ content }) =>
      new RegExp(`(?:/|["'\`])${repoPrefix}(?:/|["'\`])`, 'i').test(content),
    );
  }

  private classifyFrontendKind(
    facts: RepoFacts,
  ): 'rsbuild-vite' | 'taro' | 'other' | null {
    if (facts.frameworkHints.includes('taro')) {
      return 'taro';
    }
    if (
      facts.frameworkHints.includes('rsbuild') ||
      facts.frameworkHints.includes('vite')
    ) {
      return 'rsbuild-vite';
    }
    if (
      facts.frameworkHints.some((hint) => FRONTEND_FRAMEWORK_HINTS.has(hint))
    ) {
      return 'other';
    }
    return null;
  }

  private isBackendRepoFacts(facts: RepoFacts): boolean {
    return (
      facts.frameworkHints.some((hint) => BACKEND_FRAMEWORK_HINTS.has(hint)) ||
      Boolean(facts.goMod) ||
      facts.languageHints.includes('go') ||
      facts.languageHints.includes('python')
    );
  }

  private async collectRepoTextEvidence(
    repoDir: string,
    facts: RepoFacts,
  ): Promise<Array<{ file: string; content: string }>> {
    const interestingFiles = facts.fileTree.filter((file) => {
      const lower = file.toLowerCase();
      if (lower.startsWith('.env')) return true;
      if (lower === 'readme.md' || lower === 'makefile') return true;
      if (
        lower.startsWith('config/') ||
        lower.startsWith('configs/') ||
        lower.startsWith('src/config/') ||
        lower.startsWith('src/router/') ||
        lower.startsWith('src/routers/') ||
        lower === 'rsbuild.config.ts' ||
        lower === 'rsbuild.config.js' ||
        lower === 'vite.config.ts' ||
        lower === 'vite.config.js' ||
        lower === 'vite.config.mts' ||
        lower === 'next.config.js' ||
        lower === 'next.config.ts' ||
        lower === 'nuxt.config.ts' ||
        lower === 'nuxt.config.js'
      ) {
        return true;
      }
      return false;
    });

    const results: Array<{ file: string; content: string }> = [];
    for (const file of interestingFiles.slice(0, 40)) {
      try {
        const fullPath = path.join(repoDir, file);
        const content = await readFile(fullPath, 'utf-8');
        results.push({ file, content });
      } catch {
        continue;
      }
    }
    return results;
  }

  private repoReferencesEnvKey(
    textEvidence: Array<{ file: string; content: string }>,
    key: string,
  ): boolean {
    return textEvidence.some(
      ({ content }) =>
        content.includes(`process.env.${key}`) || content.includes(key),
    );
  }

  private resolveEnvValueFromEvidence(
    textEvidence: Array<{ file: string; content: string }>,
    key: string,
  ): string | undefined {
    const preferredFiles = [
      '.env.development',
      '.env.local',
      '.env.test',
      '.env.stage',
      '.env.production',
      '.env',
    ];
    const envFiles = [...textEvidence]
      .filter(({ file }) => file.toLowerCase().startsWith('.env'))
      .sort((left, right) => {
        const leftIndex = preferredFiles.indexOf(left.file);
        const rightIndex = preferredFiles.indexOf(right.file);
        const normalizedLeft =
          leftIndex === -1 ? preferredFiles.length : leftIndex;
        const normalizedRight =
          rightIndex === -1 ? preferredFiles.length : rightIndex;
        return normalizedLeft - normalizedRight;
      });

    for (const { content } of envFiles) {
      const match = content.match(
        new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\n\\r]+)["']?\\s*$`, 'm'),
      );
      if (match?.[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  private usesPathBaseEnv(
    textEvidence: Array<{ file: string; content: string }>,
    key: string,
  ): boolean {
    return textEvidence.some(
      ({ content }) =>
        content.includes(`process.env.${key}`) &&
        /(createWebHistory|assetPrefix|publicPath|basename|base\s*:)/i.test(
          content,
        ),
    );
  }

  private humanizeServiceLabel(repoPrefix: string): string {
    return repoPrefix
      .split(/[-_/]+/)
      .filter(Boolean)
      .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
      .join(' ');
  }

  private selectPreviewService(
    navigableServices: SelectedRepoService[],
    existingPreview: RunnerOrchestrationConfig['preview'],
    preferredServiceName?: string,
  ): string | undefined {
    const navigableServiceNames = new Set(
      navigableServices.map((item) => item.service.name),
    );
    if (
      preferredServiceName &&
      navigableServiceNames.has(preferredServiceName)
    ) {
      return preferredServiceName;
    }
    if (
      existingPreview?.service &&
      navigableServiceNames.has(existingPreview.service)
    ) {
      return existingPreview.service;
    }
    return navigableServices[0]?.service.name;
  }

  private scheduleVerificationJob(params: {
    businessLineId: string;
    fingerprint: string;
    orchestration: RunnerOrchestrationConfig;
    meta: RunnerConfigCacheMeta;
    workspacePath: string;
  }): void {
    setImmediate(() => {
      void this.runVerificationJob(params);
    });
  }

  private async runVerificationJob(params: {
    businessLineId: string;
    fingerprint: string;
    orchestration: RunnerOrchestrationConfig;
    meta: RunnerConfigCacheMeta;
    workspacePath: string;
  }): Promise<void> {
    const startedAt = Date.now();
    try {
      const probe = await this.probeService.probe({
        orchestration: params.orchestration,
        workspacePath: params.workspacePath,
        fingerprint: `${params.fingerprint}-fullscan`,
      });
      const verifiedOrchestration =
        probe.status === 'passed' && probe.repairedOrchestration
          ? probe.repairedOrchestration
          : params.orchestration;
      const verificationStatus =
        probe.status === 'passed'
          ? 'passed'
          : probe.status === 'skipped'
            ? 'skipped'
            : 'failed';
      const finalMeta: RunnerConfigCacheMeta = {
        ...params.meta,
        probeStatus: probe.status,
        probeMode: probe.mode,
        probeError: probe.error,
        probeDurationMs: probe.durationMs,
        routeProbeResults: probe.routeResults,
        probeRepaired: probe.repaired || undefined,
        probeRepairSummary: probe.repairSummary,
        verificationStatus,
        verificationFinishedAt: new Date().toISOString(),
        verificationDurationMs: Date.now() - startedAt,
        verificationError: probe.error,
        verificationLogsPreview: probe.logsPreview,
      };

      if (probe.status === 'passed') {
        const syncResult = await this.syncService.syncToHiddenProject(
          params.businessLineId,
          verifiedOrchestration,
          {
            fingerprint: params.fingerprint,
            generatorToolId: params.meta.generatorToolId,
            generatorConfigId: params.meta.generatorConfigId,
            warningCount: params.meta.analysisWarnings?.length ?? 0,
          },
        );
        const allWarnings = [
          ...(finalMeta.analysisWarnings ?? []),
          ...(syncResult.warnings ?? []),
        ];
        this.logRunnerGenerationEvent('verification_completed', {
          businessLineId: params.businessLineId,
          fingerprint: params.fingerprint,
          status: syncResult.synced ? 'ready' : 'generated',
          source: params.meta.source,
          verificationStatus: 'passed',
          probeStatus: probe.status,
          durationMs: Date.now() - startedAt,
          synced: syncResult.synced,
          failureKind: syncResult.synced ? undefined : 'sync',
        });
        await this.updateBusinessLineConfig(params.businessLineId, {
          runnerConfigCache: verifiedOrchestration,
          runnerConfigCacheMeta: {
            ...finalMeta,
            analysisWarnings: allWarnings.length > 0 ? allWarnings : undefined,
          },
          ...(syncResult.synced
            ? { runnerFingerprint: params.fingerprint }
            : {}),
          runnerConfigStatus: syncResult.synced ? 'ready' : 'generated',
          runnerGeneratedAt: new Date().toISOString(),
          runnerConfigError: syncResult.synced
            ? undefined
            : `Sync skipped: ${syncResult.skippedReason ?? 'unknown'}`,
          runnerConfigUpdatedAt: new Date().toISOString(),
        });
        return;
      }

      this.logRunnerGenerationEvent('verification_completed', {
        businessLineId: params.businessLineId,
        fingerprint: params.fingerprint,
        status: 'needsManualReview',
        source: params.meta.source,
        verificationStatus,
        probeStatus: probe.status,
        durationMs: Date.now() - startedAt,
        failureKind: probe.failureKind ?? 'probe',
      });
      await this.updateBusinessLineConfig(params.businessLineId, {
        runnerConfigCache: verifiedOrchestration,
        runnerConfigCacheMeta: finalMeta,
        runnerConfigStatus: 'needsManualReview',
        runnerConfigError: (
          probe.error ??
          (probe.status === 'skipped'
            ? 'AI full scan runtime verification skipped'
            : 'AI full scan runtime verification failed')
        ).slice(0, 2000),
        runnerConfigUpdatedAt: new Date().toISOString(),
        runnerLastAttemptedFingerprint: params.fingerprint,
        runnerLastAttemptedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logRunnerGenerationEvent('verification_failed', {
        businessLineId: params.businessLineId,
        fingerprint: params.fingerprint,
        status: 'needsManualReview',
        source: params.meta.source,
        verificationStatus: 'failed',
        durationMs: Date.now() - startedAt,
        failureKind: this.classifyGenerationFailure(message),
      });
      await this.updateBusinessLineConfig(params.businessLineId, {
        runnerConfigCache: params.orchestration,
        runnerConfigCacheMeta: {
          ...params.meta,
          verificationStatus: 'failed',
          verificationFinishedAt: new Date().toISOString(),
          verificationDurationMs: Date.now() - startedAt,
          verificationError: message.slice(0, 1000),
        },
        runnerConfigStatus: 'needsManualReview',
        runnerConfigError: message.slice(0, 2000),
        runnerConfigUpdatedAt: new Date().toISOString(),
        runnerLastAttemptedFingerprint: params.fingerprint,
        runnerLastAttemptedAt: new Date().toISOString(),
      });
    } finally {
      await rm(params.workspacePath, { recursive: true, force: true }).catch(
        () => {},
      );
    }
  }

  private async generateFromCandidateManifest(
    businessLineId: string,
    manifest: RunnerCandidateManifest,
    warnings: string[],
    initialRetryConstraints?: RetryConstraints,
  ): Promise<(RunnerOrchestrationConfig & InternalFields) | null> {
    let retryConstraints: RetryConstraints | undefined =
      initialRetryConstraints;

    for (let attempt = 1; attempt <= MAX_AI_SELECTION_ATTEMPTS; attempt++) {
      const currentManifest = retryConstraints
        ? this.filterManifest(manifest, retryConstraints)
        : manifest;
      const baseSelection = buildDeterministicSelection(currentManifest);
      const aiResult = await this.aiGenerator.selectCandidates(
        businessLineId,
        currentManifest,
        retryConstraints,
      );
      warnings.push(...aiResult.warnings);

      if (!aiResult.selection) {
        retryConstraints = this.mergeRetryConstraints(retryConstraints, {
          previousErrors: [
            `AI selection attempt ${attempt} returned no selection`,
          ],
        });
        continue;
      }

      const normalizedSelection = baseSelection
        ? {
            ...aiResult.selection,
            selectedServiceCandidateIds: this.limitSelectedCandidateIds(
              currentManifest,
              baseSelection.selectedServiceCandidateIds,
              baseSelection.previewServiceCandidateId,
            ),
            previewServiceCandidateId:
              aiResult.selection.previewServiceCandidateId &&
              this.limitSelectedCandidateIds(
                currentManifest,
                baseSelection.selectedServiceCandidateIds,
                baseSelection.previewServiceCandidateId,
              ).includes(aiResult.selection.previewServiceCandidateId)
                ? aiResult.selection.previewServiceCandidateId
                : baseSelection.previewServiceCandidateId,
            routePreference:
              aiResult.selection.routePreference ??
              baseSelection.routePreference,
          }
        : aiResult.selection;

      const assembled = assembleRunnerConfigFromSelection(
        currentManifest,
        normalizedSelection,
      );
      if (!assembled) {
        retryConstraints = this.mergeRetryConstraints(retryConstraints, {
          previousErrors: [
            `AI selection attempt ${attempt} could not be assembled`,
          ],
        });
        continue;
      }

      warnings.push(...assembled.warnings);
      const validation = validateRunnerConfig(assembled.orchestration, {
        serviceProtocols: assembled.serviceProtocols,
        runnerListenPort: this.getRunnerListenPort(),
      });

      if (validation.valid && validation.sanitized) {
        if (!validation.sanitized.preview) {
          return {
            ...validation.sanitized,
            _source: 'ai',
            _generatorToolId: aiResult.generatorToolId,
            _generatorConfigId: aiResult.generatorConfigId,
            _needsManualReview: true,
            _manualReviewReason:
              'AI candidate selection produced no preview route',
          };
        }

        return {
          ...validation.sanitized,
          _source: 'ai',
          _generatorToolId: aiResult.generatorToolId,
          _generatorConfigId: aiResult.generatorConfigId,
        };
      }

      warnings.push(
        `AI candidate selection validation failed: ${validation.errors.join('; ')}`,
      );
      retryConstraints = this.mergeRetryConstraints(
        retryConstraints,
        this.retryConstraintsFromValidation(validation.errors),
      );
    }

    const deterministicSelection = buildDeterministicSelection(manifest);
    if (!deterministicSelection) return null;

    const assembled = assembleRunnerConfigFromSelection(
      manifest,
      deterministicSelection,
    );
    if (!assembled) return null;

    warnings.push(...assembled.warnings);
    const validation = validateRunnerConfig(assembled.orchestration, {
      serviceProtocols: assembled.serviceProtocols,
      runnerListenPort: this.getRunnerListenPort(),
    });

    if (validation.valid && validation.sanitized) {
      return {
        ...validation.sanitized,
        _source: 'fallback',
        ...(validation.sanitized.preview
          ? {}
          : {
              _needsManualReview: true,
              _manualReviewReason:
                'Deterministic candidate selection produced no preview route',
            }),
      };
    }

    warnings.push(
      `Deterministic candidate validation failed: ${validation.errors.join('; ')}`,
    );
    return null;
  }

  private needsDeeperScan(manifest: RunnerCandidateManifest): boolean {
    if (manifest.candidates.length === 0) return true;
    return !manifest.candidates.some((candidate) => candidate.previewCapable);
  }

  private mergeRetryConstraints(
    current: RetryConstraints | undefined,
    next: RetryConstraints,
  ): RetryConstraints {
    return {
      rejectCandidateIds: [
        ...new Set([
          ...(current?.rejectCandidateIds ?? []),
          ...(next.rejectCandidateIds ?? []),
        ]),
      ],
      rejectProtocols: [
        ...new Set([
          ...(current?.rejectProtocols ?? []),
          ...(next.rejectProtocols ?? []),
        ]),
      ],
      rejectPorts: [
        ...new Set([
          ...(current?.rejectPorts ?? []),
          ...(next.rejectPorts ?? []),
        ]),
      ],
      requiredPreviewProtocol:
        next.requiredPreviewProtocol ?? current?.requiredPreviewProtocol,
      previousErrors: [
        ...(current?.previousErrors ?? []),
        ...(next.previousErrors ?? []),
      ],
    };
  }

  private retryConstraintsFromValidation(errors: string[]): RetryConstraints {
    const rejectPorts: number[] = [];
    const rejectProtocols: RetryConstraints['rejectProtocols'] = [];

    for (const error of errors) {
      if (error.includes('non-HTTP protocol')) {
        rejectProtocols.push('grpc', 'metrics', 'tcp');
      }
      const portMatch = error.match(/port (\d+)/);
      if (error.includes('conflicts with runner listen port') && portMatch) {
        rejectPorts.push(Number(portMatch[1]));
      }
    }

    return {
      rejectPorts,
      rejectProtocols,
      requiredPreviewProtocol: rejectProtocols.length > 0 ? 'http' : undefined,
      previousErrors: errors,
    };
  }

  private retryConstraintsFromProbe(
    orchestration: RunnerOrchestrationConfig,
    probe: RunnerConfigProbeResult,
  ): RetryConstraints {
    if (probe.status !== 'failed') return {};
    const previewService = orchestration.preview?.service;
    const service = orchestration.services.find(
      (candidate) => candidate.name === previewService,
    );
    return {
      rejectPorts:
        service?.port &&
        (probe.failureKind === 'preview-unreachable' ||
          probe.failureKind === 'service-timeout')
          ? [service.port]
          : [],
      previousErrors: [probe.error ?? 'Runtime probe failed'],
    };
  }

  private formatProbeWarning(probe: RunnerConfigProbeResult): string {
    if (probe.status === 'passed') {
      return `Runtime probe passed (${probe.durationMs}ms, mode=${probe.mode})`;
    }
    if (probe.status === 'skipped') {
      return `Runtime probe skipped (mode=${probe.mode}${probe.error ? `, reason=${probe.error}` : ''})`;
    }
    return `Runtime probe failed (${probe.durationMs}ms, mode=${probe.mode}, kind=${probe.failureKind ?? 'unknown'}): ${probe.error ?? 'unknown error'}`;
  }

  private buildRunnerMeta(
    orchestration: RunnerOrchestrationConfig & InternalFields,
    fingerprint: string,
    warnings: string[],
    isPartial: boolean,
    probe: RunnerConfigProbeResult,
    coverage: RepoCoverageSummary,
  ): RunnerConfigCacheMeta {
    return {
      source: orchestration._source ?? 'fallback',
      generatedAt: new Date().toISOString(),
      coverageStatus: coverage.coverageStatus,
      discoveredRepoPrefixes: coverage.discoveredRepoPrefixes,
      selectedRepoPrefixes: coverage.selectedRepoPrefixes,
      omittedRepoPrefixes: coverage.omittedRepoPrefixes,
      needsConfigRepoPrefixes: coverage.needsConfigRepoPrefixes,
      omissionReasonsByRepo: coverage.omissionReasonsByRepo,
      autoStartLimited: coverage.autoStartLimited,
      analysisWarnings: warnings.length > 0 ? warnings : undefined,
      generatorToolId: orchestration._generatorToolId,
      generatorConfigId: orchestration._generatorConfigId,
      inputFingerprint: fingerprint,
      partial: isPartial || undefined,
      probeStatus: probe.status,
      probeMode: probe.mode,
      probeError: probe.error,
      probeDurationMs: probe.durationMs,
      routeProbeResults: probe.routeResults,
      probeRepaired: probe.repaired || undefined,
      probeRepairSummary: probe.repairSummary,
    };
  }

  private filterManifest(
    manifest: RunnerCandidateManifest,
    constraints: RetryConstraints,
  ): RunnerCandidateManifest {
    const candidates = manifest.candidates.filter((candidate) => {
      if (constraints.rejectCandidateIds?.includes(candidate.id)) return false;
      if (
        candidate.port &&
        constraints.rejectProtocols?.includes(candidate.port.protocol)
      ) {
        return false;
      }
      if (
        candidate.port &&
        constraints.rejectPorts?.includes(candidate.port.value)
      ) {
        return false;
      }
      if (
        constraints.requiredPreviewProtocol &&
        candidate.previewCapable &&
        candidate.port?.protocol !== constraints.requiredPreviewProtocol
      ) {
        return false;
      }
      return true;
    });

    return {
      candidates,
      warnings: manifest.warnings,
    };
  }

  private tryFallbackGeneration(
    facts: RepoFacts[],
    warnings: string[],
  ): (RunnerOrchestrationConfig & InternalFields) | null {
    const fallbackResult = buildDeterministicConfig(facts);
    warnings.push(...fallbackResult.warnings);

    if (
      !fallbackResult.orchestration.services ||
      fallbackResult.orchestration.services.length === 0
    ) {
      return null;
    }

    const validation = validateRunnerConfig(fallbackResult.orchestration, {
      serviceProtocols: fallbackResult.serviceProtocols,
      runnerListenPort: this.getRunnerListenPort(),
    });
    if (validation.valid && validation.sanitized) {
      const hasPreviewRoute =
        Boolean(validation.sanitized.preview) &&
        (validation.sanitized.routes ?? []).some(
          (route) => route.action === 'proxy',
        );
      if (!hasPreviewRoute) {
        warnings.push(
          'Fallback validation passed but no preview-capable route was found',
        );
        return null;
      }
      return { ...validation.sanitized, _source: 'fallback' };
    }

    warnings.push(
      `Fallback validation failed: ${validation.errors.join('; ')}`,
    );
    return null;
  }

  private getRunnerListenPort(): number {
    const raw = this.configService.get<string>('AINATIVE_RUNNER_LISTEN_PORT', {
      infer: true,
    });
    const parsed = raw ? Number(raw) : 8080;
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
      ? parsed
      : 8080;
  }

  private isFullScanFallbackEnabled(): boolean {
    const raw = this.configService
      .get<string>('AINATIVE_RUNNER_GENERATION_FULL_SCAN_MODE', {
        infer: true,
      })
      ?.trim()
      .toLowerCase();
    return raw !== 'off' && raw !== 'false' && raw !== '0';
  }

  private buildVerificationId(fingerprint: string): string {
    return createHash('sha256')
      .update(`${fingerprint}:${Date.now()}:${Math.random()}`)
      .digest('hex')
      .slice(0, 16);
  }

  private classifyGenerationFailure(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('schema')) return 'schema';
    if (lower.includes('validation') || lower.includes('validator')) {
      return 'validator';
    }
    if (lower.includes('probe') || lower.includes('readiness')) return 'probe';
    if (lower.includes('sync')) return 'sync';
    if (lower.includes('parse') || lower.includes('parsing')) {
      return 'full_scan_parsing';
    }
    if (lower.includes('no agent cli') || lower.includes('ai cli')) {
      return 'ai_unavailable';
    }
    return 'unknown';
  }

  private logRunnerGenerationEvent(
    event: string,
    payload: Record<string, unknown>,
  ): void {
    this.logger.log(
      `runner_generation_event ${JSON.stringify({
        event,
        ...payload,
      })}`,
    );
  }

  private async lsRemoteAllSubRepos(subRepos: SubRepoConfig[]): Promise<{
    heads: Record<string, string>;
    warnings: string[];
    allSucceeded: boolean;
  }> {
    const heads: Record<string, string> = {};
    const warnings: string[] = [];

    for (const sub of subRepos) {
      const resolvedUrl = this.resolveRemoteUrl(sub.url);
      const result = await this.runCommand('git', [
        'ls-remote',
        '--heads',
        resolvedUrl,
        `refs/heads/${sub.branch}`,
      ]);

      if (!result.success || !result.stdout.trim()) {
        warnings.push(
          `ls-remote failed for ${sub.prefix}: ${result.stderr || 'no output'}`,
        );
        continue;
      }

      const sha = result.stdout.trim().split(/\s+/)[0];
      if (!sha) {
        warnings.push(
          `Could not parse HEAD SHA for ${sub.prefix} (${sub.url})`,
        );
        continue;
      }
      heads[sub.prefix] = sha;
    }

    return {
      heads,
      warnings,
      allSucceeded: Object.keys(heads).length === subRepos.length,
    };
  }

  private computeFingerprint(
    subRepos: SubRepoConfig[],
    heads: Record<string, string>,
  ): string {
    const parts = [...subRepos]
      .sort((a, b) => a.prefix.localeCompare(b.prefix))
      .map((r) => {
        const normalizedUrl = normalizeSubRepoUrl(r.url);
        const head = heads[r.prefix] ?? 'unknown';
        return `${r.prefix}|${normalizedUrl}|${r.branch}|${head}`;
      });

    return createHash('sha256')
      .update(parts.join('\n'))
      .digest('hex')
      .slice(0, 16);
  }

  private async updateBusinessLineConfig(
    blId: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    const freshBl = await this.businessLineRepository.findById(blId);
    const currentConfig = (freshBl?.configJson ?? {}) as Record<
      string,
      unknown
    >;
    const merged = { ...currentConfig, ...patch };

    if (patch.runnerConfigError === undefined && 'runnerConfigError' in patch) {
      delete merged.runnerConfigError;
    }

    await this.businessLineRepository.update(blId, {
      configJson: merged,
    });
  }

  private resolveRemoteUrl(url: string): string {
    return resolveGitRemoteUrlWithHttpAuth(url, {
      targetHost: this.gitlabHttpAuthHost,
      username:
        this.configService.get<string>('GITLAB_USERNAME', { infer: true }) ??
        'oauth2',
      token: this.configService.get<string>('GITLAB_TOKEN', { infer: true }),
    });
  }

  private runCommand(
    command: string,
    args: string[],
  ): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
        },
      });

      let stdout = '';
      let stderr = '';
      let finished = false;

      const finish = (result: {
        success: boolean;
        stdout: string;
        stderr: string;
      }) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        resolve(result);
      };

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        finish({
          success: false,
          stdout: stdout.trimEnd(),
          stderr: `Timed out after ${RUNNER_GIT_TIMEOUT_MS}ms. ${stderr.trimEnd()}`,
        });
      }, RUNNER_GIT_TIMEOUT_MS);

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        finish({
          success: code === 0,
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
        });
      });

      child.on('error', (err) => {
        finish({
          success: false,
          stdout: '',
          stderr: err.message,
        });
      });
    });
  }
}

interface InternalFields {
  _source?: 'ai' | 'fallback' | 'ai-full-scan';
  _generatorToolId?: string;
  _generatorConfigId?: string;
  _needsManualReview?: boolean;
  _manualReviewReason?: string;
}

function stripInternalFields(
  obj: RunnerOrchestrationConfig & InternalFields,
): RunnerOrchestrationConfig {
  const rest = { ...obj };
  delete rest._source;
  delete rest._generatorToolId;
  delete rest._generatorConfigId;
  delete rest._needsManualReview;
  delete rest._manualReviewReason;
  return rest;
}
